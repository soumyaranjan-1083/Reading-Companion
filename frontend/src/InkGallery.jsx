import { useState } from "react";
import { InkIcon } from "./InkIcons.jsx";
import { InkCard, InkChapter, InkGoalDial, InkHoldConfirmButton, InkMotionControl, InkShelfMeter, InkStamp, InkSwitch } from "./InkPrimitives.jsx";
import "./InkUI.css";

const ICONS = ["home", "library", "gems", "memory", "profile", "settings", "bug", "help", "info", "docs", "bell", "clock", "shield", "image", "trash", "bin", "send", "download", "upload", "refresh", "sparkle", "fingerprint", "copy", "check", "cloud", "trophy", "flame", "gem", "book", "bookmark", "quote", "feather", "mic", "voice", "chevron", "sun", "moon", "bookplate", "arena", "goal", "wave", "sunMoon", "calendar", "clockFace", "mail", "lock", "star", "layers"];

export default function InkGallery() {
  const [motion, setMotion] = useState("calm");
  const [goal, setGoal] = useState("20 min");
  const [toggle, setToggle] = useState(true);
  const [holdDone, setHoldDone] = useState(false);
  return <main className="ink-gallery">
    <div className="ink-gallery-inner">
      <h1>Ink &amp; Aurora · UI v3</h1>
      {["dark-theme", "light-theme"].map((theme) => <section key={theme} className={`ink-gallery-theme ${theme}`}>
        <h2>{theme === "dark-theme" ? "Midnight library" : "Daylight vellum"}</h2>
        <div className="ink-gallery-primitives">
          <InkChapter index="I" title="Shared surface"><InkCard><p className="ink-gallery-label">A reader's private atlas</p><p>Ink, paper and a little aurora.</p></InkCard></InkChapter>
          <InkChapter index="II" title="Controls"><InkSwitch checked={toggle} onChange={setToggle} label="Show my photo in the Arena" /><InkGoalDial value={goal} options={["10 min", "20 min", "30 min", "1 hour"]} onChange={setGoal} /><InkMotionControl value={motion} onChange={setMotion} /></InkChapter>
          <InkChapter index="III" title="Earned marks"><div className="ink-gallery-stamps"><InkStamp label="First book" earned /><InkStamp label="3-day streak" /><InkStamp label="First gem" earned /></div></InkChapter>
          <InkChapter index="IV" title="Storage"><InkShelfMeter value={318} /></InkChapter>
          <InkHoldConfirmButton label={holdDone ? "Confirmed" : "Hold to confirm"} onConfirm={() => setHoldDone(true)} />
          <div className="ink-gallery-icons">{ICONS.map((name) => <span key={name}><InkIcon name={name} size={23} /><small>{name}</small></span>)}</div>
        </div>
      </section>)}
    </div>
  </main>;
}
