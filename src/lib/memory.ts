import {
  AppError,
  get,
  insert,
  list,
  profile,
  update,
  type Context,
} from "./store";
export function authorizeMemory(
  p: { status: string; memoryMode: string; permissionVersion: number },
  operation: string,
  version: number,
) {
  if (p.status !== "active" || p.permissionVersion !== version)
    throw new AppError(403, "Memory permission was revoked.");
  if (
    !["delete", "all"].includes(operation) &&
    ["off", "temporary"].includes(p.memoryMode)
  )
    throw new AppError(403, "Memory is disabled.");
  if (operation === "extract" && p.memoryMode !== "automatic")
    throw new AppError(403, "Automatic memory is disabled.");
}
export async function memoryCall(
  c: Context,
  operation: string,
  payload: Record<string, unknown>,
) {
  const p = await profile(c);
  authorizeMemory(p, operation, p.permissionVersion);
  if (!process.env.MEMORY_SERVICE_URL || !process.env.MEMORY_SERVICE_TOKEN)
    throw new AppError(503, "The private memory service is not configured.");
  const res = await fetch(process.env.MEMORY_SERVICE_URL + "/operation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.MEMORY_SERVICE_TOKEN,
    },
    body: JSON.stringify({ operation, user_id: c.userId, ...payload }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok)
    throw new AppError(503, "The private memory service is unavailable.");
  return res.json();
}
export async function readMemories(c: Context, query: string, manage = false) {
  const p = await profile(c);
  if (!manage && ["off", "temporary"].includes(p.memoryMode)) return [];
  const links = (await list(c, "memory_link")).filter(
    (r) =>
      r.data.state === "active" &&
      (!r.data.expiresAt ||
        String(r.data.expiresAt) > new Date().toISOString()),
  );
  if (c.demo)
    return links.map((r) => ({
      id: r.id,
      text: r.data.text,
      source: r.data.source,
      date: r.created_at,
      version: r.version,
    }));
  if (!links.length) return [];
  const found = await memoryCall(c, manage ? "all" : "search", { query });
  return (found.results || []).flatMap((r: { id: string; memory: string }) => {
    const link = links.find((l) => l.data.mem0Id === r.id);
    return link
      ? [
          {
            id: link.id,
            text: r.memory,
            source: link.data.source,
            date: link.created_at,
            version: link.version,
          },
        ]
      : [];
  });
}
export async function changeMemory(c: Context, id: string, text?: string) {
  const link = await get(c, id, "memory_link");
  if (link.data.state !== "active")
    throw new AppError(404, "Memory no longer available.");
  // Invalidate first; a remote failure must never restore stale memory to retrieval.
  await update(c, id, { state: "withdrawn" }, link.version);
  const p = await profile(c);
  const source = link.data.sourceId;
  if (source) {
    const message = await get(c, String(source), "message");
    await update(c, message.id, { excludeMemory: true }, message.version);
  }
  const jobs = await list(c, "job");
  for (const j of jobs.filter(
    (j) => j.data.sourceId === source && j.data.status === "pending",
  ))
    await update(c, j.id, { status: "canceled" }, j.version);
  if (!c.demo) {
    try {
      await memoryCall(c, "delete", { memory_id: link.data.mem0Id });
    } catch {
      await insert(c, "deletion_job", {
        mem0Id: link.data.mem0Id,
        status: "pending",
        permissionVersion: p.permissionVersion,
      });
      throw new AppError(
        503,
        "Memory excluded immediately. Remote cleanup is queued; retry the worker.",
      );
    }
  }
  if (text) {
    if (c.demo)
      await insert(c, "memory_link", {
        text,
        state: "active",
        source: "User correction",
        sourceId: link.data.sourceId,
        eventTime: new Date().toISOString(),
      });
    else {
      const result = await memoryCall(c, "add", { text, infer: false });
      for (const r of result.results || [])
        await insert(c, "memory_link", {
          mem0Id: r.id,
          state: "active",
          source: "User correction",
          sourceId: link.data.sourceId,
        });
    }
  }
}
export async function enqueueMemory(c: Context, sourceId: string) {
  const p = await profile(c);
  if (p.memoryMode !== "automatic") return;
  const job = await insert(
    c,
    "job",
    {
      sourceId,
      permissionVersion: p.permissionVersion,
      status: "pending",
      attempts: 0,
      dedupe: sourceId,
    },
    sourceId,
  );
  if (c.demo) {
    const source = await get(c, sourceId, "message");
    const text = String(source.data.text);
    if (
      !source.data.excludeMemory &&
      /\b(i prefer|please call me|i like (short|brief)|listen first)\b/i.test(
        text,
      )
    ) {
      await insert(c, "memory_link", {
        text,
        state: "active",
        sourceId,
        source: "Fictional demo extraction",
        eventTime: source.created_at,
      });
    }
    await update(
      c,
      job.id,
      { status: "completed", demonstration: true },
      job.version,
    );
  }
}
