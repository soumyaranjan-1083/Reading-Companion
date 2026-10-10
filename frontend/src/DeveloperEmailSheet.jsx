import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, Mail, X } from "lucide-react";
import { buildDeveloperEmail, buildDeveloperEmailLinks } from "./developerContact.js";
import { notify } from "./notify.js";
import { useBackLayer } from "./backStack.js";
import "./DeveloperEmailSheet.css";

export default function DeveloperEmailSheet({ request, user, context, onClose }) {
  const [opening, setOpening] = useState("");
  const [didNotOpen, setDidNotOpen] = useState(false);
  const dialogRef = useRef(null);
  const wentToBackground = useRef(false);
  const email = buildDeveloperEmail({ kind: request.kind, user, context: { ...context, ...request.context } });
  const links = buildDeveloperEmailLinks(email, user.email);
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  useBackLayer(true, onClose);

  useEffect(() => {
    dialogRef.current?.querySelector("button:not(:disabled)")?.focus();
  }, []);

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...dialogRef.current.querySelectorAll("button:not(:disabled), a[href]")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function launch(url, label) {
    setOpening(label);
    setDidNotOpen(false);
    wentToBackground.current = false;
    const markBackground = () => { wentToBackground.current = true; };
    const cleanup = () => {
      document.removeEventListener("visibilitychange", markBackground);
      window.removeEventListener("pagehide", markBackground);
      window.removeEventListener("blur", markBackground);
    };
    document.addEventListener("visibilitychange", markBackground);
    window.addEventListener("pagehide", markBackground, { once: true });
    window.addEventListener("blur", markBackground, { once: true });
    window.location.href = url;
    window.setTimeout(() => {
      cleanup();
      setOpening("");
      if (!wentToBackground.current) setDidNotOpen(true);
    }, 1500);
  }

  async function copyEmail() {
    const text = `To: ${email.to}\nSubject: ${email.subject}\n\n${email.body}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    notify("Email copied", "success");
  }

  return createPortal(
    <div className="dev-email-layer">
      <button className="dev-email-scrim" type="button" aria-label="Close email options" onClick={onClose} />
      <section ref={dialogRef} className="dev-email-sheet" role="dialog" aria-modal="true" aria-labelledby="dev-email-title" onKeyDown={handleKeyDown}>
        <div className="dev-email-handle" aria-hidden="true" />
        <button className="dev-email-close" type="button" aria-label="Close" onClick={onClose}><X size={19} /></button>
        <p className="dev-email-eyebrow">Contact developer</p>
        <h2 id="dev-email-title">Your email is ready</h2>
        <p className="dev-email-sending">Sending as <strong>{user.email || "your signed-in account"}</strong></p>
        <p className="dev-email-note">Your mail app chooses the From account. You can switch it in the compose screen.</p>
        <div className="dev-email-preview">
          <p><b>To</b><span>{email.to}</span></p>
          <p><b>Subject</b><span>{email.subject}</span></p>
          <pre>{email.body}</pre>
        </div>
        {didNotOpen && <p className="dev-email-fallback" role="status">Didn’t open? Try another option.</p>}
        <div className="dev-email-actions">
          <button type="button" onClick={() => launch(links.gmailApp, "gmail-app")} disabled={!isAndroid || !!opening}>
            <Mail size={17} /> {opening === "gmail-app" ? "Opening mail…" : "Open Gmail app"}
          </button>
          <button type="button" onClick={() => launch(links.mailto, "mail-app")} disabled={!!opening}>
            <ExternalLink size={17} /> {opening === "mail-app" ? "Opening mail…" : "Open mail app"}
          </button>
          <a href={links.gmail} target="_blank" rel="noreferrer"><Mail size={17} /> Open Gmail in browser</a>
          <button type="button" onClick={copyEmail}><Copy size={17} /> Copy email</button>
        </div>
        {!isAndroid && <small className="dev-email-platform"><Check size={13} /> Gmail app link is available on Android</small>}
      </section>
    </div>,
    document.body,
  );
}