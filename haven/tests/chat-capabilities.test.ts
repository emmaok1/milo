import assert from "node:assert/strict";
import { test } from "node:test";
import { chatFocus, supportPrompt } from "../src/lib/chat-context";
import {
  imageBlocks,
  userContent,
  conversationMessages,
} from "../src/lib/chat-images";

test("conversation spaces have distinct server-owned guidance", () => {
  assert.match(chatFocus.after_eating.prompt, /calories/);
  assert.match(chatFocus.self_kindness.prompt, /negative belief/);
  assert.match(chatFocus.listening.prompt, /Do not offer exercises/);
  assert.match(
    supportPrompt("listening", "white_cat", "Listen first", "Adaptive"),
    /Luna/,
  );
  assert.match(
    supportPrompt("open", "dog", "Listen first", "Adaptive"),
    /do not impose a fixed sentence limit/,
  );
});

test("image requests validate actual media headers, size, and count", () => {
  const png = {
    name: "fictional.png",
    url:
      "data:image/png;base64," +
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64"),
  };
  const blocks = imageBlocks([png]);
  assert.equal(blocks[0].source.type, "base64");
  assert.equal(userContent("hello"), "hello");
  assert.equal(userContent("look", [png]).length, 2);
  assert.throws(
    () =>
      imageBlocks([
        { name: "fake.png", url: "data:image/png;base64,aGVsbG8=" },
      ]),
    /format/,
  );
  assert.throws(
    () =>
      imageBlocks([{ name: "remote.png", url: "https://localhost/private" }]),
    /JPEG/,
  );
  assert.throws(() => imageBlocks([png, png, png]), /two images/);
  assert.throws(
    () =>
      imageBlocks([
        {
          name: "large.png",
          url:
            "data:image/png;base64," + Buffer.alloc(1500001).toString("base64"),
        },
      ]),
    /1.5 MB/,
  );
});

test("public web research excludes private conversation history", () => {
  const prior = {
    id: "test",
    user_id: "test",
    kind: "message" as const,
    parent_id: null,
    version: 1,
    created_at: "",
    updated_at: "",
    data: { role: "user", text: "private-canary" },
  };
  const messages = conversationMessages([prior], "public question", [], true);
  assert.equal(messages.length, 1);
  assert(!JSON.stringify(messages).includes("private-canary"));
  assert.equal(conversationMessages([prior], "follow up", [], false).length, 2);
});
