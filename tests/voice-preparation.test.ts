import test from "node:test";
import assert from "node:assert/strict";
import {
  VoicePreparationStore,
  preparationFingerprint,
} from "../src/lib/voice-preparation";
import { VoicePrepareClient } from "../src/lib/voice-prepare-client";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const collect = async (s: AsyncIterable<string>) => {
  let text = "";
  for await (const x of s) text += x;
  return text;
};
test("prepared work is owner, call, turn, revision and full-context scoped, and consumable only once", async () => {
  const s = new VoicePreparationStore();
  const e = s.reserve("a", "call", "turn", 1, "I would like some company.")!;
  await s.generate(e, "context", async function* () {
    yield "Of course.";
  });
  const signal = new AbortController().signal;
  assert.equal(
    s.claim("b", "call", "turn", 1, e.text, "context", signal),
    undefined,
  );
  assert.equal(
    s.claim("a", "different", "turn", 1, e.text, "context", signal),
    undefined,
  );
  assert.equal(
    s.claim("a", "call", "turn", 2, e.text, "context", signal),
    undefined,
  );
  assert.equal(
    s.claim("a", "call", "turn", 1, "Not that.", "context", signal),
    undefined,
  );
  assert.equal(
    s.claim("a", "call", "turn", 1, e.text, "changed memory", signal),
    undefined,
  );
  const found = s.claim(
    "a",
    "call",
    "turn",
    1,
    "I would like some company",
    "context",
    signal,
  )!;
  assert.equal(await collect(found), "Of course.");
  assert.equal(
    s.claim("a", "call", "turn", 1, e.text, "context", signal),
    undefined,
  );
  assert.equal(s.size(), 0);
  s.clear();
});
test("newer revisions cancel old generation, stale versions cannot replace them, and cancellation fences late generation", async () => {
  const s = new VoicePreparationStore();
  const a = s.reserve("u", "c", "t", 1, "first")!;
  const b = s.reserve("u", "c", "t", 2, "second")!;
  assert(a.abort.signal.aborted);
  assert.equal(s.reserve("u", "c", "t", 1, "late"), null);
  s.cancel("u", "c", "t", 1);
  assert(!b.abort.signal.aborted);
  s.cancel("u", "c", "t", 2);
  assert(b.abort.signal.aborted);
  let invoked = false;
  await s.generate(b, "x", async function* () {
    invoked = true;
    yield "stale";
  });
  assert(!invoked);
  assert.equal(s.size(), 0);
});
test("claimed streams replay available chunks and then yield future chunks; final request abort stops generation", async () => {
  const s = new VoicePreparationStore();
  const e = s.reserve("u", "c", "t", 1, "hello")!;
  let release!: () => void;
  const task = s.generate(e, "x", async function* (signal) {
    yield "First.";
    await new Promise<void>((r) => (release = r));
    if (!signal.aborted) yield " Second.";
  });
  await sleep(1);
  const final = new AbortController();
  const stream = s.claim("u", "c", "t", 1, "hello", "x", final.signal)!;
  const iterator = stream[Symbol.asyncIterator]();
  assert.equal((await iterator.next()).value, "First.");
  final.abort();
  release();
  await task;
  assert((await iterator.next()).done);
  assert(e.abort.signal.aborted);
});
test("failed preparations fall back and context fingerprints distinguish changed memory/history and real meaning", async () => {
  const s = new VoicePreparationStore();
  const e = s.reserve("u", "c", "t", 1, "hello")!;
  await s.generate(e, "x", async function* () {
    throw Error("network");
    yield "unreachable";
  });
  assert.equal(
    s.claim("u", "c", "t", 1, "hello", "x", new AbortController().signal),
    undefined,
  );
  s.clear();
  const f = (text: string) =>
    preparationFingerprint("memory", [{ role: "user", content: text }]);
  assert.equal(f("I don't want advice."), f("I don’t want advice"));
  assert.notEqual(f("I want advice"), f("I don't want advice"));
  assert.notEqual(f("Should I go?"), f("Should I go."));
  assert.notEqual(
    f("Hi"),
    preparationFingerprint("deleted memory", [{ role: "user", content: "Hi" }]),
  );
});
test("interim preparation is debounced, canceled on continuation, handed off only on an exact final, and never speaks", async () => {
  const calls: {
    method: string;
    body: Record<string, unknown>;
    signal?: AbortSignal | null;
  }[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    calls.push({
      method: init!.method!,
      body: JSON.parse(init!.body as string),
      signal: init!.signal,
    });
    return new Response("{}");
  };
  const c = new VoicePrepareClient(() => ({ callId: "call" }), fetcher);
  c.update("I would like some company", "turn");
  await sleep(100);
  c.update("I would like some company please", "turn");
  await sleep(330);
  assert.equal(calls.filter((x) => x.method === "POST").length, 1);
  assert.equal(calls[0].body.text, "I would like some company please");
  c.update("", "turn", "turn.resume");
  assert(calls[0].signal?.aborted);
  assert(calls.some((x) => x.method === "DELETE"));
  c.update("I would like some quiet company", "turn", "turn.eager_end");
  await sleep(65);
  const ref = c.finish("I would like some quiet company.", "turn");
  assert.equal(ref?.revision, 2);
  c.cancel();
  assert(
    !calls.filter((x) => x.method === "POST").at(-1)!.signal?.aborted,
    "Handed-off preparation is not canceled by output reset",
  );
  const d = new VoicePrepareClient(() => ({ callId: "call" }), fetcher);
  d.update("Please give me some advice", "another", "turn.eager_end");
  await sleep(65);
  assert.equal(d.finish("Please do not give me advice", "another"), undefined);
  assert(calls.filter((x) => x.method === "POST").at(-1)!.signal?.aborted);
  d.cancel();
});

test("late failure from a canceled interim request cannot clear the newer preparation", async () => {
  let firstResolve!: (r: Response) => void;
  let count = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    if (init?.method === "POST" && ++count === 1)
      return new Promise<Response>((r) => (firstResolve = r));
    return new Response("{}");
  };
  const client = new VoicePrepareClient(() => ({ callId: "call" }), fetcher);
  client.update("I would like some company", "turn", "turn.eager_end");
  await sleep(65);
  client.update("I would like some quiet company", "turn", "turn.eager_end");
  await sleep(65);
  firstResolve(new Response("{}", { status: 503 }));
  await sleep(1);
  assert.equal(
    client.finish("I would like some quiet company", "turn")?.revision,
    2,
  );
  client.cancel();
});
