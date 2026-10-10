import assert from "node:assert/strict";
import test from "node:test";
import { APP_VERSION } from "./version.js";
import { buildDeveloperEmail, buildDeveloperEmailLinks, CONTACT } from "./developerContact.js";

test("docs-access email contains its request, reader details, and app version", () => {
  const email = buildDeveloperEmail({
    kind: "docs_access",
    user: { id: "123e4567-e89b-12d3-a456-426614174000", displayName: "A Reader", email: "reader@example.com" },
    context: { reason: "I need the API flow details." },
  });
  const urls = buildDeveloperEmailLinks(email, "reader@example.com");
  const gmailUrl = new URL(urls.gmail);
  const mailtoUrl = new URL(urls.mailto);

  assert.equal(gmailUrl.origin + gmailUrl.pathname, "https://mail.google.com/mail/");
  assert.equal(gmailUrl.searchParams.get("view"), "cm");
  assert.equal(gmailUrl.searchParams.get("fs"), "1");
  assert.equal(gmailUrl.searchParams.get("to"), CONTACT.email);
  assert.equal(gmailUrl.searchParams.get("authuser"), "reader@example.com");
  assert.equal(gmailUrl.searchParams.get("su"), "[Reading Companion] Docs access request (UID 123e4567)");
  assert.match(gmailUrl.searchParams.get("body"), /Reader UID: 123e4567-e89b-12d3-a456-426614174000/);
  assert.match(gmailUrl.searchParams.get("body"), /Reason: I need the API flow details/);
  assert.match(gmailUrl.searchParams.get("body"), new RegExp(`App version: ${APP_VERSION}`));
  assert.equal(mailtoUrl.protocol, "mailto:");
  assert.equal(mailtoUrl.pathname, CONTACT.email);
  assert.equal(mailtoUrl.searchParams.get("subject"), gmailUrl.searchParams.get("su"));
  assert.equal(mailtoUrl.searchParams.get("body"), gmailUrl.searchParams.get("body").replace(/\n/g, "\r\n"));
});

test("limit email includes quota, device, browser, local time, and signature", () => {
  const email = buildDeveloperEmail({
    kind: "limit_increase",
    user: { id: "123e4567-e89b-12d3-a456-426614174000", name: "Reader" },
    context: { dailyLimitMinutes: 30, minutesUsedToday: 29.5, device: "Android", browser: "Chrome", localTime: "10 Oct 2026, 8:00 AM" },
  });
  assert.equal(email.subject, "[Reading Companion] Reading limit increase request (UID 123e4567)");
  assert.match(email.body, /Current daily limit: 30 minutes/);
  assert.match(email.body, /Minutes used today: 29.5/);
  assert.match(email.body, /Device: Android/);
  assert.match(email.body, /Browser: Chrome/);
  assert.match(email.body, /Local time: 10 Oct 2026, 8:00 AM/);
  assert.match(email.body, /Best regards,\nReader\nReading Companion reader/);
});

test("Unicode names and special characters are encoded in compose URLs", () => {
  const email = buildDeveloperEmail({ kind: "docs_access", user: { id: "reader-1", name: "रीना 📚" }, context: { reason: "नमस्ते & help" } });
  const urls = buildDeveloperEmailLinks(email, "reader+books@example.com");
  assert.match(new URL(urls.gmail).searchParams.get("body"), /रीना 📚/);
  assert.match(new URL(urls.gmail).searchParams.get("body"), /नमस्ते & help/);
  assert.match(urls.mailto, /%0D%0A/);
  assert.match(urls.gmailApp, /package=com\.google\.android\.gm/);
});

test("missing optional fields never produce undefined and missing UID is explicit", () => {
  const email = buildDeveloperEmail({ kind: "docs_access" });
  assert.match(email.body, /Reader UID: Unavailable/);
  assert.doesNotMatch(`${email.subject}\n${email.body}`, /undefined/i);
});

test("long names and optional context keep compose URLs under the safe limit", () => {
  const email = buildDeveloperEmail({
    kind: "limit_increase",
    user: { id: "123e4567-e89b-12d3-a456-426614174000", name: "📖".repeat(150), email: "reader@example.com" },
    context: { dailyLimitMinutes: 30, minutesUsedToday: 30, device: "Android".repeat(50), browser: "Chrome".repeat(50), localTime: "today".repeat(100) },
  });
  const urls = buildDeveloperEmailLinks(email, "reader@example.com");
  assert.ok(urls.gmail.length <= 1800);
  assert.ok(urls.mailto.length <= 1800);
  assert.match(email.body, /Reader UID: 123e4567-e89b-12d3-a456-426614174000/);
});