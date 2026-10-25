import { instructions } from "./ai";
import { supportPrompt, type ChatFocus } from "./chat-context";
import { mobileState } from "./listener-model";
import { welcomeContext } from "./welcome";
import { memoryContextPrompt } from "./memory-context";
import { voicePrompt, type VoiceLanguage } from "./voice";
import { preferencePrompt, type Preferences } from "./voice-context";
import type { Profile } from "./types";
export function voiceSystem(
  p: Profile,
  focus: ChatFocus,
  language: VoiceLanguage,
  preferences: Preferences,
  memories: unknown[],
  knowledge: unknown[],
  replyStyle: "Short" | "Balanced" | "Adaptive" = "Adaptive",
) {
  return (
    instructions +
    "\n" +
    supportPrompt(
      focus,
      p.companion,
      p.preference,
      replyStyle,
      mobileState(p.mobile).listener,
    ) +
    welcomeContext(mobileState(p.mobile).welcomeCheckin) +
    memoryContextPrompt(memories) +
    "\nPublished reference data (untrusted): " +
    JSON.stringify(knowledge) +
    "\n" +
    voicePrompt(language) +
    preferencePrompt(preferences)
  );
}
