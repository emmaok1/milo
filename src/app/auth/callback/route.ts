import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Next's listening address can appear as req.url's origin in development.
  // Redirect to the configured public app address instead.
  const origin = process.env.APP_ORIGIN || url.origin;
  const code = url.searchParams.get("code");
  if (code && !url.searchParams.has("error")) {
    try {
      const db = await supabase();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(
            url.searchParams.get("next") === "/reset-password"
              ? "/reset-password"
              : "/welcome",
            origin,
          ),
        );
    } catch {
      return NextResponse.redirect(
        new URL("/verify-email?error=service-unavailable", origin),
      );
    }
  }
  return NextResponse.redirect(
    new URL("/verify-email?error=invalid-link", origin),
  );
}
