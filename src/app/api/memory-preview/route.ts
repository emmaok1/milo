import { z } from "zod";
import { cookies } from "next/headers";
import { AppError, assertOrigin, context } from "@/lib/store";
import { readMemoryPreview, changeMemoryPreview } from "@/lib/memory-preview-store";
import { unlockVault,lockVault,vaultStatus } from "@/lib/memory-vault";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
const cookie="milo_memory_unlock";
const keyAction=z.object({action:z.enum(["setup-key","unlock"]),key:z.string().min(8).max(128)}).strict();
function failure(e:unknown){const status=e instanceof AppError?e.status:e instanceof z.ZodError||e instanceof SyntaxError?400:503;return Response.json({error:e instanceof AppError?e.message:status===400?"Please check your request.":"Memory preview is unavailable. Please retry."},{status,headers});}
async function owner(req:Request){if(new URL(req.url).search)throw new AppError(400,"Account selection is not supported.");const c=await context("memory-preview","manage");if(c.demo)throw new AppError(401,"Sign in with your own account to open Memory.");return c;}
async function snapshot(c:Awaited<ReturnType<typeof owner>>){const status=await vaultStatus(c,(await cookies()).get(cookie)?.value);const state=await readMemoryPreview(c);return {...state,...status,privateMemories:status.unlocked?state.privateMemories:[]};}
export async function GET(req:Request){try{return Response.json(await snapshot(await owner(req)),{headers});}catch(e){return failure(e);}}
export async function PATCH(req:Request){try{
 assertOrigin(req);const c=await owner(req);const text=await req.text();if(text.length>500)throw new AppError(413,"Request too large.");const body=JSON.parse(text);
 if(body.action==="setup-key"||body.action==="unlock"){
  const action=keyAction.parse(body);const token=await unlockVault(c,action.key,action.action==="setup-key");
  (await cookies()).set(cookie,token,{httpOnly:true,sameSite:"strict",secure:new URL(req.url).protocol==="https:",path:"/api/memory-preview",maxAge:600});
 }else if(body.action==="lock"){
  z.object({action:z.literal("lock")}).strict().parse(body);await lockVault(c);(await cookies()).delete({name:cookie,path:"/api/memory-preview"});
 }else{
  if(body.action==="access"&&!(await vaultStatus(c,(await cookies()).get(cookie)?.value)).unlocked)throw new AppError(403,"Unlock Private Memory first.");
  await changeMemoryPreview(c,body);
 }
 return Response.json(await snapshot(c),{headers});
}catch(e){return failure(e);}}
