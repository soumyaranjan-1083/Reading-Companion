import { AnimatePresence, motion as Motion } from "framer-motion";
import { Bug, ChevronRight, Download, Rocket, Sparkles, ThumbsUp, Wrench } from "lucide-react";
import { useState } from "react";
import "./UpdateAnnouncement.css";

const ICON = { fix: Bug, feature: Sparkles, improve: Wrench };
const LABEL = { fix: "Fixed", feature: "New", improve: "Better" };
const UPDATE_PATH = ["Profile", "Settings", "Check for updates"];

export default function UpdateAnnouncement({ available, releases = [], paused = false, onUpdate }) {
  const [phase, setPhase] = useState("prompt");
  const [busy, setBusy] = useState(false);
  const open = available && !paused && phase !== "closed";
  const newest = releases[0]?.version;
  const latestTitle = releases[0]?.title;
  const highlights = releases
    .flatMap((release) => (release.items || []).map((item, index) => ({ ...item, key: `${release.version}-${index}` })))
    .slice(0, 4);

  return (
    <AnimatePresence>
      {open && (
        <Motion.div className="ua-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Motion.section
            className="ua-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ua-title"
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
          >
            {phase === "prompt" ? (
              <>
                <div className="ua-heading">
                  <div className="ua-icon"><Rocket size={24} /></div>
                  <span className="ua-version">{newest ? `v${newest}` : "New release"}</span>
                </div>
                <h2 id="ua-title">Update available</h2>
                <p className="ua-sub">{latestTitle ? `${latestTitle} is ready to install.` : "A newer version of Reading Companion is ready."}</p>

                {highlights.length > 0 && (
                  <>
                    <div className="ua-changelog-heading"><span>What's new</span><small>{highlights.length} highlights</small></div>
                    <ul className="ua-list">
                      {highlights.map((item, index) => {
                        const Icon = ICON[item.type] || Sparkles;
                        return (
                          <Motion.li
                            key={item.key}
                            initial={{ opacity: 0, x: -14 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + index * 0.08 }}
                          >
                            <span className="ua-li-icon"><Icon size={14} /></span>
                            <span><em>{LABEL[item.type] || "New"}</em> {item.text}</span>
                          </Motion.li>
                        );
                      })}
                    </ul>
                  </>
                )}

                <div className="ua-actions">
                  <button type="button" className="ua-ghost" onClick={() => setPhase("later")}>Later</button>
                  <button
                    type="button"
                    className="ua-primary"
                    disabled={busy}
                    onClick={() => { setBusy(true); onUpdate?.(); }}
                  >
                    <Download size={16} /> {busy ? "Updating…" : "Update now"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="ua-icon"><ThumbsUp size={26} /></div>
                <h2 id="ua-title">No problem!</h2>
                <p className="ua-sub">You can update any time by going to:</p>
                <div className="ua-path" aria-label={UPDATE_PATH.join(", then ")}>
                  {UPDATE_PATH.map((step, index) => (
                    <span key={step} className="ua-path-step">
                      {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
                      <b>{step}</b>
                    </span>
                  ))}
                </div>
                <p className="ua-hint">A red number will stay on Profile and Settings until you update.</p>
                <div className="ua-actions">
                  <button type="button" className="ua-primary full" onClick={() => setPhase("closed")}>Got it</button>
                </div>
              </>
            )}
          </Motion.section>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
