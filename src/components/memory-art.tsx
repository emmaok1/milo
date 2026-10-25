import { LockKeyhole, Users, MessagesSquare, BookOpen, BadgeCheck, Bookmark } from "lucide-react";
export default function MemoryArt({kind}:{kind:"private"|"public"|"experiences"|"advice"|"resources"}){
 const blue=kind==="private",yellow=kind==="public";const bg=blue?"#e1effa":yellow?"#fff0bd":kind==="advice"?"#e2edf7":kind==="resources"?"#e5eee6":"#fae6d9";
 const color=blue?"#397fb5":yellow?"#a78324":kind==="advice"?"#557faa":kind==="resources"?"#69866b":"#b88162";
 const Icon=blue?LockKeyhole:yellow?Users:kind==="advice"?BadgeCheck:kind==="resources"?BookOpen:MessagesSquare;
 return <span className={`memory-art ${kind}`} style={{background:bg,color}} role="img" aria-label={kind==="advice"?"Expert advice illustration":`${kind} memory illustration`}><span className="memory-art-paper"><Icon size={34} strokeWidth={1.8}/>{kind==="resources"?<Bookmark size={12}/>:<i/>}</span><span className="memory-art-spark">✦</span></span>;
}
