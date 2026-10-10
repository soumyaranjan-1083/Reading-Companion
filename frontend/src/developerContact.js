// Contact targets are only used when a button is tapped and are never rendered.
import { APP_VERSION } from "./version.js";

export const CONTACT = {
  linkedin: "https://www.linkedin.com/in/soumyaranjan-rout-b16145185/",
  github: "https://github.com/soumyaranjan-1083",
  email: "soumyaranjan.rout1083@gmail.com",
};

const DEFAULT_REQUESTS = {
  docs_access: {
    subject: (uid) => `[Reading Companion] Docs access request (UID ${uid})`,
    request: "I would like access to the Reading Companion technical documentation.",
  },
  limit_increase: {
    subject: (uid) => `[Reading Companion] Reading limit increase request (UID ${uid})`,
    request: "I would like to request a higher daily reading limit.",
  },
};

function safeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function makeBody({ kind, request, uid, name, context }) {
  const lines = ["Hello,", "", request];
  if (kind === "docs_access" && context.reason) lines.push(`Reason: ${context.reason}`);
  lines.push("", `Reader UID: ${uid}`, `Display name: ${name}`);
  if (kind === "limit_increase") {
    lines.push(
      `Current daily limit: ${Number.isFinite(context.dailyLimitMinutes) ? context.dailyLimitMinutes : "Unavailable"} minutes`,
      `Minutes used today: ${Number.isFinite(context.minutesUsedToday) ? context.minutesUsedToday : "Unavailable"}`,
      `Device: ${context.device || "Unavailable"}`,
      `Browser: ${context.browser || "Unavailable"}`,
      `Local time: ${context.localTime || "Unavailable"}`,
    );
  }
  lines.push(`App version: ${APP_VERSION}`, "", "Please review my request when you can.", "", "Best regards,", name, "Reading Companion reader");
  return lines.join("\n");
}

function gmailUrl({ to, subject, body, accountEmail }) {
  const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  if (accountEmail) params.set("authuser", accountEmail);
  return `https://mail.google.com/mail/?${params}`;
}

function mailtoUrl({ to, subject, body }) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;
}

export function buildDeveloperEmail({ kind, user = {}, context = {} }) {
  const template = DEFAULT_REQUESTS[kind];
  if (!template) throw new TypeError(`Unsupported developer email kind: ${kind}`);
  const uid = safeText(user.id || user.uid, "Unavailable");
  const uidShort = uid === "Unavailable" ? uid : uid.slice(0, 8);
  const name = Array.from(safeText(user.displayName || user.name || user.user_metadata?.full_name, "Reader")).slice(0, 40).join("");
  const request = safeText(context.request, template.request).slice(0, 360);
  const boundedContext = {
    ...context,
    reason: safeText(context.reason).slice(0, 360),
    device: safeText(context.device).slice(0, 80),
    browser: safeText(context.browser).slice(0, 80),
    localTime: safeText(context.localTime).slice(0, 100),
  };
  let body = makeBody({ kind, request, uid, name, context: boundedContext });
  const subject = template.subject(uidShort);

  // Keep compose URLs portable; drop optional environment details before required request data.
  const urlLength = (candidate) => Math.max(
    gmailUrl({ to: CONTACT.email, subject, body: candidate, accountEmail: user.email }).length,
    mailtoUrl({ to: CONTACT.email, subject, body: candidate }).length,
  );
  if (urlLength(body) > 1800 && kind === "limit_increase") {
    boundedContext.device = "";
    boundedContext.browser = "";
    body = makeBody({ kind, request, uid, name, context: boundedContext });
  }
  if (urlLength(body) > 1800 && kind === "limit_increase") {
    boundedContext.localTime = "";
    body = makeBody({ kind, request, uid, name, context: boundedContext });
  }
  if (urlLength(body) > 1800 && boundedContext.reason) {
    boundedContext.reason = "";
    body = makeBody({ kind, request, uid, name, context: boundedContext });
  }
  return { to: CONTACT.email, subject, body };
}

export function buildDeveloperEmailLinks(email, accountEmail = "") {
  return {
    gmail: gmailUrl({ ...email, accountEmail }),
    mailto: mailtoUrl(email),
    gmailApp: `intent://#Intent;scheme=mailto;action=android.intent.action.SENDTO;package=com.google.android.gm;S.android.intent.extra.EMAIL=${encodeURIComponent(email.to)};S.android.intent.extra.SUBJECT=${encodeURIComponent(email.subject)};S.android.intent.extra.TEXT=${encodeURIComponent(email.body)};end`,
  };
}