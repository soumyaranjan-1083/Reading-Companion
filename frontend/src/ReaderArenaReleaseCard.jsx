import { motion as Motion, useReducedMotion } from "framer-motion";
import { Bug, Gem, Sparkles, Wrench } from "lucide-react";
import "./ReaderArenaReleaseCard.css";

const GROUPS = [
  { type: "feature", label: "New", Icon: Sparkles },
  { type: "improve", label: "Improved", Icon: Wrench },
  { type: "fix", label: "Fixed", Icon: Bug },
];

export default function ReaderArenaReleaseCard({ release }) {
  const reduceMotion = useReducedMotion();
  const gemStudio = release.gemStudio === true;
  return (
    <Motion.article
      className={`arena-release-card${gemStudio ? " studio" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.42, ease: "easeOut" }}
    >
      <span className="arena-release-stars" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      <span className="arena-release-orbit orbit-one" aria-hidden="true" />
      <span className="arena-release-orbit orbit-two" aria-hidden="true" />
      <header className="arena-release-head">
        <span className="arena-release-badge">{gemStudio ? <Gem size={12} /> : <Sparkles size={12} />}{release.badge || (gemStudio ? "Gem Studio release" : "Signature update")}</span>
        <time>{release.date || "Recently updated"}</time>
      </header>
      <div className="arena-release-hero">
        <span className={`arena-release-crown${gemStudio ? " gem-studio-mark" : ""}`} aria-hidden="true">
          {gemStudio ? <><i className="studio-gem-orbit" /><Gem className="studio-gem-icon" size={42} strokeWidth={1.5} /><Sparkles className="studio-gem-spark" size={13} /></> : <><Sparkles size={12} /><svg viewBox="0 0 64 64"><defs><linearGradient id="arena-release-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0b2" /><stop offset=".52" stopColor="#f5c451" /><stop offset="1" stopColor="#ff8a3d" /></linearGradient></defs><path d="m9 19 13 11 10-19 10 19 13-11-5 30H14L9 19Z" /><path d="M14 54h36" /></svg><i /></>}
        </span>
        <div className="arena-release-heading"><span>READING COMPANION · v{release.version}</span><h3>{release.title || "Reader Arena & Honest Eyes"}</h3><p>{release.subtitle || "Every page counts. Every answer stays honest."}</p></div>
      </div>
      <div className="arena-release-groups">
        {GROUPS.map(({ type, label, Icon }, groupIndex) => {
          const items = (release.items || []).filter((item) => item.type === type);
          if (!items.length) return null;
          return <Motion.section key={type} className={`arena-release-group ${type}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 0.16 + groupIndex * 0.1, duration: reduceMotion ? 0 : 0.28 }}><h4><Icon size={14} /> {label}</h4><ul>{items.map((item, index) => <Motion.li key={`${type}-${index}`} initial={reduceMotion ? false : { opacity: 0, x: -7 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduceMotion ? 0 : 0.22 + groupIndex * 0.1 + index * 0.045, duration: reduceMotion ? 0 : 0.22 }}>{item.text}</Motion.li>)}</ul></Motion.section>;
        })}
      </div>
    </Motion.article>
  );
}
