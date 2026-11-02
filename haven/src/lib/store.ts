import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { supabase } from "./supabase";
import { mobileState, listenerAvatar } from "./listener-model";
import { characterId } from "./characters";
import {
  defaultProfile,
  type Item,
  type Kind,
  type RecordData,
  type Profile,
} from "./types";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Context = {
  userId: string;
  demo: boolean;
  purpose?: string;
  operation?: string;
  db?: Awaited<ReturnType<typeof supabase>>;
  initialCharacter?: string;
};
const root = path.join(process.cwd(), "data");
let lock = Promise.resolve();
export async function serial<T>(fn: () => Promise<T>): Promise<T> {
  const old = lock;
  let release!: () => void;
  lock = new Promise<void>((r) => {
    release = r;
  });
  await old;
  try {
    return await fn();
  } finally {
    release();
  }
}
async function load(id: string): Promise<Item[]> {
  try {
    return JSON.parse(await readFile(path.join(root, id + ".json"), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}
async function save(id: string, rows: Item[]) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const p = path.join(root, id + ".json");
  await writeFile(p + ".tmp", JSON.stringify(rows), { mode: 0o600 });
  await rename(p + ".tmp", p);
}
export async function context(
  purpose = "application",
  operation = "read",
): Promise<Context> {
  const jar = await cookies();
  const demo = jar.get("haven_demo")?.value;
  if (
    process.env.DEMO_ENABLED === "true" &&
    demo &&
    /^[a-f0-9-]{36}$/.test(demo)
  ) {
    const c = { userId: demo, demo: true, purpose, operation };
    const p = await profile(c);
    if (p.status !== "active")
      throw new AppError(401, "This account is unavailable.");
    return c;
  }
  const db = await supabase();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user)
    throw new AppError(401, "Please sign in to continue.");
  if (!data.user.email_confirmed_at)
    throw new AppError(403, "Please verify your email first.");
  const c = { userId: data.user.id, demo: false, db, purpose, operation, initialCharacter: characterId(String(data.user.user_metadata?.havenCharacter || "cat")) };
  const p = await profile(c);
  if (p.status !== "active")
    throw new AppError(403, "Account access has been revoked.");
  return c;
}
export async function list(
  c: Context,
  kind?: Kind,
  parent?: string,
): Promise<Item[]> {
  if (c.demo)
    return (await load(c.userId)).filter(
      (r) =>
        (!kind || r.kind === kind) &&
        (parent === undefined || r.parent_id === parent),
    );
  let q = c.db!.from("records").select("*").eq("user_id", c.userId);
  if (kind) q = q.eq("kind", kind);
  if (parent !== undefined) q = q.eq("parent_id", parent);
  const { data, error } = await q.order("created_at");
  if (error) throw new AppError(503, "Storage is unavailable. Please retry.");
  return data || [];
}
export async function get(c: Context, id: string, kind?: Kind) {
  const row = (await list(c, kind)).find((r) => r.id === id);
  if (!row) throw new AppError(404, "Record not found.");
  return row;
}
export async function insert(
  c: Context,
  kind: Kind,
  data: RecordData,
  parent: string | null = null,
  id = randomUUID(),
): Promise<Item> {
  if (parent) await get(c, parent);
  const now = new Date().toISOString();
  const row: Item = {
    id,
    user_id: c.userId,
    kind,
    parent_id: parent,
    data,
    version: 1,
    created_at: now,
    updated_at: now,
  };
  if (c.demo)
    return serial(async () => {
      const rows = await load(c.userId);
      if (rows.some((r) => r.id === id))
        throw new AppError(409, "This request was already processed.");
      rows.push(row);
      await save(c.userId, rows);
      return row;
    });
  const { data: out, error } = await c
    .db!.from("records")
    .insert(row)
    .select()
    .single();
  if (error)
    throw new AppError(
      error.code === "23505" ? 409 : 503,
      "Record could not be saved.",
    );
  return out;
}
export async function update(
  c: Context,
  id: string,
  data: RecordData,
  version: number,
): Promise<Item> {
  const row = await get(c, id);
  if (row.version !== version)
    throw new AppError(409, "This record changed. Reload before saving.");
  if (c.demo)
    return serial(async () => {
      const rows = await load(c.userId);
      const i = rows.findIndex((r) => r.id === id);
      if (rows[i].version !== version)
        throw new AppError(409, "This record changed. Reload before saving.");
      rows[i] = {
        ...row,
        data: { ...row.data, ...data },
        version: version + 1,
        updated_at: new Date().toISOString(),
      };
      await save(c.userId, rows);
      return rows[i];
    });
  const { data: out, error } = await c
    .db!.from("records")
    .update({
      data: { ...row.data, ...data },
      version: version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", c.userId)
    .eq("version", version)
    .select()
    .maybeSingle();
  if (error) throw new AppError(503, "Changes could not be saved.");
  if (!out)
    throw new AppError(409, "This record changed. Reload before saving.");
  return out;
}
export async function remove(c: Context, id: string) {
  await get(c, id);
  if (c.demo)
    return serial(async () => {
      const rows = await load(c.userId);
      const ids = new Set([id]);
      let n = 0;
      while (n !== ids.size) {
        n = ids.size;
        rows.forEach((r) => {
          if (r.parent_id && ids.has(r.parent_id)) ids.add(r.id);
        });
      }
      await save(
        c.userId,
        rows.filter((r) => !ids.has(r.id)),
      );
    });
  const { error } = await c
    .db!.from("records")
    .delete()
    .eq("user_id", c.userId)
    .eq("id", id);
  if (error) throw new AppError(503, "Deletion could not be saved.");
}
export async function profile(c: Context): Promise<Profile> {
  const p = (await list(c, "profile"))[0];
  const result = { ...defaultProfile, companion: c.initialCharacter || defaultProfile.companion, ...p?.data } as Profile;
  result.mobile = mobileState(result.mobile, result.companion);
  result.companion = listenerAvatar(result.mobile.listener);
  return result;
}
export async function setProfile(c: Context, data: RecordData) {
  const p = (await list(c, "profile"))[0];
  return p
    ? update(c, p.id, data, p.version)
    : insert(c, "profile", { ...defaultProfile, companion: c.initialCharacter || defaultProfile.companion, ...data });
}
export async function createDemo() {
  const id = randomUUID();
  await save(id, []);
  return id;
}
export function assertOrigin(request: Request) {
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin !== new URL(process.env.APP_ORIGIN || request.url).origin)
      throw new AppError(403, "Request origin is not allowed.");
  }
}
export async function demoTransaction<T>(
  c: Context,
  fn: (rows: Item[]) => T,
): Promise<T> {
  if (!c.demo) throw new AppError(400, "Demo transaction only.");
  return serial(async () => {
    const rows = await load(c.userId);
    const profile = rows.find((r) => r.kind === "profile");
    if (profile?.data.status === "deleted")
      throw new AppError(401, "Account unavailable.");
    const result = fn(rows);
    await save(c.userId, rows);
    return result;
  });
}
