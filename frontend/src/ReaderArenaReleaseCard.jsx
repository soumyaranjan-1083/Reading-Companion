import { motion as Motion, useReducedMotion } from "framer-motion";
import { Bug, Sparkles, Wrench } from "lucide-react";
import "./ReaderArenaReleaseCard.css";

const GROUPS = [
  { type: "feature", label: "New", Icon: Sparkles },
  { type: "improve", label: "Improved", Icon: Wrench },
  { type: "fix", label: "Fixed", Icon: Bug },
];

export default function ReaderArenaReleaseCard({ release }) {
  const reduceMotion = useReducedMotion();
  return (
    <Motion.article
      className="arena-release-card"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.42, ease: "easeOut" }}
    >
      <span className="arena-release-stars" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      <span className="arena-release-orbit orbit-one" aria-hidden="true" />
      <span className="arena-release-orbit orbit-two" aria-hidden="true" />
      <header className="arena-release-head">
        <span className="arena-release-badge"><Sparkles size={12} /> Signature update</span>
        <time>{release.date || "Recently updated"}</time>
      </header>
      <div className="arena-release-hero">
        <span className="arena-release-crown" aria-hidden="true"><Sparkles size={12} /><svg viewBox="0 0 64 64"><defs><linearGradient id="arena-release-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0b2" /><stop offset=".52" stopColor="#f5c451" /><stop offset="1" stopColor="#ff8a3d" /></linearGradient></defs><path d="m9 19 13 11 10-19 10 19 13-11-5 30H14L9 19Z" /><path d="M14 54h36" /></svg><i /></span>
        <div className="arena-release-heading"><span>READING COMPANION · v{release.version}</span><h3>{release.title || "Reader Arena & Honest Eyes"}</h3><p>Every page counts. Every answer stays honest.</p></div>
      </div>
      <div className="arena-release-groups">
        {GROUPS.map(({ type, label, Icon }) => {
          const items = (release.items || []).filter((item) => item.type === type);
          if (!items.length) return null;
          return <section key={type} className={`arena-release-group ${type}`}><h4><Icon size={14} /> {label}</h4><ul>{items.map((item, index) => <li key={`${type}-${index}`}>{item.text}</li>)}</ul></section>;
        })}
      </div>
    </Motion.article>
  );
}
