import { loadEnvConfig } from "@next/env";
import Anthropic from "@anthropic-ai/sdk";
import { claudeThinking } from "../src/lib/ai";
loadEnvConfig(process.cwd());

async function main() {
  const smoke = process.argv.includes("--smoke");
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("Claude: unconfigured (set ANTHROPIC_API_KEY in .env.local)");
    process.exitCode = 1;
  } else {
    const client = new Anthropic({
      baseURL: "https://api.anthropic.com",
      timeout: 30000,
      maxRetries: 0,
    });
    for (const model of new Set([
      process.env.ANTHROPIC_CHAT_MODEL || "claude-sonnet-5-5",
      process.env.ANTHROPIC_PLAN_MODEL || "claude-sonnet-5-5",
      process.env.ANTHROPIC_MEMORY_MODEL || "claude-haiku-5-5",
    ])) {
      try {
        await client.models.retrieve(model);
        console.log("Claude model accessible:", model);
        if (smoke) {
          const reply = await client.messages.create({
            model,
            max_tokens: 32,
            thinking: claudeThinking(model),
            messages: [{ role: "user", content: "Reply with only OK." }],
          });
          if (
            reply.stop_reason !== "end_turn" ||
            !reply.content.some((b) => b.type === "text" && b.text.trim())
          )
            throw new Error("Incomplete response");
          console.log("Claude text generation passed:", model);
        }
      } catch {
        console.log(
          "Claude model check failed (check key, model access, billing, and network):",
          model,
        );
        process.exitCode = 1;
      }
    }
    if (!smoke)
      console.log(
        "Use --smoke for small billed generation checks; model lookup alone does not verify generation.",
      );
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.log("Supabase: unconfigured");
    process.exitCode = 1;
  } else {
    try {
      const r = await fetch(
        process.env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1/health",
        {
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
          signal: AbortSignal.timeout(10000),
        },
      );
      console.log(
        "Supabase health:",
        r.ok ? "reachable (schema/auth flow still requires testing)" : "failed",
      );
      if (!r.ok) process.exitCode = 1;
    } catch {
      console.log("Supabase: unreachable");
      process.exitCode = 1;
    }
  }
  if (!process.env.MEMORY_SERVICE_URL) {
    console.log("Mem0: unconfigured");
    process.exitCode = 1;
  } else {
    try {
      const r = await fetch(process.env.MEMORY_SERVICE_URL + "/health", {
        signal: AbortSignal.timeout(10000),
      });
      console.log(
        "Mem0 health:",
        r.ok
          ? "reachable; extraction, local embeddings and storage still require testing"
          : "failed",
      );
      if (!r.ok) process.exitCode = 1;
    } catch {
      console.log("Mem0: unreachable (start docker compose up --build -d)");
      process.exitCode = 1;
    }
  }
}
main().catch(() => {
  console.log(
    "Service verification failed; details intentionally omit credentials.",
  );
  process.exitCode = 1;
});
