import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError, assertOrigin, context } from "@/lib/store";

export const runtime = "nodejs";
const presenter = "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.png";
function signature(value: string) {
  return createHmac("sha256", process.env.DID_API_KEY!).update(value).digest("hex");
}
async function provider(path: string, body?: unknown) {
  const response = await fetch(`https://api.d-id.com/talks${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Basic ${process.env.DID_API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000), cache: "no-store",
  });
  if (!response.ok) throw new AppError(502, "The avatar service is unavailable. Please continue in text chat.");
  return response.json();
}
async function handle(req: Request) {
  try {
    assertOrigin(req);
    const c = await context("avatar", req.method === "POST" ? "write" : "read");
    const image = process.env.DID_SOURCE_URL || presenter;
    if (req.method === "GET" && !new URL(req.url).searchParams.has("token"))
      return Response.json({ configured: !!process.env.DID_API_KEY, image }, { headers: { "Cache-Control": "no-store" } });
    if (!process.env.DID_API_KEY) throw new AppError(503, "The avatar service is not configured. Text chat remains available.");
    if (req.method === "POST") {
      const raw = await req.text();
      if (raw.length > 12000) throw new AppError(413, "The reply is too long for avatar playback. Read it in text chat.");
      const { text } = JSON.parse(raw);
      if (typeof text !== "string" || !text.trim() || text.length > 3000) throw new AppError(400, "Avatar replies must contain 1–3000 characters.");
      const result = await provider("", { source_url: image, script: { type: "text", input: text, provider: { type: "microsoft", voice_id: process.env.DID_VOICE_ID || "en-US-JennyNeural" } }, config: { fluent: true } });
      const payload = Buffer.from(JSON.stringify({ id: result.id, user: c.userId, expires: Date.now() + 180000 })).toString("base64url");
      return Response.json({ token: `${payload}.${signature(payload)}` });
    }
    const token = new URL(req.url).searchParams.get("token") || "";
    const [payload, mac = ""] = token.split(".");
    const expected = signature(payload);
    if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) throw new AppError(403, "Invalid playback request.");
    const job = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (job.user !== c.userId || job.expires < Date.now()) throw new AppError(403, "This playback request has expired.");
    const result = await provider(`/${encodeURIComponent(job.id)}`);
    if (result.status === "error" || result.status === "rejected") throw new AppError(502, "Avatar generation failed. Please try again.");
    return Response.json({ status: result.status, url: result.status === "done" ? result.result_url : undefined }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof AppError ? error.message : "The avatar request failed. Please try again." }, { status: error instanceof AppError ? error.status : 500 });
  }
}
export const GET = handle;
export const POST = handle;
