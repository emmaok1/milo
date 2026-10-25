import { z } from "zod";

export const authEmail = z.string().trim().pipe(z.email());
// Supabase projects can configure the length of numeric email codes.
export const emailVerificationCode = z.string().trim().regex(/^\d{6,10}$/);

export function authFailure(error: {
  code?: string;
  status?: number;
  message: string;
}) {
  switch (error.code) {
    case "email_address_not_authorized":
      return {
        status: 503,
        message:
          "Verification email could not be sent. Please contact support to check the email service configuration.",
      };
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return {
        status: 429,
        message:
          "Too many requests. Please wait a few minutes before trying again.",
      };
    case "email_not_confirmed":
      return {
        status: 403,
        message:
          "Please verify your email before signing in. You can request a new code on the verification page.",
      };
    case "otp_expired":
      return {
        status: 400,
        message: "This code is invalid or has expired. Check the latest email or request a new code.",
      };
    default:
      if (error.status && error.status >= 500)
        return {
          status: 503,
          message:
            "Authentication is temporarily unavailable. Please try again shortly.",
        };
      return {
        status: error.status === 429 ? 429 : 400,
        message: error.message,
      };
  }
}

export function verificationFailure(code: string | null) {
  if (!code) return "";
  if (code === "service-unavailable")
    return "Email verification is temporarily unavailable. Please try the link again shortly.";
  return "This verification link has expired or could not be verified. Request a new verification code below and enter it here. If you already verified your email, try signing in.";
}
