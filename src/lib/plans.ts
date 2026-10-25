import { randomUUID } from "node:crypto";
import { AppError, demoTransaction, type Context } from "./store";
import { datePlus, type Item } from "./types";
export async function acceptDemo(c: Context, id: string, version: number) {
  return demoTransaction(c, (rows) => {
    const p = rows.find((r) => r.id === id && r.kind === "plan");
    if (!p) throw new AppError(404, "Plan not found.");
    if (p.data.state === "active") return p;
    if (p.data.state !== "draft" || p.version !== version)
      throw new AppError(409, "Reload the draft before accepting.");
    const now = new Date().toISOString();
    for (let i = 0; i < Number(p.data.days); i++) {
      const date = datePlus(String(p.data.start), i);
      if (
        p.data.weekendsFree &&
        [0, 6].includes(new Date(date + "T12:00Z").getUTCDay())
      )
        continue;
      rows.push({
        id: randomUUID(),
        user_id: c.userId,
        kind: "task",
        parent_id: p.id,
        data: {
          date,
          title: p.data.task,
          steps: p.data.steps,
          minutes: p.data.minutes,
        },
        version: 1,
        created_at: now,
        updated_at: now,
      });
    }
    p.data = { ...p.data, state: "active" };
    p.version++;
    p.updated_at = now;
    return p;
  });
}
export async function applyDemo(
  c: Context,
  planId: string,
  revisionId: string,
  today: string,
) {
  return demoTransaction(c, (rows) => {
    const p = rows.find((r) => r.id === planId && r.kind === "plan");
    const rev = rows.find(
      (r) =>
        r.id === revisionId && r.kind === "revision" && r.parent_id === planId,
    );
    if (!p || !rev) throw new AppError(404, "Revision not found.");
    if (rev.data.state !== "preview" || rev.data.planVersion !== p.version)
      throw new AppError(409, "This preview is out of date.");
    const changes = rev.data.changes as {
      id: string;
      version: number;
      after: string;
      date: string;
    }[];
    const tasks: Item[] = [];
    for (const ch of changes) {
      const t = rows.find(
        (r) => r.id === ch.id && r.kind === "task" && r.parent_id === planId,
      );
      if (!t || t.version !== ch.version || ch.date <= today)
        throw new AppError(409, "A task changed. Generate a fresh preview.");
      tasks.push(t);
    }
    const now = new Date().toISOString();
    tasks.forEach((t, i) => {
      t.data = { ...t.data, title: changes[i].after };
      t.version++;
      t.updated_at = now;
    });
    rev.data = { ...rev.data, state: "accepted" };
    rev.version++;
    rev.updated_at = now;
    p.data = { ...p.data, revision: rev.id };
    p.version++;
    p.updated_at = now;
    return p;
  });
}
