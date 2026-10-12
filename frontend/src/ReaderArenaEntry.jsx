import { motion as Motion, useReducedMotion } from "framer-motion";
import { useEffect, useEffectEvent, useState } from "react";
import { InkIcon } from "./InkIcons.jsx";
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

export default function ReaderArenaEntry({ onOpen, onRankChange }) {
  const { triggerLightTap } = useHaptic();
  const reduceMotion = useReducedMotion();
  const { now, visible } = useVisibleClock();
  const [rank, setRank] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const reportRank = useEffectEvent((reader) => onRankChange?.(reader));

  useEffect(() => {
    let cancelled = false;
    fetchReaderRankings("weekly").then(({ rankings }) => {
      if (cancelled) return;
      const reader = rankings.find((entry) => entry.isYou) || null;
      setRank(reader);
      reportRank(reader);
      setLoaded(true);
    }).catch(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [onRankChange]);

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
        <span className="arena-entry-diorama"><i /><i /><i /><b>{rank ? `#${rank.rank}` : "·"}</b></span>
      </span>
      <span className="pf-tile-text arena-entry-copy">
      <b>{rank ? <>You’re #{rank.rank} this week</> : "Reader Arena"}</b>
      <small>{rank ? "" : loaded ? "Join the race · " : "Finding your place · "}Resets in {formatWeekCountdown(now)}</small>
      </span>
      <InkIcon name="chevron" size={19} className="pf-tile-go" />
    </Motion.button>
  );
}
