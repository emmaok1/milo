import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile-app.css";
import PwaClient from "@/components/pwa-client";
export const metadata: Metadata = {
  title: "Haven · Your listener",
  applicationName: "Haven",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Haven", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  description:
    "A gentle space to talk, find small next steps, and ask for support. Cal Hacks 13.0 prototype.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f5f1",
  interactiveWidget: "resizes-content",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaClient />
        {children}
      </body>
    </html>
  );
}
