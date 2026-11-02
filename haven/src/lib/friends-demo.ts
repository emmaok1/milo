import type { FriendsSnapshot } from "./friends-model";
export const demoFriendUser = "00000000-0000-4000-8000-000000000001",
  demoNina = "00000000-0000-4000-8000-000000000002";
/** Fictional in-memory preview. Never save it or call the real invitation/video APIs. */
export function friendsDemoSnapshot(name = "You"): FriendsSnapshot {
  const now = new Date().toISOString();
  return {
    userId: demoFriendUser,
    videoReady: true,
    group: {
      id: "00000000-0000-4000-8000-000000000003",
      ownerId: demoFriendUser,
      name: "Our little space",
      members: [
        { id: demoFriendUser, name, joinedAt: now },
        { id: demoNina, name: "Nina", joinedAt: now },
      ],
      meal: null,
      notificationKey: "demo-preview",
    },
    messages: [
      {
        id: "preview-1",
        senderId: demoNina,
        name: "Nina",
        text: "Hey, want some company for dinner?",
        createdAt: new Date(Date.now() - 180000).toISOString(),
      },
      {
        id: "preview-2",
        senderId: demoFriendUser,
        name,
        text: "I'd like that. Nothing serious, just a little company.",
        createdAt: new Date(Date.now() - 120000).toISOString(),
      },
      {
        id: "preview-3",
        senderId: demoNina,
        name: "Nina",
        text: "Of course. I'll bring the cat stories.",
        createdAt: new Date(Date.now() - 60000).toISOString(),
      },
    ],
  };
}
