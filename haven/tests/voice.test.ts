import assert from "node:assert/strict";
import { test } from "node:test";
import { takeSpeech, speechText, chooseVoice } from "../src/lib/voice";

test("streamed speech emits complete Chinese and English sentences without dropping the tail", () => {
  let rest = "";
  const sentences: string[] = [];
  for (const token of [
    "你好",
    "。我",
    "在这里。",
    " Take",
    " your time",
    ". What",
    " would help",
  ]) {
    const result = takeSpeech(rest + token);
    sentences.push(...result.sentences);
    rest = result.rest;
  }
  assert.deepEqual(sentences, ["你好。", "我在这里。", "Take your time."]);
  assert.equal(rest, "What would help");
  assert.deepEqual(takeSpeech(rest, true), {
    sentences: ["What would help"],
    rest: "",
  });
});
test("long unpunctuated speech has bounded chunks and preserves every character", () => {
  const input = "慢".repeat(800);
  const result = takeSpeech(input, true);
  assert(result.sentences.every((s) => s.length <= 220));
  assert.equal(result.sentences.join(""), input);
  assert.equal(result.rest, "");
});
test("speech never reads Markdown link destinations or code fences aloud", () => {
  assert.equal(
    speechText("**Hello** [friend](https://example.com)"),
    "Hello friend",
  );
  assert(!speechText("```js\nsecret()\n```").includes("secret"));
  assert.deepEqual(takeSpeech("", true), { sentences: [], rest: "" });
});

test("only the first audio segment can start at a sufficiently long natural clause", () => {
  const phrase = "今天已经忙了整整一整天很辛苦，先坐下来歇一会儿";
  const early = takeSpeech(phrase, false, true);
  assert.deepEqual(early.sentences, ["今天已经忙了整整一整天很辛苦，"]);
  assert.equal(early.rest, "先坐下来歇一会儿");
  assert.equal(takeSpeech(phrase).sentences.length, 0);
  assert.equal(takeSpeech("嗯，好", false, true).sentences.length, 0);
  assert.equal(
    takeSpeech("The value is 3.5 and the reply continues", false, true)
      .sentences.length,
    0,
  );
});

test("voice selection respects language and explicit choice, with a local default", () => {
  const local = {
    voiceURI: "local",
    name: "Mandarin",
    lang: "zh-CN",
    localService: true,
    default: true,
  };
  const online = {
    ...local,
    voiceURI: "online",
    name: "Natural online",
    localService: false,
  };
  const enhanced = { ...local, voiceURI: "enhanced", name: "Premium Mandarin" };
  const english = { ...local, voiceURI: "en", lang: "en-US" };
  const voices = [online, english, local, enhanced];
  assert.equal(chooseVoice(voices, "zh-CN"), enhanced);
  assert.equal(chooseVoice(voices, "zh-CN", "online"), online);
  assert.equal(chooseVoice(voices, "zh-CN", "en"), enhanced);
  assert.equal(chooseVoice(voices, "fr-FR"), undefined);
  assert.deepEqual(voices, [online, english, local, enhanced]);
});
