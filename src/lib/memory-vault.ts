import { randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { AppError, list, insert, update, type Context } from "./store";
const type="memory_preview_vault";
const digest=(text:string)=>createHash("sha256").update(text).digest("hex");
async function row(c:Context){return (await list(c,"access_event")).find(r=>r.data.type===type);}
export function encodeVaultKey(key:string,salt=randomBytes(16).toString("hex")){return {salt,hash:scryptSync(key,salt,32).toString("hex")};}
export function matchesVaultKey(key:string,salt:string,hash:string){const expected=Buffer.from(hash,"hex");return expected.length===32&&timingSafeEqual(scryptSync(key,salt,32),expected);}
export async function vaultStatus(c:Context,token?:string){const r=await row(c);const keyRequired=process.env.MEMORY_PREVIEW_KEY_REQUIRED!=="false";return {hasKey:!!r,keyRequired,unlocked:!keyRequired||(!!r&&!!token&&Number(r.data.expiresAt)>Date.now()&&r.data.tokenHash===digest(token))};}
export async function unlockVault(c:Context,key:string,setup:boolean){
 const r=await row(c);
 if(setup&&r)throw new AppError(409,"A key is already set. Please unlock.");
 if(!setup&&!r)throw new AppError(409,"Set your personal key first.");
 if(r&&Number(r.data.blockedUntil)>Date.now())throw new AppError(429,"Please wait a minute before trying again.");
 if(r&&!matchesVaultKey(key,String(r.data.salt),String(r.data.hash))){const failures=Number(r.data.failures||0)+1;await update(c,r.id,{failures,blockedUntil:failures>=5?Date.now()+60000:0},r.version);throw new AppError(403,"Incorrect key.");}
 const token=randomBytes(32).toString("base64url");
 const data={type,...(r?{}:encodeVaultKey(key)),tokenHash:digest(token),expiresAt:Date.now()+600000,failures:0,blockedUntil:0};
 if(r)await update(c,r.id,data,r.version);else {const h=digest(type+c.userId);const id:ReturnType<typeof import("node:crypto").randomUUID>=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;await insert(c,"access_event",data,null,id);}
 return token;
}
export async function lockVault(c:Context){const r=await row(c);if(r)await update(c,r.id,{tokenHash:null,expiresAt:0},r.version);}
