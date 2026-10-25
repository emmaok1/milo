"use client";
import { useState } from "react";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { Companion } from "./illustrations";

export default function DigitalMeal({avatar,name,onBack}:{avatar:string;name:string;onBack:()=>void}) {
  const [paused,setPaused]=useState(false);
  return <div className="digital-meal">
    <div className="f-pane-heading"><button aria-label="Back to meal choices" onClick={onBack}><ArrowLeft size={21}/></button><h2>With {name}</h2></div>
    <button type="button" className="digital-meal-scene" data-paused={paused} aria-label={paused ? "Resume eating animation" : "Pause eating animation"} onClick={()=>setPaused(value=>!value)}>
      <span className="digital-meal-sun" aria-hidden="true" /><Companion type={avatar} pose="noodles" />
      <span className="digital-meal-pause">{paused ? <Play size={18}/> : <Pause size={18}/>}</span>
    </button>
  </div>;
}
