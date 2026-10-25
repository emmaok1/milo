"use client";
import { useEffect, useRef, useState } from "react";
import MealCallLayout from "./meal-call-layout";
import { demoFriendUser, demoNina } from "@/lib/friends-demo";

export default function DemoMealVideo({ name, onLeave }: { name:string;onLeave:()=>void }) {
  const [camera,setCamera]=useState(false),[muted,setMuted]=useState(true),[error,setError]=useState(''),[track,setTrack]=useState<MediaStreamTrack>();
  const stream=useRef<MediaStream|null>(null),generation=useRef(0),facing=useRef<"user"|"environment">("user");
  useEffect(()=>()=>{generation.current++;stream.current?.getTracks().forEach(t=>t.stop());},[]);
  async function toggleCamera(){
    if(stream.current){generation.current++;stream.current.getTracks().forEach(t=>t.stop());stream.current=null;setCamera(false);setTrack(undefined);return;}
    const epoch=++generation.current;
    try{
      const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing.current},audio:false});
      if(epoch!==generation.current){next.getTracks().forEach(t=>t.stop());return;}
      stream.current=next;setTrack(next.getVideoTracks()[0]);setCamera(true);setError('');
    }catch{setError("Camera preview isn't available.");}
  }
  async function flipCamera() {
    const previous = facing.current;
    facing.current = previous === "user" ? "environment" : "user";
    const epoch = ++generation.current;
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null; setTrack(undefined); setCamera(false);
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing.current } }, audio: false });
      if (epoch !== generation.current) { next.getTracks().forEach(t => t.stop()); return; }
      stream.current = next; setTrack(next.getVideoTracks()[0]); setCamera(true); setError("");
    } catch {
      facing.current = previous;
      setError("That camera isn't available. Turn your camera on to try again.");
    }
  }
  return <MealCallLayout preview connection="connected" error={error}
    participants={[{id:demoNina,name:'Nina',local:false,videoOn:false,audioOn:false},{id:demoFriendUser,name,local:true,videoOn:camera,audioOn:!muted,videoTrack:track}]}
    onFlip={flipCamera}
    onAudio={()=>setMuted(value=>!value)} onVideo={()=>void toggleCamera()} onLeave={onLeave} />;
}
