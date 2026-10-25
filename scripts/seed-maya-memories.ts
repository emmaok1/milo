import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdir, open, writeFile } from "node:fs/promises";
import { z } from "zod";
import { list, insert, profile, type Context } from "../src/lib/store";
import { memoryCall, readMemories, changeMemory } from "../src/lib/memory";
import {
  mayaDemoBatch,
  mayaDemoMemories,
  mayaDemoText,
} from "./fixtures/maya-memories";
loadEnvConfig(process.cwd());
async function main() {
  const args = process.argv.slice(2),
    userId = z
      .uuid()
      .parse(args.find((a) => a.startsWith("--user-id="))?.split("=")[1]);
  const dry = args.includes("--dry-run"),
    remove = args.includes("--remove");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const user = await db.auth.admin.getUserById(userId);
  if (user.error || !user.data.user)
    throw new Error("Target account not found.");
  const c: Context = {
    userId,
    demo: false,
    db,
    purpose: "seed_fictional_demo_memory",
    operation: "write",
  };
  const p = await profile(c);
  if (p.status !== "active") throw new Error("Target account is not active.");
  if (!remove && ["off", "temporary"].includes(p.memoryMode))
    throw new Error(
      "Memory is disabled; target account settings must be changed explicitly before importing.",
    );
  await mkdir("data", { recursive: true });
  const lock = await open("data/maya-memory-seed.lock", "wx", 0o600);
  try {
    const links = (await list(c, "memory_link")).filter(
      (r) => r.data.demoBatch === mayaDemoBatch && r.data.state === "active",
    );
    if (remove) {
      for (const row of links) {
        if (!dry) await changeMemory(c, row.id);
        console.log(dry ? "WOULD REMOVE" : "REMOVED", row.data.demoKey);
      }
      return;
    }
    const remote = dry ? [] : (await memoryCall(c, "all", {})).results || [];
    for (const entry of mayaDemoMemories) {
      if (links.some((r) => r.data.demoKey === entry.key)) {
        console.log("REUSE", entry.key);
        continue;
      }
      if (dry) {
        console.log("WOULD ADD", entry.key, entry.date);
        continue;
      }
      const text = mayaDemoText(entry);
      let memory = remote.find(
        (r: { id: string; memory: string }) => r.memory === text,
      );
      if (!memory) {
        const result = await memoryCall(c, "add", { text, infer: false });
        memory = result.results?.[0];
      }
      if (!memory?.id) throw new Error("Memory service did not return an ID.");
      await insert(c, "memory_link", {
        mem0Id: memory.id,
        state: "active",
        source: "Fictional demo · Maya",
        demoBatch: mayaDemoBatch,
        demoKey: entry.key,
        fictional: true,
        demoPersona: "Maya",
        eventTime: entry.date + "T12:00:00Z",
        contentHash: createHash("sha256").update(text).digest("hex"),
      });
      console.log("ADDED", entry.key, entry.date);
    }
    if (!dry) {
      const saved = await readMemories(c, "", true);
      const imported = (await list(c, "memory_link")).filter(
        (r) => r.data.demoBatch === mayaDemoBatch && r.data.state === "active",
      );
      if (imported.length !== 5)
        throw new Error("Expected five active demo memories.");
      if (
        !imported.every((row) =>
          saved.some((m: { id: string }) => m.id === row.id),
        )
      )
        throw new Error("Demo memories are missing from management view.");
      const retrieval = [];
      for (const entry of mayaDemoMemories) {
        const found = await readMemories(c, entry.query);
        const relevant = found.some((m: { text: string }) =>
          entry.expected.every((word) => m.text.includes(word)),
        );
        retrieval.push({ key: entry.key, relevant });
        if (!relevant)
          throw new Error(
            "A demonstration query did not retrieve its relevant memory.",
          );
      }
      await mkdir("artifacts", { recursive: true });
      await writeFile(
        "artifacts/maya-memory-import.json",
        JSON.stringify(
          {
            at: new Date().toISOString(),
            batch: mayaDemoBatch,
            persona: "Maya",
            fictional: true,
            count: imported.length,
            managementView: true,
            retrieval,
            note: "Imported only into the explicitly selected owner account. No login, nickname, journal or global prompt changes.",
          },
          null,
          2,
        ),
      );
      console.log(
        "PASS five marked fictional memories visible and retrievable. Existing account settings and other memories preserved.",
      );
    }
  } finally {
    await lock.close();
    await (
      await import("node:fs/promises")
    ).unlink("data/maya-memory-seed.lock");
  }
}
main().catch((e) => {
  console.error("Demo memory import failed:", e.message);
  process.exitCode = 1;
});
