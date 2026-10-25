import {
  Brain, ShieldCheck, CircleHelp, Info, Download, Cat, Palette,
  Heart, Hourglass, Sparkles, Search, Lightbulb, Sprout, Zap, Laugh,
} from "lucide-react";

const icons = {
  companion: { Icon: Cat, color: "#e58c31" },
  appearance: { Icon: Palette, color: "#7b61ce" },
  memory: { Icon: Brain, color: "#19a45b" },
  privacy: { Icon: ShieldCheck, color: "#347fe5" },
  help: { Icon: CircleHelp, color: "#7a66d8" },
  about: { Icon: Info, color: "#3689c9" },
  install: { Icon: Download, color: "#2589de" },
  Gentle: { Icon: Heart, color: "#e16b86" },
  Patient: { Icon: Hourglass, color: "#c78b27" },
  Playful: { Icon: Sparkles, color: "#e39822" },
  Curious: { Icon: Search, color: "#3189df" },
  Reflective: { Icon: Lightbulb, color: "#8b69cf" },
  Encouraging: { Icon: Sprout, color: "#22a161" },
  Direct: { Icon: Zap, color: "#df8540" },
  Humorous: { Icon: Laugh, color: "#dc697b" },
};
export default function SettingsIcon({ name }: { name: keyof typeof icons }) {
  const { Icon, color } = icons[name];
  return <Icon className="s-function-icon" size={25} style={{ color }} strokeWidth={2.3} aria-hidden="true" />;
}
