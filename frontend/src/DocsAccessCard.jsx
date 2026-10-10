import { useState } from "react";
import { createPortal } from "react-dom";
import { BookMarked, ChevronRight, Mail, ShieldAlert, X } from "lucide-react";
import { checkDocsAccess } from "./docsAccess.js";
import { useBackLayer } from "./backStack.js";
import "./DocsAccessCard.css";

// The Profile "Docs" tile. Owners go straight in; anyone else sees a friendly "not authorised" notice.
export default function DocsAccessCard({ onOpen, onContact }) {
  const [checking, setChecking] = useState(false);
  const [denied, setDenied] = useState(false);
  useBackLayer(denied, () => setDenied(false));

  async function handleOpen() {
    if (checking) return;
    setChecking(true);
    try {
      const result = await checkDocsAccess({ retries: 2 });
      if (result.status === "denied") setDenied(true);
      else onOpen();
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <button type="button" className="pf-tile docs" onClick={handleOpen} aria-busy={checking}>
        <span className="pf-tile-ic"><BookMarked size={20} /></span>
        <span className="pf-tile-text"><b>Docs</b><small>{checking ? "Checking access…" : "How everything is built and run"}</small></span>
        <ChevronRight size={18} className="pf-tile-go" />
      </button>
      {denied && createPortal(
        <div className="dac-wrap" role="alertdialog" aria-labelledby="dac-title" aria-describedby="dac-text">
          <button type="button" className="dac-scrim" aria-label="Close" onClick={() => setDenied(false)} />
          <div className="dac-card">
            <span className="dac-ring" aria-hidden="true" /><span className="dac-ring two" aria-hidden="true" />
            <div className="dac-icon"><ShieldAlert size={30} /></div>
            <h3 id="dac-title">You’re not authorised</h3>
            <p id="dac-text">You are not authorised to view these docs. Please contact the developer to request access.</p>
            <button type="button" className="dac-mail" onClick={() => onContact("docs_access", {
              request: "I would like access to the Reading Companion technical documentation.",
              reason: "I am requesting access to the technical documentation.",
            })} aria-label="Contact the developer about docs access">
              <Mail size={18} /> Contact developer
            </button>
            <button type="button" className="dac-close" onClick={() => setDenied(false)} aria-label="Close"><X size={16} /></button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}