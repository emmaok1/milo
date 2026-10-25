import test from "node:test";
import assert from "node:assert/strict";
import {
  authEmail,
  authFailure,
  emailVerificationCode,
  verificationFailure,
} from "../src/lib/auth-flow";

test("email validation trims pasted whitespace and rejects invalid addresses", () => {
  assert.equal(
    authEmail.parse("  new-user@example.com  "),
    "new-user@example.com",
  );
  for (const value of ["", "  ", "invalid", undefined])
    assert.equal(authEmail.safeParse(value).success, false);
});

test("email service restrictions, throttling and unconfirmed users get actionable errors", () => {
  const restricted = authFailure({
    code: "email_address_not_authorized",
    message: "provider detail",
  });
  assert.equal(restricted.status, 503);
  assert.match(restricted.message, /email service configuration/);
  for (const code of [
    "over_email_send_rate_limit",
    "over_request_rate_limit",
  ]) {
    const throttled = authFailure({ code, message: "provider detail" });
    assert.equal(throttled.status, 429);
    assert.match(throttled.message, /wait/);
  }
  const unconfirmed = authFailure({
    code: "email_not_confirmed",
    message: "provider detail",
  });
  assert.equal(unconfirmed.status, 403);
  assert.match(unconfirmed.message, /new code/);
  assert.equal(
    authFailure({ code: "invalid_credentials", message: "Invalid credentials" })
      .message,
    "Invalid credentials",
  );
});

test("provider outages do not leak server errors or get mislabeled as mail failures", () => {
  const failure = authFailure({
    code: "unexpected_failure",
    status: 500,
    message: "private server detail",
  });
  assert.equal(failure.status, 503);
  assert.match(failure.message, /Authentication is temporarily unavailable/);
  assert.doesNotMatch(failure.message, /private server detail/);
});

test("expired links and callback outages show recovery instructions without reflecting URL text", () => {
  assert.equal(verificationFailure(null), "");
  assert.match(verificationFailure("invalid-link"), /new verification code/);
  assert.match(
    verificationFailure("service-unavailable"),
    /temporarily unavailable/,
  );
  assert.doesNotMatch(
    verificationFailure("untrusted-url-error"),
    /untrusted-url-error/,
  );
});

test("email codes retain leading zeros and reject links, empty and malformed input", () => {
  assert.equal(emailVerificationCode.parse(" 001234 "), "001234");
  assert.equal(emailVerificationCode.parse("12345678"), "12345678");
  for (const code of ["", "12345", "12345678901", "123abc", "https://example.com", undefined])
    assert.equal(emailVerificationCode.safeParse(code).success, false);
  const expired = authFailure({ code: "otp_expired", message: "provider detail" });
  assert.equal(expired.status, 400);
  assert.match(expired.message, /request a new code/);
});
