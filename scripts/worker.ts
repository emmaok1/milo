import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { createClient } from "@supabase/supabase-js";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "Worker requires Supabase URL and internal service-role key.",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function service(
  userId: string,
  operation: string,
  payload: object = {},
) {
  const res = await fetch(process.env.MEMORY_SERVICE_URL + "/operation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.MEMORY_SERVICE_TOKEN,
    },
    body: JSON.stringify({ user_id: userId, operation, ...payload }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error("Memory service failure");
  return res.json();
}
async function active(userId: string, version: number) {
  const { data, error } = await db
    .from("records")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "profile")
    .single();
  if (
    error ||
    !data ||
    data.data.status !== "active" ||
    data.data.memoryMode !== "automatic" ||
    data.data.permissionVersion !== version
  )
    return null;
  return data;
}
async function main() {
  console.log("Internal worker started. Logs contain job IDs only.");
  while (true) {
    const { data: jobs, error } = await db
      .from("records")
      .select("*")
      .eq("kind", "job")
      .in("data->>status", ["pending", "processing"])
      .limit(25);
    if (error) throw new Error("Cannot read jobs");
    for (const job of jobs || []) {
      if (
        job.data.status === "processing" &&
        Date.now() - Date.parse(job.updated_at) < 120000
      )
        continue;
      if (job.data.nextAt && Date.parse(job.data.nextAt) > Date.now()) continue;
      const attempts = Number(job.data.attempts || 0) + 1;
      const { data: claim } = await db
        .from("records")
        .update({
          data: { ...job.data, status: "processing", attempts },
          version: job.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("version", job.version)
        .select()
        .maybeSingle();
      if (!claim) continue;
      try {
        const permission = await active(
          job.user_id,
          job.data.permissionVersion,
        );
        const { data: source } = await db
          .from("records")
          .select("*")
          .eq("id", job.data.sourceId)
          .eq("user_id", job.user_id)
          .eq("kind", "message")
          .maybeSingle();
        if (
          !permission ||
          !source ||
          source.data.excludeMemory ||
          source.data.role !== "user"
        ) {
          await finish(claim, "canceled");
          continue;
        }
        const { data: existing } = await db
          .from("records")
          .select("id")
          .eq("user_id", job.user_id)
          .eq("kind", "memory_link")
          .eq("data->>sourceId", source.id);
        if (existing?.length) {
          await finish(claim, "completed");
          continue;
        }
        const result = await service(job.user_id, "add", {
          text: source.data.text,
          infer: true,
        });
        const stillAllowed = await active(
          job.user_id,
          job.data.permissionVersion,
        );
        const { data: latest } = await db
          .from("records")
          .select("data")
          .eq("id", source.id)
          .eq("user_id", job.user_id)
          .maybeSingle();
        if (!stillAllowed || !latest || latest.data.excludeMemory) {
          for (const r of result.results || [])
            await service(job.user_id, "delete", { memory_id: r.id });
          await finish(claim, "canceled");
          continue;
        }
        for (const r of result.results || []) {
          const now = new Date().toISOString();
          const { error } = await db
            .from("records")
            .insert({
              id: randomUUID(),
              user_id: job.user_id,
              kind: "memory_link",
              parent_id: null,
              data: {
                mem0Id: r.id,
                state: "active",
                sourceId: source.id,
                source: "Conversation",
                eventTime: source.created_at,
                recordedTime: now,
                permissionVersion: job.data.permissionVersion,
              },
              version: 1,
            });
          if (error) throw new Error("Cannot map memory");
        }
        await finish(claim, "completed");
        console.log("Completed job", job.id);
      } catch {
        await finish(claim, attempts >= 3 ? "failed" : "pending", {
          nextAt: new Date(
            Date.now() + Math.pow(2, attempts) * 10000,
          ).toISOString(),
        });
        console.error("Job retry or failure", job.id);
      }
    }
    const { data: deletions } = await db
      .from("records")
      .select("*")
      .eq("kind", "deletion_job")
      .in("data->>status", ["pending", "failed"])
      .limit(20);
    for (const job of deletions || []) {
      try {
        if (job.data.scope === "account") {
          await service(job.user_id, "delete_all");
          const { error } = await db.auth.admin.deleteUser(job.user_id);
          if (error) throw new Error("Auth cleanup failed");
        } else {
          await service(job.user_id, "delete", { memory_id: job.data.mem0Id });
          await finish(job, "completed");
        }
      } catch {
        if (Number(job.data.attempts || 0) < 3)
          await finish(job, "pending", {
            attempts: Number(job.data.attempts || 0) + 1,
          });
        else await finish(job, "manual-review");
      }
    }
    await delay(3000);
  }
}
async function finish(
  job: { id: string; version: number; data: object },
  status: string,
  patch: object = {},
) {
  const { error } = await db
    .from("records")
    .update({
      data: { ...job.data, ...patch, status },
      version: job.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("version", job.version);
  if (error) throw new Error("Cannot save job state");
}
main().catch(() => {
  console.error(
    "Worker stopped. Check configuration and database connectivity.",
  );
  process.exitCode = 1;
});
