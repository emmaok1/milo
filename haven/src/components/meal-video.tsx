"use client";
import { useEffect, useRef } from "react";
export default function MealVideo({
  credentials,
  onLeave,
  onError,
}: {
  credentials: { url: string; token: string };
  onLeave: () => void;
  onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onLeave, onError });
  useEffect(() => {
    callbacks.current = { onLeave, onError };
  }, [onLeave, onError]);
  useEffect(() => {
    let disposed = false;
    let call: import("@daily-co/daily-js").DailyCall | undefined;
    void (async () => {
      try {
        const { default: Daily } = await import("@daily-co/daily-js");
        if (disposed || !container.current) return;
        call = Daily.createFrame(container.current, {
          showLeaveButton: true,
          iframeStyle: {
            width: "100%",
            height: "100%",
            border: "0",
            borderRadius: "20px",
          },
        });
        call.on("left-meeting", () => {
          if (!disposed) callbacks.current.onLeave();
        });
        call.on("error", () => {
          if (!disposed)
            callbacks.current.onError(
              "Video couldn't connect. Please try again.",
            );
        });
        await call.join({ url: credentials.url, token: credentials.token });
      } catch {
        if (!disposed)
          callbacks.current.onError(
            "Video couldn't connect. Please try again.",
          );
      }
    })();
    return () => {
      disposed = true;
      if (call) void call.destroy().catch(() => {});
    };
  }, [credentials.url, credentials.token]);
  return (
    <div className="f-video" ref={container} aria-label="Private meal video" />
  );
}
