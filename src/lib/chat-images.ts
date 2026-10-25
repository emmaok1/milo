import { historyText } from "./quick-responses/playback";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { Attachment } from "./chat-context";
import type { Item } from "./types";
export const attachmentSchema = z
  .object({ name: z.string().max(120), url: z.string().max(2200000) })
  .strict();
export function imageBlocks(
  attachments: Attachment[],
): Anthropic.ImageBlockParam[] {
  if (attachments.length > 2) throw new Error("Attach up to two images.");
  return attachments.map((attachment) => {
    const match =
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        attachment.url,
      );
    if (!match) throw new Error("Use a JPEG, PNG or WebP image.");
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > 1500000)
      throw new Error("Each image must be under 1.5 MB.");
    const valid =
      match[1] === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : match[1] === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid) throw new Error("The image file does not match its format.");
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: match[1] as "image/jpeg" | "image/png" | "image/webp",
        data: match[2],
      },
    };
  });
}
export function userContent(
  text: string,
  attachments: Attachment[] = [],
): string | Anthropic.ContentBlockParam[] {
  return attachments.length
    ? [...imageBlocks(attachments), { type: "text", text }]
    : text;
}

export function conversationMessages(
  history: Item[],
  input: string,
  attachments: Attachment[],
  web: boolean,
): Anthropic.MessageParam[] {
  const recent = history
    .slice(-20)
    .filter(
      (m) =>
        m.data.state !== "failed" &&
        m.data.state !== "generating" &&
        String(m.data.text || "").trim(),
    );
  return [
    ...(web
      ? []
      : recent.map((m, index) => ({
          role: m.data.role as "user" | "assistant",
          content:
            m.data.role === "user" && index >= recent.length - 4
              ? userContent(
                  String(m.data.text),
                  (m.data.attachments || []) as Attachment[],
                )
              : historyText(m.data),
        }))),
    { role: "user", content: userContent(input, attachments) },
  ];
}
