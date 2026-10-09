import { motion as Motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchReaderRankings } from "./readingQuota.js";
import { formatWeekCountdown } from "./readerArenaTime.js";
import { useHaptic } from "./useHaptic.js";
import "./ReaderArenaEntry.css";

function useVisibleClock() {
  const [now, setNow] = useState(() => new Date());
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const onVisibility = () => {
      const isVisible = document.visibilityState === "visible";
      setVisible(isVisible);
      if (isVisible) setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [visible]);
  return { now, visible };
}

export default function ReaderArenaEntry({ onOpen }) {
  const { triggerLightTap } = useHaptic();
  const reduceMotion = useReducedMotion();
  const { now, visible } = useVisibleClock();
  const [rank, setRank] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchReaderRankings("weekly").then(({ rankings }) => {
      if (cancelled) return;
      setRank(rankings.find((reader) => reader.isYou) || null);
      setLoaded(true);
    }).catch(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <Motion.button
      type="button"
      className="pf-tile arena-entry"
      data-paused={!visible}
      onClick={() => { triggerLightTap(); onOpen(); }}
      whileTap={visible && !reduceMotion ? { scale: 0.975 } : undefined}
      transition={{ duration: visible && !reduceMotion ? 0.18 : 0 }}
      aria-label={`Open Reader Arena. ${rank ? `You are ranked number ${rank.rank} this week.` : "Join the weekly reading race."} Resets in ${formatWeekCountdown(now)}.`}
    >
      <span className="arena-entry-frame" aria-hidden="true" />
      <span className="arena-entry-mark" aria-hidden="true">
        <span className="arena-entry-orbit"><i /><i /><i /></span>
        <svg viewBox="0 0 64 64" role="presentation">
          <defs>
            <linearGradient id="arena-entry-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffe59a" /><stop offset=".46" stopColor="#f5c451" /><stop offset="1" stopColor="#ff8a3d" />
            </linearGradient>
            <linearGradient id="arena-entry-jewel" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#ec4899" /><stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path d="M18 9h28v11c0 11-5.2 18-14 18S18 31 18 20V9Z" fill="url(#arena-entry-gold)" />
          <path d="M18 14H8v5c0 9 5 14 13 14M46 14h10v5c0 9-5 14-13 14" fill="none" stroke="url(#arena-entry-gold)" strokeWidth="5" strokeLinecap="round" />
          <path d="M24 39v8h16v-8M19 54h26" fill="none" stroke="url(#arena-entry-jewel)" strokeWidth="6" strokeLinecap="round" />
          <path d="m32 13 2.3 4.8 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.7L32 13Z" fill="#fff8dc" />
        </svg>
        <span className="arena-entry-sparkle sparkle-one"><Sparkles size={11} /></span>
        <span className="arena-entry-sparkle sparkle-two"><Sparkles size={9} /></span>
      </span>
      <span className="pf-tile-text arena-entry-copy">
        <span className="arena-entry-kicker">THE READING RACE</span>
        <b>Reader Arena</b>
        <small>{rank ? <><i className="arena-live-dot" /> You’re #{rank.rank} this week</> : loaded ? "Join the race" : "Finding your place…"}</small>
        <span className="arena-reset-line">Resets in {formatWeekCountdown(now)}</span>
      </span>
      <ChevronRight size={19} className="pf-tile-go" />
    </Motion.button>
  );
}
