-- Run in a new Supabase project. Ordinary application access uses the anon key + JWT, never service role.
create table public.records (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('profile','conversation','message','plan','task','checkin','revision','memory_link','job','favorite','access_event','deletion_job')),
 parent_id uuid,
 data jsonb not null default '{}',
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,user_id),
 foreign key(parent_id,user_id) references public.records(id,user_id) on delete cascade
);
create index records_owner_kind on public.records(user_id,kind);
create index records_parent on public.records(parent_id,user_id);
create unique index one_profile on public.records(user_id) where kind='profile';
create unique index message_idempotency on public.records(user_id,kind,(data->>'requestId'),(data->>'role')) where kind='message';
create unique index job_deduplication on public.records(user_id,(data->>'dedupe')) where kind='job';
create unique index checkin_per_task on public.records(user_id,(data->>'taskId')) where kind='checkin';
create unique index favorite_per_resource on public.records(user_id,(data->>'resourceId')) where kind='favorite';
create or replace function public.account_active(uid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select not exists(select 1 from records where user_id=uid and kind='profile' and data->>'status' in ('deleted','revoked'));
$$;
revoke all on function public.account_active(uuid) from public;
grant execute on function public.account_active(uuid) to authenticated;
alter table public.records enable row level security;
alter table public.records force row level security;
create policy owner_read on public.records for select to authenticated using(user_id=auth.uid() and public.account_active(auth.uid()));
create policy owner_insert on public.records for insert to authenticated with check(user_id=auth.uid() and public.account_active(auth.uid()));
create policy owner_update on public.records for update to authenticated using(user_id=auth.uid() and public.account_active(auth.uid())) with check(user_id=auth.uid());
create policy owner_delete on public.records for delete to authenticated using(user_id=auth.uid() and public.account_active(auth.uid()));
grant select,insert,update,delete on public.records to authenticated;
revoke all on public.records from anon;
create or replace function public.validate_record() returns trigger language plpgsql set search_path=public as $$
declare parent_kind text; task_parent uuid;
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.user_id<>old.user_id or new.kind<>old.kind or new.parent_id is distinct from old.parent_id then raise exception 'Immutable ownership'; end if;
  if new.version<>old.version+1 then raise exception 'Version conflict'; end if;
  if old.kind='profile' and old.data->>'status' in ('deleted','revoked') then raise exception 'Account inactive'; end if;
 end if;
 if new.parent_id is not null then
  select kind into parent_kind from records where id=new.parent_id and user_id=new.user_id;
  if parent_kind is null then raise exception 'Invalid parent'; end if;
  if new.kind='message' and parent_kind<>'conversation' then raise exception 'Invalid conversation'; end if;
  if new.kind in ('task','checkin','revision') and parent_kind<>'plan' then raise exception 'Invalid plan'; end if;
 end if;
 if new.kind in ('message','task','checkin','revision') and new.parent_id is null then raise exception 'Missing parent'; end if;
 if new.kind='checkin' then
  select parent_id into task_parent from records where id=(new.data->>'taskId')::uuid and user_id=new.user_id and kind='task';
  if task_parent is null or task_parent<>new.parent_id then raise exception 'Task ownership mismatch'; end if;
 end if;
 return new;
end; $$;
create trigger validate_record before insert or update on public.records for each row execute function public.validate_record();
-- Shared knowledge is independently published. No authenticated write grants or policies.
create table public.knowledge_items (
 id text primary key,title text not null,category text not null,tags text[] not null default '{}',content text not null,
 source_url text not null,source_section text,applicability text,limitations text,allowed_uses text[],reuse_permissions text,
 review_status text not null default 'draft',version integer not null default 1,updated_at timestamptz not null default now()
);
alter table public.knowledge_items enable row level security;
create policy published_read on public.knowledge_items for select to authenticated using(review_status='published');
grant select on public.knowledge_items to authenticated;
revoke insert,update,delete on public.knowledge_items from authenticated,anon;
-- Atomic future revision acceptance. All changes succeed or none do.
create or replace function public.apply_revision(plan_uuid uuid,revision_uuid uuid,today_date text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare p records; r records; t records; ch jsonb; out_data jsonb;
begin
 select * into p from records where id=plan_uuid and user_id=auth.uid() and kind='plan' for update;
 select * into r from records where id=revision_uuid and user_id=auth.uid() and parent_id=plan_uuid and kind='revision' for update;
 if p.id is null or r.id is null or r.data->>'state'<>'preview' or (r.data->>'planVersion')::int<>p.version then raise exception 'Revision conflict'; end if;
 for ch in select * from jsonb_array_elements(r.data->'changes') loop
  select * into t from records where id=(ch->>'id')::uuid and user_id=auth.uid() and parent_id=plan_uuid and kind='task' for update;
  if t.id is null or t.version<>(ch->>'version')::int or t.data->>'date'<=today_date then raise exception 'Task conflict'; end if;
  update records set data=jsonb_set(data,'{title}',ch->'after'),version=version+1,updated_at=now() where id=t.id;
 end loop;
 update records set data=jsonb_set(data,'{state}','"accepted"'),version=version+1,updated_at=now() where id=r.id;
 update records set data=data||jsonb_build_object('revision',r.id),version=version+1,updated_at=now() where id=p.id returning to_jsonb(records.*) into out_data;
 return out_data;
end; $$;
grant execute on function public.apply_revision(uuid,uuid,text) to authenticated;
-- Atomic activation with deterministic unique dates; duplicate accept is safe.
create unique index one_task_per_activation_day on public.records(user_id,parent_id,(data->>'activationDate')) where kind='task' and data ? 'activationDate';
create or replace function public.accept_plan(plan_uuid uuid,expected_version integer) returns jsonb language plpgsql security invoker set search_path=public as $$
declare p records; day_date date; offset_day integer; output jsonb;
begin
 select * into p from records where id=plan_uuid and user_id=auth.uid() and kind='plan' for update;
 if p.id is null then raise exception 'Plan not found'; end if;
 if p.data->>'state'='active' then return to_jsonb(p); end if;
 if p.data->>'state'<>'draft' or p.version<>expected_version then raise exception 'Version conflict'; end if;
 for offset_day in 0..(p.data->>'days')::integer-1 loop
  day_date=(p.data->>'start')::date+offset_day;
  if coalesce((p.data->>'weekendsFree')::boolean,false) and extract(isodow from day_date) in (6,7) then continue; end if;
  insert into records(user_id,kind,parent_id,data) values(auth.uid(),'task',p.id,jsonb_build_object('date',day_date::text,'activationDate',day_date::text,'title',p.data->>'task','steps',p.data->'steps','minutes',p.data->'minutes'));
 end loop;
 update records set data=jsonb_set(data,'{state}','"active"'),version=version+1,updated_at=now() where id=p.id returning to_jsonb(records.*) into output;
 return output;
end; $$;
grant execute on function public.accept_plan(uuid,integer) to authenticated;
-- Task deletions remove their associated check-ins, rather than leaving orphan JSON references.
create or replace function public.remove_task_checkins() returns trigger language plpgsql security invoker set search_path=public as $$ begin
 if old.kind='task' then delete from records where user_id=old.user_id and kind='checkin' and data->>'taskId'=old.id::text; end if; return old;
end; $$;
create trigger task_cleanup before delete on public.records for each row execute function public.remove_task_checkins();
