"use client";
import { useEffect, useRef, useState } from "react";
import type { DailyParticipant } from "@daily-co/daily-js";
import { createMealSession } from "@/lib/meal-call-session";
import MealCallLayout, { type MealParticipant } from "./meal-call-layout";

function person(participant: DailyParticipant, nickname: string): MealParticipant {
  const video=participant.tracks.video, audio=participant.tracks.audio;
  return { id:participant.session_id, name:participant.user_name || (participant.local ? nickname : "Friend"), local:participant.local,
    videoOn:video.state==='playable', audioOn:audio.state==='playable' || (participant.local && audio.state==='sendable'),
    videoTrack:video.state==='playable' ? video.persistentTrack || video.track : undefined,
    audioTrack:audio.state==='playable' ? audio.persistentTrack || audio.track : undefined };
}
export default function MealVideo({ credentials, nickname, onLeave, onError, onReconnect }: {
  credentials:{url:string;token:string};nickname:string;onLeave:()=>void;onError:(message:string)=>void;onReconnect?:()=>Promise<void>;
}) {
  const [participants,setParticipants]=useState<MealParticipant[]>([]),
    [connection,setConnection]=useState<"connecting"|"connected"|"failed">("connecting"),
    [error,setError]=useState(""), [attempt,setAttempt]=useState(0);
  const session=useRef<ReturnType<typeof createMealSession>|null>(null),callbacks=useRef({onLeave,onError});
  useEffect(()=>{callbacks.current={onLeave,onError};},[onLeave,onError]);
  useEffect(()=>{
    setError('');setParticipants([]);
    const next=createMealSession(async options=>{
      const {default:Daily}=await import('@daily-co/daily-js');
      return Daily.createCallObject(options);
    },{url:credentials.url,token:credentials.token},nickname,{
      participants: people=>setParticipants(people.map(p=>person(p,nickname))),
      connection:setConnection,
      error:message=>{setError(message);if(!message)callbacks.current.onError('');},
      left:()=>callbacks.current.onLeave(),
    });
    session.current=next;
    return()=>{if(session.current===next)session.current=null;next.dispose();};
  },[credentials.url,credentials.token,nickname,attempt]);
  const local=participants.find(p=>p.local);
  const people=local?participants:[...participants,{id:'local',name:nickname,local:true,videoOn:false,audioOn:false}];
  return <MealCallLayout participants={people} connection={connection} error={error}
    onAudio={()=>{setError('');session.current?.audio(!local?.audioOn);}}
    onVideo={()=>{setError('');session.current?.video(!local?.videoOn);}}
    onFlip={async()=>{await session.current?.flipCamera();}}
    onRetry={()=>{if(onReconnect)void onReconnect();else setAttempt(n=>n+1);}}
    onLeave={()=>{void session.current?.leave();}} />;
}
