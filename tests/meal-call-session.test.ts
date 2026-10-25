import test from "node:test";
import assert from "node:assert/strict";
import type { DailyCall, DailyFactoryOptions } from "@daily-co/daily-js";
import { createMealSession } from "../src/lib/meal-call-session";

function deferred<T>() { let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve}; }
function fakeCall(join=Promise.resolve()) {
  const listeners=new Map<string,(()=>void)[]>(), calls={joins:[] as unknown[],audio:[] as boolean[],video:[] as boolean[],destroy:0,leave:0};
  const emit=(name:string)=>listeners.get(name)?.forEach(fn=>fn());
  const client={
    on(name:string,fn:()=>void){listeners.set(name,[...(listeners.get(name)||[]),fn]);return this;},
    participants(){return {};},
    async join(options:unknown){calls.joins.push(options);await join;emit('joined-meeting');},
    setLocalAudio(on:boolean){calls.audio.push(on);},setLocalVideo(on:boolean){calls.video.push(on);},
    async leave(){calls.leave++;emit('left-meeting');},async destroy(){calls.destroy++;emit('left-meeting');},
  };
  return {client:client as unknown as DailyCall,calls,emit};
}
function handlers() {
  const log={connection:[] as string[],errors:[] as string[],participants:0,left:0};
  return {log,events:{connection:(state:string)=>log.connection.push(state),error:(message:string)=>log.errors.push(message),participants:()=>{log.participants++;},left:()=>{log.left++;}}};
}
const credentials={url:'https://test.daily.co/private',token:'scoped-test-token'};

test('meal joins with devices off; media changes only on explicit controls; leave notifies once',async()=>{
  const fake=fakeCall(),h=handlers();let options:DailyFactoryOptions|undefined;
  const session=createMealSession(async o=>{options=o;return fake.client;},credentials,'Alex',h.events);
  await session.ready;
  assert.deepEqual(options,{startVideoOff:true,startAudioOff:true});
  assert.deepEqual(fake.calls.joins,[{...credentials,startVideoOff:true,startAudioOff:true,userName:'Alex'}]);
  assert.deepEqual(fake.calls.audio,[]);assert.deepEqual(fake.calls.video,[]);
  session.audio(true);session.video(true);assert.deepEqual(fake.calls.audio,[true]);assert.deepEqual(fake.calls.video,[true]);
  await Promise.all([session.leave(),session.leave()]);assert.equal(h.log.left,1);assert.equal(fake.calls.leave,1);
  session.dispose();session.dispose();assert.equal(fake.calls.destroy,1);
});
test('leaving during SDK import destroys a late client without joining or opening media',async()=>{
  const pending=deferred<DailyCall>(),fake=fakeCall(),h=handlers();
  const session=createMealSession(()=>pending.promise,credentials,'Alex',h.events);
  session.dispose();pending.resolve(fake.client);await session.ready;
  assert.equal(fake.calls.destroy,1);assert.equal(fake.calls.joins.length,0);assert.equal(h.log.left,0);
});
test('late join completion and participant events cannot restore an unmounted room',async()=>{
  const pending=deferred<void>(),fake=fakeCall(pending.promise),h=handlers();
  const session=createMealSession(async()=>fake.client,credentials,'Alex',h.events);
  await Promise.resolve();session.dispose();pending.resolve();await session.ready;
  fake.emit('participant-updated');assert.deepEqual(h.log.connection,['connecting']);assert.equal(h.log.participants,0);assert.equal(fake.calls.destroy,1);
  session.audio(true);session.video(true);assert.deepEqual(fake.calls.audio,[]);assert.deepEqual(fake.calls.video,[]);
});
test('fatal connection errors stop the session and keep retry available without a spurious leave',async()=>{
  const fake=fakeCall(),h=handlers();const session=createMealSession(async()=>fake.client,credentials,'Alex',h.events);await session.ready;
  fake.emit('error');assert.equal(h.log.connection.at(-1),'failed');assert.equal(fake.calls.destroy,1);assert.equal(h.log.left,0);
  const updates=h.log.participants;fake.emit('participant-updated');assert.equal(h.log.participants,updates);
  session.dispose();assert.equal(fake.calls.destroy,1);
});
test('join failures release the client; permission failures leave the room usable',async()=>{
  const fail=Promise.reject(new Error('expired'));fail.catch(()=>{});
  const fake=fakeCall(fail),h=handlers();const session=createMealSession(async()=>fake.client,credentials,'Alex',h.events);await session.ready;
  assert.equal(h.log.connection.at(-1),'failed');assert.equal(fake.calls.destroy,1);
  const next=fakeCall(),other=handlers();const usable=createMealSession(async()=>next.client,credentials,'Alex',other.events);await usable.ready;
  next.emit('camera-error');assert.match(other.log.errors.at(-1)!,/device/);assert.equal(other.log.connection.at(-1),'connected');
  usable.audio(true);assert.deepEqual(next.calls.audio,[true]);usable.dispose();
});

test('camera switching prefers the opposite facing mode and stops after disposal', async () => {
  const fake = fakeCall(), h = handlers();
  const requests: unknown[] = [];
  fake.client.cycleCamera = async options => { requests.push(options); return { device: null }; };
  const session = createMealSession(async () => fake.client, credentials, 'Alex', h.events);
  await session.ready;
  await session.flipCamera();
  assert.deepEqual(requests, [{ preferDifferentFacingMode: true }]);
  session.dispose();
  await session.flipCamera();
  assert.equal(requests.length, 1);
});
