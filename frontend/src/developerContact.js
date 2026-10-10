// Contact targets are only used when a button is tapped and are never rendered.
import { APP_VERSION } from "./version.js";

export const CONTACT = {
  linkedin: "https://www.linkedin.com/in/soumyaranjan-rout-b16145185/",
  github: "https://github.com/soumyaranjan-1083",
  email: "soumyaranjan.rout1083@gmail.com",
};

export function buildContactEmail({ subject, request, userId, name = "Reader" }) {
  const body = [
    "Hello,",
    "",
    request,
    "",
    `Supabase user ID: ${userId || "Unavailable"}`,
    `App version: ${APP_VERSION}`,
    "",
    "Please review my request and let me know the next steps.",
    "",
    "Best regards,",
    name || "Reader",
    "Reading Companion reader",
  ].join("\n");
  const gmailParams = new URLSearchParams({ view: "cm", fs: "1", to: CONTACT.email, su: subject, body });
  const mailtoParams = new URLSearchParams({ subject, body });
  return {
    gmail: `https://mail.google.com/mail/?${gmailParams}`,
    mailto: `mailto:${CONTACT.email}?${mailtoParams}`,
  };
}

export function openContactEmail(options) {
  const { gmail, mailto } = buildContactEmail(options);
  const composeWindow = window.open(gmail, "_blank");
  if (composeWindow) {
    composeWindow.opener = null;
    return "gmail";
  }
  window.location.assign(mailto);
  return "mailto";
}