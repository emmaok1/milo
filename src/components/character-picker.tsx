"use client";
import { characters, type CharacterId } from "@/lib/characters";
import { Companion } from "./illustrations";
export default function CharacterPicker({ value, onChange, disabled = false }: { value: string; onChange: (id: CharacterId) => void; disabled?: boolean }) {
  return <div className="character-picker" role="group" aria-label="Choose your listener">
    {characters.map(c => <button type="button" disabled={disabled} key={c.id} data-character={c.id} aria-pressed={value === c.id} className={value === c.id ? "selected" : ""} onClick={() => onChange(c.id)}>
      <Companion type={c.id}/><strong>{c.label}</strong><span>{c.id === "black_cat" ? "Male voice" : "Female voice"}</span>
    </button>)}
  </div>;
}
