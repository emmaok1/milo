import type { DailyCall, DailyFactoryOptions, DailyParticipant } from "@daily-co/daily-js";

type CallHandlers = {
  participants: (people: DailyParticipant[]) => void;
  connection: (state: "connecting" | "connected" | "failed") => void;
  error: (message: string) => void;
  left: () => void;
};
/** Owns one SDK session, including asynchronous creation, media and teardown. */
export function createMealSession(factory: (options: DailyFactoryOptions) => Promise<DailyCall>, credentials: { url: string; token: string }, nickname: string, handlers: CallHandlers) {
  let call: DailyCall | undefined, disposed=false, failed=false, left=false, leaving=false, destroyed=false;
  const destroy=()=>{if(call&&!destroyed){destroyed=true;void call.destroy().catch(()=>{});}};
  const notifyLeave=()=>{if(!disposed&&!left){left=true;handlers.left();}};
  const sync=()=>{if(call&&!disposed&&!failed)handlers.participants(Object.values(call.participants()));};
  const fail=(message:string)=>{if(!disposed&&!failed){failed=true;handlers.connection('failed');handlers.error(message);destroy();}};
  handlers.connection('connecting');
  const ready=(async()=>{
    try{
      call=await factory({startVideoOff:true,startAudioOff:true});
      if(disposed){destroy();return;}
      call.on('participant-joined',sync).on('participant-updated',sync).on('participant-left',sync).on('track-started',sync).on('track-stopped',sync);
      call.on('joined-meeting',()=>{if(!disposed&&!failed){handlers.connection('connected');handlers.error('');sync();}});
      call.on('left-meeting',()=>{if(!failed)notifyLeave();});
      call.on('error',()=>fail('The connection dropped. You can try again.'));
      call.on('camera-error',()=>{if(!disposed)handlers.error("That device isn't available. Check its permission and try again.");});
      await call.join({url:credentials.url,token:credentials.token,startVideoOff:true,startAudioOff:true,userName:nickname});
      if(!disposed&&!failed){handlers.connection('connected');sync();}
    }catch{fail("Couldn't join the table. Please try again.");}
  })();
  return {
    ready,
    audio(enabled:boolean){if(!disposed&&!failed&&call){try{call.setLocalAudio(enabled);}catch{handlers.error("The microphone isn't available. Please try again.");}}},
    video(enabled:boolean){if(!disposed&&!failed&&call){try{call.setLocalVideo(enabled);}catch{handlers.error("The camera isn't available. Please try again.");}}},
    async flipCamera(){if(disposed||failed||!call)return;await call.cycleCamera({preferDifferentFacingMode:true});},
    async leave(){if(disposed||leaving)return;leaving=true;try{await call?.leave();}catch{}finally{notifyLeave();}},
    dispose(){if(!disposed){disposed=true;destroy();}},
  };
}
