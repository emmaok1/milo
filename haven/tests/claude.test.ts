import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { generatePlan, streamChat, chatFailure } from "../src/lib/ai";

function setKey(t: TestContext, value: string) {
  const before = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = value;
  t.after(() => {
    if (before === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = before;
  });
}

const plan = {
  title: "Quiet moment",
  task: "Read a page",
  steps: ["Choose a book"],
  days: 7,
  start: "2026-10-24",
  minutes: 5,
};
function message(text: string, stop = "end_turn") {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: [{ type: "text", text }],
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

test("Claude plan request uses native structured output and validates returned data", async (t) => {
  setKey(t, "fictional-test-key");
  let body: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(String(url), "https://api.anthropic.com/v1/messages");
    body = JSON.parse(String(init.body));
    return Response.json(message(JSON.stringify(plan)));
  });
  assert.deepEqual(
    await generatePlan("A fictional quiet moment", plan.start, 7),
    plan,
  );
  assert.equal(
    body.model,
    process.env.ANTHROPIC_PLAN_MODEL || "claude-sonnet-5-5",
  );
  assert.equal(body.max_tokens, 2048);
  assert.deepEqual(body.thinking, { type: "between_tools" });
  assert.equal(
    (body.output_config as { format: { type: string } }).format.type,
    "json_schema",
  );
  assert.equal("store" in body, false);
  assert.equal("temperature" in body, false);
});

test("Claude rejects truncated and schema-invalid plans", async (t) => {
  setKey(t, "fictional-test-key");
  let result = message(JSON.stringify(plan), "max_tokens");
  t.mock.method(globalThis, "fetch", async () => Response.json(result));
  await assert.rejects(
    generatePlan("fictional", plan.start, 7),
    /did not finish/,
  );
  result = message(JSON.stringify({ ...plan, days: 500 }));
  await assert.rejects(
    generatePlan("fictional", plan.start, 7),
    /invalid plan/,
  );
});

function events(stop: string) {
  return [
    {
      type: "message_start",
      message: { ...message(""), content: [], stop_reason: null },
    },
    {
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    },
    {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "I hear you." },
    },
    { type: "content_block_stop", index: 0 },
    {
      type: "message_delta",
      delta: { stop_reason: stop, stop_sequence: null },
      usage: { output_tokens: 4 },
    },
    { type: "message_stop" },
  ]
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");
}

test("Claude SSE streams text and rejects incomplete replies", async (t) => {
  setKey(t, "fictional-test-key");
  let stop = "end_turn";
  t.mock.method(globalThis, "fetch", async (_: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.equal(body.stream, true);
    assert.deepEqual(body.thinking, { type: "between_tools" });
    assert.equal(body.system, "Fictional system prompt");
    return new Response(events(stop), {
      headers: { "content-type": "text/event-stream" },
    });
  });
  async function collect() {
    let text = "";
    for await (const chunk of streamChat("Fictional system prompt", [
      { role: "user", content: "Hello" },
    ]))
      text += chunk;
    return text;
  }
  assert.equal(await collect(), "I hear you.");
  stop = "max_tokens";
  await assert.rejects(collect(), /did not finish/);
});

test("Claude requires its own server key", async (t) => {
  setKey(t, "");
  await assert.rejects(
    generatePlan("fictional", plan.start, 7),
    /ANTHROPIC_API_KEY/,
  );
});

test("Claude propagates cancellation and provider stream errors", async (t) => {
  setKey(t, "fictional-test-key");
  t.mock.method(globalThis, "fetch", async (_: string, init: RequestInit) => {
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return new Response(
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Fictional provider failure"}}\n\n',
      { headers: { "content-type": "text/event-stream" } },
    );
  });
  async function collect(signal?: AbortSignal) {
    for await (const text of streamChat(
      "Fictional",
      [{ role: "user", content: "Hello" }],
      signal,
    )) {
      assert.fail("No text should be emitted: " + text);
    }
  }
  await assert.rejects(collect());
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(collect(controller.signal));
});

const overloadedEvent =
  'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Fictional overload"}}\n\n';

test("Claude retries a transient SSE failure before text without duplicating output", async (t) => {
  setKey(t, "fictional-test-key");
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(++calls === 1 ? overloadedEvent : events("end_turn"), {
        headers: { "content-type": "text/event-stream" },
      }),
  );
  let output = "";
  for await (const chunk of streamChat("Fictional", [
    { role: "user", content: "Hello" },
  ]))
    output += chunk;
  assert.equal(calls, 2);
  assert.equal(output, "I hear you.");
});

test("Claude never automatically retries after showing partial text", async (t) => {
  setKey(t, "fictional-test-key");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(
      events("end_turn").split("event: content_block_stop")[0] +
        overloadedEvent,
      { headers: { "content-type": "text/event-stream" } },
    );
  });
  let output = "";
  await assert.rejects(async () => {
    for await (const chunk of streamChat("Fictional", [
      { role: "user", content: "Hello" },
    ]))
      output += chunk;
  });
  assert.equal(calls, 1);
  assert.equal(output, "I hear you.");
});

test("Chat error classification excludes raw provider messages and credentials", () => {
  const error = new Anthropic.APIError(
    429,
    { message: "fictional-secret-and-chat-text" },
    undefined,
    new Headers({ "request-id": "req_test" }),
    "rate_limit_error",
  );
  const safe = chatFailure(error);
  assert.equal(safe.kind, "rate_limit");
  assert.equal(safe.requestId, "req_test");
  assert.equal(safe.retryStream, false);
  assert(!JSON.stringify(safe).includes("fictional-secret-and-chat-text"));
});
