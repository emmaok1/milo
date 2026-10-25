import { memoryContextPrompt } from "../src/lib/memory-context";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { list, get, type Context } from "../src/lib/store";
import { readMemories, memoryCall } from "../src/lib/memory";
import { streamChat, instructions } from "../src/lib/ai";
import { voicePrompt } from "../src/lib/voice";
import { mayaDemoBatch, mayaDemoMemories } from "./fixtures/maya-memories";
loadEnvConfig(process.cwd());
async function main() {
  const userId = z
    .uuid()
    .parse(process.argv.find((a) => a.startsWith("--user-id="))?.split("=")[1]);
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const c: Context = { userId, demo: false, db };
  const links = (await list(c, "memory_link")).filter(
    (r) => r.data.demoBatch === mayaDemoBatch && r.data.state === "active",
  );
  if (links.length !== 5) throw Error("Expected five demo memories.");
  const samples = [];
  for (const i of [0, 4]) {
    const e = mayaDemoMemories[i];
    const memories = (await readMemories(c, e.query)).filter(
      (m: { source: string }) => m.source === "Fictional demo · Maya",
    );
    let reply = "";
    for await (const delta of streamChat(
      instructions +
        "\n" +
        voicePrompt("en-US") +
        memoryContextPrompt(memories),
      [{ role: "user", content: e.query }],
    ))
      reply += delta;
    if (!reply) throw Error("No contextual response.");
    samples.push({
      key: e.key,
      fictionalInput: e.query,
      generatedReply: reply,
      mentionsRememberedDetail:
        i === 0
          ? /Ethan|old photos|body/i.test(reply)
          : /Nina|Pumpkin|ordinary|quiet/i.test(reply),
    });
  }
  if (!samples[0].mentionsRememberedDetail)
    throw new Error(
      "No specific remembered detail appeared in the breakup callback.",
    );
  const made = await db.auth.admin.createUser({
    email: `haven-memory-isolation-${randomUUID()}@example.com`,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  if (made.error) throw Error("Isolation test identity unavailable.");
  try {
    const other: Context = { userId: made.data.user!.id, demo: false, db };
    const found = await memoryCall(other, "search", {
      query: "Maya Ethan Nina Pumpkin",
    });
    if ((found.results || []).length)
      throw Error("Cross-owner memory retrieval leak.");
    let rejected = false;
    try {
      await get(other, links[0].id, "memory_link");
    } catch {
      rejected = true;
    }
    if (!rejected) throw Error("Cross-owner link access leak.");
  } finally {
    await db.auth.admin.deleteUser(made.data.user!.id);
  }
  await writeFile(
    "artifacts/maya-memory-callbacks.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        fictional: true,
        accountIsolation: true,
        samples,
        note: "Real owner-scoped retrieval and Claude generation using fictional demo memories only. No sample chats were persisted to the owner account. Model wording varies.",
      },
      null,
      2,
    ),
  );
  for (const s of samples) console.log(s.key + ": " + s.generatedReply);
  console.log(
    "PASS real retrieval, contextual callbacks and account isolation.",
  );
}
main().catch((e) => {
  console.error("Maya demo check failed:", e.message);
  process.exitCode = 1;
});
