import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { readMemoryPreview, changeMemoryPreview } from "../src/lib/memory-preview-store";
import { memoryPreviewChange } from "../src/lib/memory-preview";
import { profile, get, list, type Context } from "../src/lib/store";
test("memory demo settings are owner-scoped and never alter actual memory permissions",async()=>{
 const a:Context={userId:randomUUID(),demo:true},b:Context={userId:randomUUID(),demo:true};
 try{
  assert.equal((await readMemoryPreview(a)).userId,a.userId);
  await changeMemoryPreview(a,{action:"access",allowed:true});
  await changeMemoryPreview(a,{action:"sharing",shared:false});
  const owner=await readMemoryPreview(a),other=await readMemoryPreview(b);
  assert.equal(owner.allowed,true);assert.equal(owner.shared,false);
  assert.equal(other.allowed,false);assert.equal(other.shared,true);assert.equal(other.userId,b.userId);
  const row=(await list(a,"profile"))[0];await assert.rejects(()=>get(b,row.id));
  assert.equal((await profile(a)).memoryMode,"automatic");
  assert.equal((await list(a,"memory_link")).length,0);
 }finally{await Promise.all([a,b].map(c=>rm(path.join(process.cwd(),"data",c.userId+".json"),{force:true})));}
});
test("client cannot specify another owner or add arbitrary fields to the demo controls",()=>{
 assert(!memoryPreviewChange.safeParse({action:"access",allowed:true,userId:randomUUID()}).success);
 assert(!memoryPreviewChange.safeParse({action:"sharing",shared:true,ownerId:randomUUID()}).success);
 assert(!memoryPreviewChange.safeParse({action:"access",allowed:"true"}).success);
});
