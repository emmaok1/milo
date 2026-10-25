import { AppError } from "./store";
export const dailyReady = () => !!process.env.DAILY_API_KEY;
async function daily(path: string, body: unknown) {
  if (!dailyReady()) throw new AppError(503, "Video isn't available yet.");
  const r = await fetch("https://api.daily.co/v1/" + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!r.ok)
    throw new AppError(
      502,
      "Video is temporarily unavailable. Please try again.",
    );
  return r.json();
}
export function dailyRoomPayload(name: string, expires: number) {
  return {
    name,
    privacy: "private",
    properties: {
      exp: expires,
      max_participants: 6,
      start_video_off: true,
      start_audio_off: true,
      enable_prejoin_ui: true,
      enable_chat: false,
      enable_screenshare: false,
      eject_at_room_exp: true,
      enable_transcription_storage: false,
    },
  };
}
export async function createMealVideo(id: string, expires: number) {
  const name = "haven-" + id;
  const r = await daily("rooms", dailyRoomPayload(name, expires));
  if (
    r.name !== name ||
    typeof r.url !== "string" ||
    !/^https:\/\/[a-zA-Z0-9-]+\.daily\.co\//.test(r.url)
  )
    throw new AppError(502, "The video room could not be created.");
  return { roomName: name, roomUrl: r.url as string };
}
export function dailyTokenPayload(
  roomName: string,
  userId: string,
  name: string,
) {
  return {
    properties: {
      room_name: roomName,
      user_id: userId,
      user_name: name,
      is_owner: false,
      exp: Math.floor(Date.now() / 1000) + 300,
      eject_at_token_exp: false,
      start_video_off: true,
      start_audio_off: true,
      enable_prejoin_ui: true,
      enable_screenshare: false,
      enable_recording_ui: false,
      start_cloud_recording: false,
      auto_start_transcription: false,
      permissions: { canAdmin: false },
    },
  };
}
export async function mealVideoToken(
  roomName: string,
  userId: string,
  name: string,
) {
  const r = await daily(
    "meeting-tokens",
    dailyTokenPayload(roomName, userId, name),
  );
  if (typeof r.token !== "string")
    throw new AppError(502, "Video could not connect.");
  return r.token as string;
}
export async function ejectMeal(roomName: string, userIds: string[]) {
  await daily(`rooms/${encodeURIComponent(roomName)}/eject`, {
    user_ids: userIds,
    ban: true,
  });
}
