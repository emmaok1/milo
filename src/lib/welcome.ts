import { z } from "zod";
import type { VoiceLanguage } from "./voice";
export const welcomeQuestions = [
  {
    question: "How are you feeling right now?",
    labels: ["Okay", "Worried", "Sad", "Tired", "Not sure"],
  },
  {
    question: "How has eating been for you today?",
    labels: [
      "Joyful",
      "Okay",
      "Mixed",
      "Tough",
      "don't want to mention",
    ],
  },
  {
    question: "What can I do for you?",
    labels: [
      "Just listen",
      "Chat with me",
      "Eat with me",
    ],
  },
] as const;
const previousEatingAnswers = ["Stressful", "Upsetting", "Mostly okay", "Hard to choose food", "Stress while eating", "Upset after eating", "Haven’t eaten yet"];
const previousSupportAnswers = ["Keep me company while I eat", "Listen to what happened", "Chat about something else", "Company while I am eating", "Help sort out my thoughts", "Contact someone I trust"];
const answer = (index: number) =>
  z
    .string()
    .nullable()
    .refine(
      (value) =>
        value === null ||
        ((welcomeQuestions[index].labels as readonly string[]).includes(value) ||
          (index === 1 && previousEatingAnswers.includes(value)) ||
          (index === 2 && previousSupportAnswers.includes(value))),
    );
export const welcomeAnswersSchema = z.tuple([answer(0), answer(1), answer(2)]);
export type WelcomeAnswers = z.infer<typeof welcomeAnswersSchema>;
export const welcomeCheckinSchema = z
  .object({
    id: z.uuid(),
    answers: welcomeAnswersSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();
export type WelcomeCheckin = z.infer<typeof welcomeCheckinSchema>;
// Interface copy stays English. Only the spoken questions follow the saved language.
const spoken: Record<VoiceLanguage, readonly string[]> = {
  "en-US": ["Welcome home.", ...welcomeQuestions.map((q) => q.question)],
  "zh-CN": [
    "欢迎回家。",
    "你现在心情怎么样？",
    "今天吃东西的感受怎么样？",
    "现在什么会对你有帮助？",
  ],
  "es-ES": [
    "Bienvenida a casa.",
    "¿Cómo te sientes ahora?",
    "¿Cómo te ha ido con la comida hoy?",
    "¿Qué te ayudaría ahora?",
  ],
  "fr-FR": [
    "Bienvenue à la maison.",
    "Comment te sens-tu maintenant ?",
    "Comment se sont passés les repas aujourd’hui ?",
    "Qu’est-ce qui te ferait du bien maintenant ?",
  ],
  "de-DE": [
    "Willkommen zu Hause.",
    "Wie fühlst du dich gerade?",
    "Wie war das Essen heute für dich?",
    "Was würde dir jetzt helfen?",
  ],
  "ja-JP": [
    "おかえりなさい。",
    "今、どんな気分？",
    "今日は食事をしていて、どんな感じだった？",
    "今、どんなことが助けになりそう？",
  ],
  "ko-KR": [
    "집에 온 걸 환영해요.",
    "지금 기분이 어때요?",
    "오늘 식사는 어땠어요?",
    "지금 무엇이 도움이 될까요?",
  ],
  "pt-BR": [
    "Que bom ter você em casa.",
    "Como você está se sentindo agora?",
    "Como foi comer hoje para você?",
    "O que ajudaria agora?",
  ],
  "hi-IN": [
    "घर में स्वागत है।",
    "अभी आप कैसा महसूस कर रहे हैं?",
    "आज खाने का अनुभव कैसा रहा?",
    "अभी किस चीज़ से मदद मिलेगी?",
  ],
  "ar-SA": [
    "أهلاً بعودتك إلى المنزل.",
    "كيف تشعر الآن؟",
    "كيف كان تناول الطعام بالنسبة لك اليوم؟",
    "ما الذي قد يساعدك الآن؟",
  ],
};
export function welcomeName(value?: string) {
  return (value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}
export function welcomeGreeting(name?: string) {
  const safe = welcomeName(name);
  return safe ? `Welcome home, ${safe}!` : "Welcome home!";
}
export function welcomeSpeech(
  language: VoiceLanguage,
  step: number,
  name?: string,
) {
  const safe = welcomeName(name);
  return step === 0
    ? safe
      ? `Welcome home, ${safe}. Meow.`
      : "Welcome home. Meow."
    : spoken[language][step];
}
export function welcomeContext(raw: unknown, now = Date.now()) {
  const result = welcomeCheckinSchema.safeParse(raw);
  if (
    !result.success ||
    now - Date.parse(result.data.createdAt) > 24 * 60 * 60 * 1000 ||
    now < Date.parse(result.data.createdAt)
  )
    return "";
  if (result.data.answers.every((value) => value === null)) return "";
  return (
    "\nRecent user check-in (temporary context, not long-term memory; skipped answers mean unknown): " +
    JSON.stringify(
      result.data.answers.map((answer, i) => ({
        question: welcomeQuestions[i].question,
        answer,
      })),
    ) +
    ". Use only when relevant, do not diagnose or repeatedly mention it. A request to contact someone is a preference, not authorization to send messages."
  );
}
