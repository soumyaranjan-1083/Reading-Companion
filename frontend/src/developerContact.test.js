import assert from "node:assert/strict";
import test from "node:test";
import { APP_VERSION } from "./version.js";
import { buildContactEmail, CONTACT, openContactEmail } from "./developerContact.js";

test("Gmail compose links include the request context and signed reader details", () => {
  const { gmail, mailto } = buildContactEmail({
    subject: "Reading Companion docs access request",
    request: "I would like access to the private technical documentation.",
    userId: "123e4567-e89b-12d3-a456-426614174000",
    name: "A Reader",
  });
  const gmailUrl = new URL(gmail);
  const mailtoUrl = new URL(mailto);

  assert.equal(gmailUrl.origin + gmailUrl.pathname, "https://mail.google.com/mail/");
  assert.equal(gmailUrl.searchParams.get("view"), "cm");
  assert.equal(gmailUrl.searchParams.get("fs"), "1");
  assert.equal(gmailUrl.searchParams.get("to"), CONTACT.email);
  assert.equal(gmailUrl.searchParams.get("su"), "Reading Companion docs access request");
  assert.match(gmailUrl.searchParams.get("body"), /Supabase user ID: 123e4567-e89b-12d3-a456-426614174000/);
  assert.match(gmailUrl.searchParams.get("body"), /private technical documentation/);
  assert.match(gmailUrl.searchParams.get("body"), new RegExp(`App version: ${APP_VERSION}`));
  assert.match(gmailUrl.searchParams.get("body"), /Best regards,\nA Reader\nReading Companion reader/);
  assert.equal(mailtoUrl.protocol, "mailto:");
  assert.equal(mailtoUrl.pathname, CONTACT.email);
  assert.equal(mailtoUrl.searchParams.get("subject"), gmailUrl.searchParams.get("su"));
  assert.equal(mailtoUrl.searchParams.get("body"), gmailUrl.searchParams.get("body"));
});

test("missing reader name or UID still produces a complete signed compose body", () => {
  const { gmail } = buildContactEmail({ subject: "Limit increase", request: "Please review my limit increase request." });
  const body = new URL(gmail).searchParams.get("body");

  assert.match(body, /Supabase user ID: Unavailable/);
  assert.match(body, /Best regards,\nReader\nReading Companion reader/);
});

test("blocked Gmail compose falls back to the matching mailto URL", () => {
  const originalWindow = globalThis.window;
  let fallbackUrl = "";
  globalThis.window = { open: () => null, location: { assign: (url) => { fallbackUrl = url; } } };

  try {
    assert.equal(openContactEmail({ subject: "Limit increase", request: "Please review my request.", userId: "reader-id" }), "mailto");
    assert.match(fallbackUrl, /^mailto:/);
    assert.equal(new URL(fallbackUrl).searchParams.get("subject"), "Limit increase");
    assert.match(new URL(fallbackUrl).searchParams.get("body"), /Supabase user ID: reader-id/);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});