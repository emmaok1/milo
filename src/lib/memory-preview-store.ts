import { profile, setProfile, type Context } from "./store";
import { memoryPreviewSamples, type MemoryPreview, memoryPreviewChange } from "./memory-preview";
/** Account-bound presentation samples. Never read real memories or grant real AI/group access. */
export async function readMemoryPreview(c:Context):Promise<MemoryPreview>{
 const p=await profile(c);
 return {userId:c.userId, allowed:p.memoryPreview?.allowed===true,shared:p.memoryPreview?.shared??true,...memoryPreviewSamples};
}
export async function changeMemoryPreview(c:Context,input:unknown){
 const change=memoryPreviewChange.parse(input);
 const state=await readMemoryPreview(c);
 await setProfile(c,{memoryPreview:{allowed:change.action==="access"?change.allowed:state.allowed,shared:change.action==="sharing"?change.shared:state.shared}});
 return readMemoryPreview(c);
}
