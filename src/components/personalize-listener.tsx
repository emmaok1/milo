"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, LoaderCircle } from "lucide-react";
import { api } from "@/lib/client";
import { mobileState, listenerTraits, listenerStyleNotes, type Listener } from "@/lib/listener-model";
import type { Profile } from "@/lib/types";
import CharacterPicker from "./character-picker";
import SettingsIcon from "./settings-icon";
import { characterId, type CharacterId } from "@/lib/characters";
import { voiceLanguageCodes, voiceLanguageNames, type VoiceLanguage } from "@/lib/voice";

export default function PersonalizeListener({ profile, refresh }: { profile: Profile; refresh: () => Promise<void> }) {
  const listener = mobileState(profile.mobile, profile.companion).listener;
  const [character, setCharacter] = useState<CharacterId>(characterId(listener));
  const [language, setLanguage] = useState<VoiceLanguage>(listener.language);
  const [name, setName] = useState(listener.name);
  const [traits, setTraits] = useState<Listener["traits"]>(listener.traits);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const welcome = useSearchParams().get("welcome") === "1";
  async function save() {
    setBusy(true); setError("");
    try {
      await api("mobile", "POST", { action: "personalize-listener", value: { character, name: name.trim(), language, traits } });
      await refresh();
      router.replace(welcome ? "/welcome" : "/settings");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="personalize-page">
    <header><Link href={welcome ? "/onboarding" : "/settings"}><ArrowLeft size={19}/> Back</Link><span>MILO</span></header>
    <section className="personalize-card">
      <h1>Companion</h1>
      <form onSubmit={e => { e.preventDefault(); void save(); }}>
        <fieldset className="personalize-cats" disabled={busy}><legend className="sr-only">Cat</legend><CharacterPicker value={character} onChange={setCharacter} disabled={busy}/></fieldset>
        <label className="personalize-name" htmlFor="companion-name">Companion name</label>
        <input id="companion-name" autoComplete="off" maxLength={30} required value={name} disabled={busy} onChange={e => setName(e.target.value)} placeholder={listener.name}/>
        <label className="personalize-name personalize-language-label" htmlFor="companion-language">Language</label>
        <select id="companion-language" value={language} disabled={busy} onChange={e => setLanguage(e.target.value as VoiceLanguage)}>{voiceLanguageCodes.map(code => <option key={code} value={code}>{voiceLanguageNames[code]}</option>)}</select>
        <fieldset disabled={busy}>
          <legend>Style</legend>
          <div className="personalize-styles">
            {listenerTraits.map(trait => {
              const selected = traits.includes(trait);
              return <button key={trait} type="button" aria-pressed={selected} className={selected ? "selected" : ""} disabled={!selected && traits.length >= 4} onClick={() => setTraits(old => selected ? old.filter(t => t !== trait) : [...old, trait])}>
                <span><SettingsIcon name={trait}/><strong>{trait}</strong>{selected && <Check size={16}/>}</span><small>{listenerStyleNotes[trait]}</small>
              </button>;
            })}
          </div>
        </fieldset>
        {error && <p className="personalize-error" role="alert">{error}</p>}
        <button className="button primary personalize-save" disabled={busy || !name.trim() || !traits.length}>{busy ? <LoaderCircle size={17}/> : null}{busy ? "Saving…" : welcome ? "Save and continue" : "Save changes"}</button>
        <p className="personalize-footnote">Your cat’s voice is fixed. Start a new call after changing your cat or language.</p>
      </form>
    </section>
  </main>;
}
