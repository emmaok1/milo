import {
  quickResponses,
  quickResponseById,
  type QuickResponse,
} from "./library";
export * from "../voice-context";
import {
  normalize,
  sensitiveContext,
  preferencesFor,
  type ContextTurn,
  type Preferences,
} from "../voice-context";
export type RouteDecision = {
  path: "prerecorded" | "claude" | "safety";
  reason: string;
  response?: QuickResponse;
  candidateId?: string;
  routerMs: number;
  intent?: string;
};
export function routeQuickResponse(
  input: string,
  context: {
    history?: ContextTurn[];
    recentIds?: string[];
    language?: string;
    preference?: string;
    availableIds?: Set<string>;
    initialPreferences?: Preferences;
  } = {},
): RouteDecision {
  const start = performance.now();
  const history = context.history || [];
  const text = normalize(input);
  const done = (
    path: RouteDecision["path"],
    reason: string,
    response?: QuickResponse,
    candidateId?: string,
  ): RouteDecision => ({
    path,
    reason,
    response,
    candidateId,
    intent: response?.intent,
    routerMs: performance.now() - start,
  });
  if (
    sensitiveContext(input) ||
    history
      .filter((t) => t.role === "user")
      .slice(-4)
      .some((t) => sensitiveContext(t.text))
  )
    return done("safety", "sensitive_context");
  if (context.language && context.language !== "en-US")
    return done("claude", "unsupported_language");
  if (
    input.length > 220 ||
    /["“”]|(?:^|\s)'[^']{3,}'/.test(input) ||
    /\b(if|hypothetical|imagine|suppose|used to|yesterday|last week|last year|previously|earlier|no longer|was feeling|felt|my friend|she says|he says|they say|you said|someone said|but|also|except|answer this|already asked|just answered)\b/i.test(
      input,
    )
  )
    return done("claude", "ambiguous_or_complex");
  const matches = quickResponses.filter(
    (r) =>
      r.autoRouteEnabled &&
      r.matchingRules.requiredPhrases.every((group) =>
        group.some((phrase) => text.includes(phrase)),
      ) &&
      r.matchingRules.patterns.some((pattern) =>
        new RegExp("^(?:" + pattern + ")$", "i").test(text),
      ),
  );
  if (matches.length !== 1)
    return done(
      "claude",
      matches.length ? "multiple_intents" : "no_clear_match",
    );
  const match = matches[0];
  const p = preferencesFor(
    [...history, { role: "user", text: input }],
    context.preference,
    context.initialPreferences,
  );
  if (
    match.contextRequirements.includes("previous_assistant_question") &&
    !history
      .filter((t) => t.role === "assistant")
      .at(-1)
      ?.text.includes("?")
  )
    return done("claude", "missing_question_context");
  if (
    match.id === "100" &&
    !/^i(?: feel| am feeling|'m feeling) (?:a little |a bit )?better now$/.test(
      text,
    )
  )
    return done("claude", "better_not_explicit");
  const recent =
    context.recentIds ||
    history.filter((t) => t.responseId).map((t) => t.responseId!);
  let missingCandidate: string | undefined;
  for (const id of match.matchingRules.variants) {
    const candidate = quickResponseById.get(id)!;
    if (recent.slice(-candidate.matchingRules.cooldownTurns).includes(id))
      continue;
    if (p.noAdvice && id === "059") continue;
    if (
      (p.noQuestions || p.quiet) &&
      (candidate.responseText.includes("?") ||
        /tell me|want to tell|what happened/i.test(candidate.responseText))
    )
      continue;
    if (
      (p.avoidFood &&
        candidate.category === "eating_related" &&
        !["015", "016", "039", "041", "047", "049", "050"].includes(id)) ||
      (p.avoidBody &&
        ["031", "032", "033", "034", "035", "036", "037", "038"].includes(id))
    )
      continue;
    const lastReplies = history.filter((t) => t.role === "assistant").slice(-3);
    const question = candidate.responseText
      .split(/[.!]/)
      .find((part) => part.includes("?"));
    if (
      question &&
      lastReplies.some((t) => normalize(t.text).includes(normalize(question)))
    )
      continue;
    if (context.availableIds && !context.availableIds.has(id)) {
      missingCandidate ||= id;
      continue;
    }
    return done("prerecorded", "clear_match", candidate);
  }
  if (missingCandidate)
    return done("claude", "audio_not_ready", undefined, missingCandidate);
  return done("claude", "recent_or_preference_conflict");
}
