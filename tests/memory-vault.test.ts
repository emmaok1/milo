import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {rm} from "node:fs/promises";
import path from "node:path";
import {unlockVault,lockVault,vaultStatus,encodeVaultKey,matchesVaultKey} from "../src/lib/memory-vault";
import {list,type Context} from "../src/lib/store";
test("personal keys are salted hashes, account-bound, and revoked on lock",async()=>{
 const a:Context={userId:randomUUID(),demo:true},b:Context={userId:randomUUID(),demo:true};
 try{
  const hash=encodeVaultKey("example-key");assert(matchesVaultKey("example-key",hash.salt,hash.hash));assert(!matchesVaultKey("incorrect",hash.salt,hash.hash));assert.notEqual(hash.hash,encodeVaultKey("example-key").hash);
  const token=await unlockVault(a,"example-key",true);assert((await vaultStatus(a,token)).unlocked);assert(!(await vaultStatus(b,token)).unlocked);
  await assert.rejects(()=>unlockVault(a,"wrong-key",false),/Incorrect key/);
  await assert.rejects(()=>unlockVault(a,"replacement-key",true),/already set/);
  assert(!JSON.stringify(await list(a,"access_event")).includes("example-key"));
  await lockVault(a);assert(!(await vaultStatus(a,token)).unlocked);
  const next=await unlockVault(a,"example-key",false);assert((await vaultStatus(a,next)).unlocked);assert(!(await vaultStatus(a,token)).unlocked);
 }finally{await Promise.all([a,b].map(c=>rm(path.join(process.cwd(),"data",c.userId+".json"),{force:true})));}
});
test("repeated wrong keys are rate limited",async()=>{const c:Context={userId:randomUUID(),demo:true};try{await unlockVault(c,"example-key",true);for(let i=0;i<5;i++)await assert.rejects(()=>unlockVault(c,"wrong-key",false),/Incorrect key/);await assert.rejects(()=>unlockVault(c,"example-key",false),/wait a minute/);}finally{await rm(path.join(process.cwd(),"data",c.userId+".json"),{force:true});}});
test("temporary key bypass preserves the saved key and can be reversed",async()=>{
 const c:Context={userId:randomUUID(),demo:true};const before=process.env.MEMORY_PREVIEW_KEY_REQUIRED;
 try{
  process.env.MEMORY_PREVIEW_KEY_REQUIRED="true";
  await unlockVault(c,"example-key",true);await lockVault(c);
  const saved=await list(c,"access_event");
  assert.equal((await vaultStatus(c)).unlocked,false);
  process.env.MEMORY_PREVIEW_KEY_REQUIRED="false";
  assert.equal((await vaultStatus(c)).unlocked,true);
  assert.equal((await vaultStatus(c)).keyRequired,false);
  assert.deepEqual(await list(c,"access_event"),saved);
  process.env.MEMORY_PREVIEW_KEY_REQUIRED="true";
  assert.equal((await vaultStatus(c)).unlocked,false);
  const token=await unlockVault(c,"example-key",false);
  assert.equal((await vaultStatus(c,token)).unlocked,true);
 }finally{
  if(before===undefined)delete process.env.MEMORY_PREVIEW_KEY_REQUIRED;else process.env.MEMORY_PREVIEW_KEY_REQUIRED=before;
  await rm(path.join(process.cwd(),"data",c.userId+".json"),{force:true});
 }
});
