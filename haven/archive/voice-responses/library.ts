import { z } from "zod";
export const contentVersion = "english-v1";
export const actions = [
  "ask_and_wait",
  "acknowledge_and_wait",
  "wait_for_user",
  "offer_topic_change",
  "offer_call_end",
] as const;
export const responseSchema = z
  .object({
    id: z.string().regex(/^\d{3}$/),
    intent: z.string().min(1),
    category: z.string().min(1),
    responseText: z.string().min(1),
    exampleUtterances: z.array(z.string()).min(1),
    matchingRules: z.object({
      patterns: z.array(z.string()),
      requiredPhrases: z.array(z.array(z.string())),
      priority: z.number(),
      variants: z.array(z.string()),
      cooldownTurns: z.number(),
    }),
    exclusions: z.array(z.string()),
    contextRequirements: z.array(z.string()),
    autoRouteEnabled: z.boolean(),
    action: z.enum(actions),
    audioAssets: z.object({
      contentVersion: z.string(),
      voices: z.record(z.string(), z.string()),
    }),
  })
  .strict();
export type QuickResponse = z.infer<typeof responseSchema>;
const content = `001|food_choice|A lot of choices can feel like too much. What’s making it hard to choose?|I can't decide what to eat.
002|nothing_appealing|Does nothing sound good, or is eating itself feeling hard?|Nothing sounds appealing to eat.
003|afraid_to_eat|You want to eat, and something’s holding you back. What feels scary?|I want to eat but I'm scared.
004|delaying_eating|What comes up when you think about getting something to eat?|I keep delaying eating.
005|next_meal_worry|It sounds like the next meal is already weighing on you. What’s on your mind?|I'm worried about my next meal.
006|food_shopping|What was going through your mind while you were choosing?|Food shopping felt difficult today.
007|hard_to_start_eating|We can take a moment. Want to tell me what’s making it hard?|I'm finding it hard to start eating.
008|eating_alone|I can keep you company here. Would a little conversation help?|I'm eating alone and want some company.
009|eating_around_others|Is it being watched, something people say, or something else?|Eating around others makes me uncomfortable.
010|changed_meal_plans|That change sounds unsettling. Which part is bothering you most?|My meal plans changed and I'm upset.
011|anxious_while_eating|That sounds uncomfortable. Want some company, or do you want to talk about it?|I'm anxious while eating right now.
012|intrusive_eating_thoughts|That’s a lot to deal with while eating. What are those thoughts saying?|I'm having intrusive thoughts while eating.
013|watched_while_eating|Feeling watched can make things harder. Did something happen, or is it a worry right now?|I feel watched while I'm eating.
014|request_mealtime_chat|Of course. Want to tell me about something you watched or listened to lately?|Stay with me while I eat.
015|avoid_food_topic|Absolutely. What kind of music have you been into lately?|I don't want to talk about food.
016|quiet_company|Okay. I’ll leave some quiet. You can speak whenever you feel like it.|I just want quiet company.
017|emotional_difficulty_during_meal|We can slow the conversation down. What’s coming up for you?|I'm having a difficult time emotionally during this meal.
018|lighter_topic|Sure. Tell me about a show you could watch over and over.|Let's change to a lighter topic.
019|self_conscious_eating|What makes it feel strange to you?|I feel self-conscious about eating.
020|comments_on_eating|That sounds uncomfortable. What did they say?|Someone commented on my eating and it hurt.
021|post_meal_guilt|That guilt sounds heavy. What are you saying to yourself right now?|I feel guilty after eating.
022|food_regret|What about it is bringing up regret?|I regret what I ate.
023|worried_about_amount|It sounds like you’re worried about what you ate. Want to tell me more?|I'm worried about how much I ate.
024|feeling_out_of_control|That sounds frightening. What did ‘out of control’ feel like for you?|I felt out of control while eating.
025|anger_at_self_after_eating|You sound really upset with yourself. What’s the hardest thought right now?|I'm angry at myself after eating.
026|post_meal_rumination|It sounds like your mind keeps returning to it. What keeps coming up?|I keep thinking about what I ate.
027|seeking_food_reassurance|It sounds like you’re looking for some reassurance. What’s worrying you about it?|I need reassurance about what I ate.
028|meal_ruined_day|This moment feels really big right now. What happened that made it feel that way?|This meal feels like it ruined my day.
029|withdrawing_after_eating|Would some quiet feel better, or is there something you don’t want people to notice?|I want to hide away after eating.
030|crying_after_eating|You don’t have to hold the tears back here. We can pause, or you can tell me what hurts.|I'm crying after eating.
031|difficult_body_image_day|I’m sorry today feels so hard. Did something bring those feelings up?|I'm having a difficult body image day.
032|appearance_comparison|Those comparisons sound painful. What happened just before they started?|I keep comparing my appearance to others.
033|mirror_distress|That sounds like a rough moment. Would you like to talk about it, or change the subject?|Looking in the mirror upset me.
034|clothing_distress|I’m sorry getting dressed felt so hard. What went through your mind?|Getting dressed felt upsetting.
035|body_comments|You didn’t ask for that comment. How did it land with you?|Someone made a comment about my body.
036|social_media_body_distress|What did you see that stayed with you?|Social media made me feel bad about my body.
037|appearance_and_worth|It sounds like appearance is taking up a lot of space today. What else matters to you?|I feel like my worth depends on my appearance.
038|body_checking|What are you hoping to find out when you check?|I keep checking my body.
039|body_topic_boundary|Of course. We can leave that alone. What would you rather talk about?|I don't want to talk about my body.
040|feeling_misunderstood|It sounds lonely to carry this without feeling understood. What do people tend to miss?|I feel misunderstood about this.
041|hard_to_explain|You can start with one small part. It doesn’t need to come out neatly.|I don't know how to explain how I feel.
042|problem_not_serious_enough|You don’t have to prove it’s serious enough. If it’s troubling you, we can talk about it.|I worry my problem isn't serious enough.
043|fear_of_judgment|You don’t need to defend yourself here. What are you worried someone might say?|I'm afraid of being judged.
044|feeling_like_failure|That sounds like a painful way to see yourself. What happened?|I feel like a failure.
045|discouraged_about_progress|It sounds discouraging. What’s been making progress feel far away?|I'm discouraged about my progress.
046|difficult_day|I’m sorry it’s been such a hard day. Which part has been the hardest?|I've had a difficult day.
047|listening_without_advice|Got it. I’ll hold off on advice. Tell me what happened.|Please just listen. I don't want advice.
048|help_reaching_out|We can put a message together. What would you most want them to understand?|Help me reach out to someone I trust.
049|decline_question|That’s okay. We can skip it. You get to choose what you share.|I don't want to answer that question.
050|pause_or_finish|Of course. We can stop here. Thanks for telling me what you need.|I want to end the call now.
051|unexplained_anxiety|You don’t need to know why just yet. When did you first notice it today?|I'm anxious and don't know why.
052|racing_thoughts|Sounds like your mind won’t give you a break. What keeps coming back?|My thoughts are racing.
053|expecting_bad_events|That sounds tiring. Is there one worry that’s louder than the others?|I keep expecting something bad to happen.
054|anticipatory_anxiety|Waiting can be hard. Which part are you dreading?|I'm anxious about something coming up.
055|what_if_worries|There are a lot of ‘what ifs’ right now. Which one is bothering you most?|I keep getting stuck in what-if worries.
056|stuck_on_small_event|It’s really stayed with you. What about it keeps pulling you back?|I can't stop thinking about a small thing that happened.
057|uncertainty|Not knowing is hard. What are you waiting to find out?|I'm struggling with uncertainty.
058|decision_anxiety|This choice matters to you. What feels at stake?|Making this decision makes me anxious.
059|overwhelmed|That’s a lot at once. We can pick one thing, if you’d like.|I feel overwhelmed right now.
060|no_more_analysis|Okay. We can leave the reasons alone. Would a little company help?|I don't want to analyze this anymore.
061|too_many_tasks|Want to tell me what’s on the list? We can look at it together.|I have too many tasks to do.
062|procrastination_and_blame|It sounds like you’re stuck, and being hard on yourself too. What’s hard to start?|I keep procrastinating and blaming myself.
063|exam_or_deadline_worry|That deadline is hanging over you. What are you most worried about?|I'm worried about an upcoming exam.
064|effort_never_enough|You’ve put a lot into this. What would ‘enough’ look like to you?|My effort never feels like enough.
065|feeling_behind_others|That comparison sounds rough. What’s been making you feel behind?|I feel behind everyone else.
066|perfectionism|That’s a lot of pressure to carry. What happens when something isn’t perfect?|I feel like everything must be perfect.
067|afraid_to_rest|Even resting feels hard right now. What worries you about taking a break?|I'm afraid to take a rest.
068|unrecognized_effort|It hurts when your effort goes unseen. What do you wish someone would notice?|I feel like no one notices my effort.
069|difficulty_focusing|What’s it like when you try—do your thoughts wander, or does everything feel like too much?|I'm finding it difficult to focus.
070|unproductive_day|Sounds like today didn’t go how you hoped. What was getting in the way?|I feel like today was unproductive.
071|waiting_for_message|Waiting for a reply can leave room for so many thoughts. What’s yours telling you?|I'm worried while waiting for a reply.
072|fear_of_dislike|That’s a painful worry. Did something happen that brought it up?|I'm afraid they don't like me.
073|replaying_conversation|Which part of the conversation keeps replaying?|I keep replaying a conversation.
074|social_event_anxiety|What feels hardest—the first hello, keeping a chat going, or something else?|I'm anxious about a social event.
075|difficulty_saying_no|Saying no can feel awkward. What would you like to say no to?|I'm struggling to say no.
076|fear_of_disappointing|You care about them. What do you need in this situation too?|I'm afraid of disappointing someone.
077|argument_with_friend|That sounds upsetting. Want to tell me how it started?|I had an argument with my friend.
078|feeling_excluded|Feeling left out hurts. What happened?|I'm feeling excluded.
079|caring_for_everyone_else|It sounds like you’ve been giving a lot. What kind of care are you missing?|I keep caring for everyone else and neglecting myself.
080|afraid_of_bothering_others|What would you want to tell them, if worrying about bothering them wasn’t in the way?|I'm afraid of bothering people when I need support.
081|lonely_around_people|Being around people and feeling close to them can be different. What feels missing?|I feel lonely even around people.
082|missing_someone|Want to tell me about them?|I'm missing someone.
083|homesick|What do you miss most about home today?|I'm homesick.
084|feeling_empty|That sounds hard to describe. Has it felt like this all day?|I'm feeling empty.
085|missing_enjoyment|That sounds discouraging. What have you been missing the feeling of enjoying?|I miss enjoying things.
086|unsure_of_needs|That’s okay. Would talking, quiet company, or a different topic feel easiest?|I don't know what I need right now.
087|wanting_to_cry|You don’t need a neat explanation. We can stay with what you’re feeling.|I want to cry and can't explain why.
088|irritability_and_regret|Sounds like it’s been a rough stretch. What was happening before you got upset?|I've been irritable and regret how I acted.
089|tired_of_pretending|You don’t have to sound okay here. What has today really been like?|I'm tired of pretending I'm okay.
090|listen_without_questions|Okay. No more questions for now. You can say as much or as little as you want.|Please don't ask me any more questions.
091|nighttime_overthinking|Things get louder when the day gets quiet, huh? What’s on your mind tonight?|I'm overthinking at night.
092|tomorrow_worries|Tomorrow is taking up a lot of tonight. Which part are you thinking about?|I'm worrying about tomorrow tonight.
093|replaying_day_at_bedtime|Is there one moment from today that keeps coming back?|I'm replaying the day at bedtime.
094|worry_about_sleep|That worry sounds tiring on its own. Would you like a quiet chat for a bit?|I'm worried I won't sleep.
095|tired_but_busy_mind|Your body wants a rest, but your mind’s still busy. Want to put some of those thoughts into words?|I'm tired but my mind is busy.
096|guilt_about_rest|What does that guilty voice say when you try to rest?|I feel guilty about resting.
097|request_light_conversation|Sure. What’s a small thing that made you smile lately?|Can we have a light conversation?
098|request_easy_question|Okay—rainy afternoons or sunny mornings?|Ask me an easy question.
099|topic_too_heavy|We can set it down. Want something lighter, or a quiet moment?|This topic feels too heavy right now.
100|explicitly_feeling_better|I’m glad it feels a little lighter. We can leave it here, or keep talking.|I'm feeling better now.`;
type Rule = {
  patterns: string[];
  required: string[][];
  examples?: string[];
  context?: string[];
  action?: QuickResponse["action"];
  variants?: string[];
};
const rules: Record<string, Rule> = {
  "008": {
    patterns: [
      "i(?: am|'m) eating alone and (?:i )?(?:want|would like|need) (?:some )?company",
    ],
    required: [["eating alone"], ["company"]],
  },
  "014": {
    patterns: [
      "(?:please )?(?:stay with me|keep me company|talk to me) while i (?:eat|am eating|'m eating)",
    ],
    required: [["while i"]],
  },
  "015": {
    patterns: [
      "i (?:don't|do not) want to (?:talk|chat) about food(?: (?:right )?now)?",
    ],
    required: [["food"], ["don't", "do not"]],
    action: "offer_topic_change",
  },
  "016": {
    patterns: [
      "(?:i (?:just )?(?:want|need|would like)|can (?:you|we) (?:just )?have) (?:some )?quiet company",
      "(?:please )?(?:sit|stay) (?:quietly )?with me (?:in silence|without talking)",
    ],
    required: [["quiet", "silence", "without talking"]],
    action: "wait_for_user",
  },
  "018": {
    patterns: [
      "(?:let's|can we|please) (?:change|switch) (?:to )?(?:a )?lighter topic",
    ],
    required: [["lighter topic"]],
    variants: ["018", "097"],
    action: "offer_topic_change",
  },
  "021": {
    patterns: [
      "i (?:feel|am feeling|'m feeling) (?:really |so )?guilty (?:after eating|about (?:what i ate|eating))(?: (?:right )?now)?",
    ],
    required: [
      ["i feel", "i am feeling", "i'm feeling"],
      ["guilty"],
      ["eating", "what i ate"],
    ],
  },
  "039": {
    patterns: [
      "i (?:don't|do not) want to (?:talk|chat) about my body(?: (?:right )?now)?",
    ],
    required: [["my body"], ["don't", "do not"]],
    action: "offer_topic_change",
  },
  "041": {
    patterns: [
      "i (?:don't|do not) know how to explain (?:how i feel|what i(?: am|'m) feeling)",
    ],
    required: [["explain"], ["i feel", "feeling"]],
    action: "acknowledge_and_wait",
  },
  "047": {
    patterns: [
      "(?:please )?just listen(?: i (?:don't|do not) want (?:any )?advice)?",
      "i (?:don't|do not) want (?:any )?advice(?: (?:please )?just listen)?",
      "(?:please )?listen without (?:giving )?advice",
    ],
    required: [["listen", "advice"]],
    action: "acknowledge_and_wait",
  },
  "049": {
    patterns: [
      "i (?:don't|do not) want to answer that(?: question)?",
      "(?:please )?(?:skip|don't ask me) that question",
    ],
    required: [["question", "answer that"]],
    context: ["previous_assistant_question"],
    action: "acknowledge_and_wait",
  },
  "050": {
    patterns: [
      "i (?:want|need|would like) to (?:end|finish|stop) (?:the|this) call(?: now)?",
      "(?:please )?(?:end|finish|stop) (?:the|this) call(?: now)?",
    ],
    required: [["call"], ["end", "finish", "stop"]],
    action: "offer_call_end",
  },
  "059": {
    patterns: [
      "i (?:feel|am feeling|'m feeling) overwhelmed(?: (?:right )?now)?",
    ],
    required: [["i feel", "i am feeling", "i'm feeling"], ["overwhelmed"]],
    action: "acknowledge_and_wait",
  },
  "060": {
    patterns: [
      "i (?:don't|do not) want to (?:analyze|analyse) this (?:anymore|any more)",
    ],
    required: [
      ["analyze", "analyse"],
      ["don't", "do not"],
    ],
  },
  "090": {
    patterns: [
      "(?:please )?(?:don't|do not) ask me (?:any )?(?:more|any more) questions(?: (?:right )?now)?",
      "(?:please )?no more questions(?: (?:right )?now)?",
      "(?:please )?listen without (?:asking )?questions",
    ],
    required: [["questions"]],
    action: "wait_for_user",
  },
  "097": {
    patterns: [
      "(?:can we|let's|i (?:want|would like) to) (?:have )?(?:a )?light conversation",
      "(?:please )?(?:talk|chat) (?:to|with) me about something (?:light|else)",
    ],
    required: [["light", "something else"]],
    variants: ["097", "018"],
    action: "offer_topic_change",
  },
  "098": {
    patterns: ["(?:please )?ask me (?:an? )?(?:easy|simple) question"],
    required: [["ask me"], ["easy", "simple"]],
  },
  "099": {
    patterns: [
      "this (?:topic|conversation) (?:feels|is) too heavy(?: (?:right )?now)?",
    ],
    required: [["too heavy"], ["this topic", "this conversation"]],
    action: "offer_topic_change",
  },
  "100": {
    patterns: [
      "i(?: am|'m) feeling (?:a little |a bit )?better now",
      "i feel (?:a little |a bit )?better now",
    ],
    required: [["i feel", "i'm feeling", "i am feeling"], ["better now"]],
    context: ["explicit_feeling_better"],
    action: "offer_call_end",
  },
};
export const quickResponses: QuickResponse[] = content
  .split("\n")
  .map((line) => {
    const [id, intent, responseText, example] = line.split("|");
    const rule = rules[id];
    const n = Number(id);
    return responseSchema.parse({
      id,
      intent,
      category:
        n <= 50
          ? "eating_related"
          : n <= 60
            ? "anxiety"
            : n <= 70
              ? "school_work"
              : n <= 80
                ? "relationships"
                : n <= 90
                  ? "low_mood"
                  : "rest_company",
      responseText,
      exampleUtterances: [example, ...(rule?.examples || [])],
      matchingRules: {
        patterns: rule?.patterns || [],
        requiredPhrases: rule?.required || [],
        priority: ["015", "039", "047", "090"].includes(id) ? 100 : 50,
        variants: rule?.variants || [id],
        cooldownTurns: 8,
      },
      exclusions: [
        "safety_context",
        "quoted_or_third_party",
        "hypothetical_or_past",
        "mixed_or_complex_request",
        "recent_response",
        "answered_question",
      ],
      contextRequirements: rule?.context || [],
      autoRouteEnabled:
        !!rule && ["016", "047", "049", "050", "090"].includes(id),
      action:
        rule?.action ||
        (responseText.includes("?") ? "ask_and_wait" : "acknowledge_and_wait"),
      audioAssets: { contentVersion, voices: {} },
    });
  });
export const quickResponseById = new Map(
  quickResponses.map((entry) => [entry.id, entry]),
);
export function validateLibrary() {
  if (
    quickResponses.length !== 100 ||
    new Set(quickResponses.map((r) => r.id)).size !== 100
  )
    throw new Error("Expected exactly 100 unique responses.");
  for (const entry of quickResponses) {
    responseSchema.parse(entry);
    for (const pattern of entry.matchingRules.patterns) new RegExp(pattern);
    for (const id of entry.matchingRules.variants)
      if (!quickResponseById.has(id))
        throw new Error("Unknown response variant.");
  }
  return true;
}
/** Materialized by the preparation script; only real, versioned assets get references. */
export function indexedLibrary(
  assets: {
    id: string;
    voiceId: string;
    contentVersion: string;
    key: string;
  }[],
) {
  return quickResponses.map((entry) => ({
    ...entry,
    audioAssets: {
      contentVersion,
      voices: Object.fromEntries(
        assets
          .filter(
            (a) => a.id === entry.id && a.contentVersion === contentVersion,
          )
          .map((a) => [`${a.voiceId}:${a.contentVersion}`, a.key]),
      ),
    },
  }));
}
