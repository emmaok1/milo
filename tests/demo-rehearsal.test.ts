import assert from "node:assert/strict";
import { test } from "node:test";
import { demoRehearsal, rehearsalReply } from "../src/lib/demo-rehearsal";
test("all seven rehearsal lines return exact scripts with punctuation variations",()=>{
  for(const r of demoRehearsal) {
    assert.equal(rehearsalReply(r.input),r.reply);
    assert.equal(rehearsalReply(r.input.replace(/…/g,"...").replace(/[’‘]/g,"'").toUpperCase()),r.reply);
  }
});
test("small recognition omissions work; unrelated and urgent messages never trigger script",()=>{
  assert.equal(rehearsalReply("I kind of want to make myself throw up"),demoRehearsal[0].reply);
  assert.equal(rehearsalReply("What time is it?"),undefined);
  assert.equal(rehearsalReply(demoRehearsal[0].input+" I have chest pain"),undefined);
});
