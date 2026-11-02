export type ContextTurn = {
  role: string;
  text: string;
  responseId?: string;
  playbackState?: string;
};
export type Preferences = {
  noQuestions: boolean;
  noAdvice: boolean;
  quiet: boolean;
  avoidFood: boolean;
  avoidBody: boolean;
  noAnalysis: boolean;
};
export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
// A conservative bypass gate, not a clinical safety classifier. Uncertainty goes to Claude.
export function sensitiveContext(text: string) {
  return /\b(faint\w*|dizz\w*|lightheaded|light headed|chest\s+(?:pain|tightness)|blood|passed? out|pass out|collapse\w*|unconscious|dehydrat\w*|seizure\w*|overdos\w*|poison\w*|palpitation\w*|heart\s+(?:racing|races|racing)|racing heart|suicid\w*|self[ -]?harm\w*|kill\s+(?:myself|me)|hurt\s+myself|end\s+my\s+life|want\s+to\s+die|don't\s+want\s+to\s+(?:live|be alive)|purge\w*|purging|vomit\w*|throw\s+up|laxative\w*|diuretic\w*|compensat\w*|fasting|restrict\w*|starv\w*|calori\w*|weight[\s-]*(?:loss|limit|goal)|lose\s+weight|burn\s+(?:off|calori\w*)|diagnos\w*|medicat\w*|dosage|prescription|bmi|blood\s+sugar|blood\s+pressure|numb\w*|severe\s+pain|emergency)\b|(?:can't|cannot|can not|trouble|difficulty)\s+(?:breathe|breathing|swallow\w*)|how\s+(?:little|much|many).{0,25}(?:eat|weigh)|(?:make|force).{0,12}(?:sick|vomit)|exercise.{0,25}(?:undo|compensate|burn off)|(?:not|haven't|have not).{0,10}eaten.{0,15}(?:days|week)/i.test(
    text,
  );
}
export function preferencesFor(
  history: ContextTurn[],
  preference = "",
  initial?: Preferences,
): Preferences {
  const p: Preferences = {
    noQuestions: false,
    noAdvice: /no advice|listen only/i.test(preference),
    quiet: false,
    avoidFood: false,
    avoidBody: false,
    noAnalysis: false,
    ...initial,
  };
  for (const turn of history.filter((t) => t.role === "user")) {
    const t = normalize(turn.text);
    if (/(?:don't|do not|no more|without).{0,24}questions|stop asking/.test(t))
      p.noQuestions = true;
    if (
      /(?:you can|please|it's okay to) ask (?:me )?questions|ask me (?:an? )?(?:easy|simple) question/.test(
        t,
      )
    )
      p.noQuestions = false;
    if (
      /(?:don't|do not).{0,16}advice|just listen|without (?:giving )?advice/.test(
        t,
      )
    )
      p.noAdvice = true;
    if (/(?:i want|please give me|i would like) (?:some |your )?advice/.test(t))
      p.noAdvice = false;
    if (/quiet company|without talking|in silence/.test(t)) {
      p.quiet = true;
      p.noQuestions = true;
    }
    if (
      /(?:let's|can we) (?:talk|chat)|ask me (?:an? )?(?:easy|simple) question/.test(
        t,
      )
    )
      p.quiet = false;
    if (/(?:don't|do not) want to (?:talk|chat) about food/.test(t))
      p.avoidFood = true;
    if (/(?:don't|do not) want to (?:talk|chat) about my body/.test(t))
      p.avoidBody = true;
    if (/(?:i want|let's|can we) (?:to )?(?:talk|chat) about food/.test(t))
      p.avoidFood = false;
    if (/(?:i want|let's|can we) (?:to )?(?:talk|chat) about my body/.test(t))
      p.avoidBody = false;
    if (/(?:don't|do not) want to (?:analyze|analyse)/.test(t))
      p.noAnalysis = true;
  }
  return p;
}
export function preferencePrompt(p: Preferences) {
  return (
    "\nCurrent conversation communication preferences (respect until the user explicitly changes them): " +
    JSON.stringify(p) +
    ". noQuestions means no questions or requests to explain/elaborate. quiet means acknowledge briefly and leave space; never fill silence. noAdvice means listen without suggestions. avoidFood/avoidBody mean do not introduce that topic. noAnalysis means do not probe reasons. Safety instructions still take priority."
  );
}

/** Preserve the existing safety bypass; every turn now uses contextual generation. */
export function contextualVoiceDecision(
  input: string,
  history: ContextTurn[] = [],
) {
  const start = performance.now();
  const sensitive =
    sensitiveContext(input) ||
    history
      .filter((t) => t.role === "user")
      .slice(-4)
      .some((t) => sensitiveContext(t.text));
  return {
    path: sensitive ? ("safety" as const) : ("claude" as const),
    reason: sensitive ? "sensitive_context" : "contextual_only",
    routerMs: performance.now() - start,
  };
}
