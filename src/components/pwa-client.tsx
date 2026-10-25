"use client";
import { useEffect } from "react";
export default function PwaClient() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext)
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    const viewport = window.visualViewport;
    const resize = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${viewport?.height || window.innerHeight}px`,
      );
      document.documentElement.dataset.keyboard =
        viewport && viewport.height < window.innerHeight - 140
          ? "open"
          : "closed";
    };
    resize();
    viewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return null;
}
