import { test } from "node:test";
import assert from "node:assert/strict";
import { SilentMicrophone, TurnDetector } from "../src/lib/silent-microphone";
import { validAudio } from "../src/lib/speech-input";

test("turn detection ignores silence/clicks, then ends a spoken turn after a natural pause", () => {
  const detector = new TurnDetector(); detector.reset(0);
  for (let t = 0; t < 1000; t += 50) assert.equal(detector.update(0.001, t), "idle");
  assert.equal(detector.update(0.08, 1000), "idle");
  assert.equal(detector.update(0.001, 1050), "idle");
  detector.reset(1100);
  for (let t = 1100; t <= 1300; t += 50) detector.update(0.04, t);
  assert.equal(detector.update(0.001, 1900), "speech");
  assert.equal(detector.update(0.001, 2050), "end");
});

test("audio validation rejects text disguised as an audio upload", () => {
  assert(!validAudio(Buffer.from("not audio")));
  assert(validAudio(Buffer.from("RIFF0000WAVE")));
  assert(validAudio(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])));
  assert(validAudio(Buffer.from("0000ftyp")));
});

test("microphone reuse never reacquires permission per turn and hangup releases tracks", async () => {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const oldAudioContext = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  const oldRecorder = Object.getOwnPropertyDescriptor(globalThis, "MediaRecorder");
  let permissions = 0, stops = 0, closes = 0;
  const track = { enabled: true, stop: () => { stops++; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  class Context {
    resume = async () => {};
    close = async () => { closes++; };
    createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
    createAnalyser = () => ({ fftSize: 2048, connect() {}, getFloatTimeDomainData(data: Float32Array) { data.fill(0); } });
    createGain = () => ({ gain: { value: 1 }, connect() {}, disconnect() {} });
  }
  class Recorder {
    static isTypeSupported() { return true; }
    state = "inactive";
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; }
  }
  try {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices: { async getUserMedia() { permissions++; return stream; } } } });
    Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: Context });
    Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: Recorder });
    const mic = new SilentMicrophone(); await mic.open();
    assert.equal(track.enabled, false);
    mic.listen(() => assert.fail("No speech was supplied"), e => { throw e; });
    assert.equal(track.enabled, true);
    mic.pause(); assert.equal(track.enabled, false);
    mic.listen(() => assert.fail("No speech was supplied"), e => { throw e; });
    assert.equal(permissions, 1);
    mic.close(); assert.equal(stops, 1); assert.equal(closes, 1);
  } finally {
    for (const [name, descriptor] of [["navigator", oldNavigator], ["AudioContext", oldAudioContext], ["MediaRecorder", oldRecorder]] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
    }
  }
});
