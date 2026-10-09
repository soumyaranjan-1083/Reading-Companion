import { AnimatePresence, LayoutGroup, MotionConfig, animate as animateMotion, motion as Motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ChevronLeft, Clock3, Crown, Medal, RefreshCw, Sparkles, TrendingUp, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBackLayer } from "./backStack.js";
import { fetchReaderRankings } from "./readingQuota.js";
import { formatWeekCountdown } from "./readerArenaTime.js";
import { useHaptic } from "./useHaptic.js";
import "./ReaderArena.css";

const BURST_PARTICLES = [
  [-42, -30], [-27, -48], [-8, -55], [17, -48], [39, -36], [53, -12], [43, 14], [27, 34], [5, 49], [-18, 43], [-39, 24], [-53, 2],
];

function formatDuration(seconds) {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours) return `${hours}h${minutes ? ` ${minutes}m` : ""}`;
  return totalMinutes ? `${totalMinutes}m` : `${seconds}s`;
}

function initials(name) {
  const words = String(name || "Reader").trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)[0]}` : words[0]?.slice(0, 2) || "R").toLocaleUpperCase();
}

function stableReaderKeys(readers) {
  const counts = new Map();
  return readers.map((reader) => {
    const base = reader.isYou ? "you" : String(reader.name || "Reader").toLocaleLowerCase();
    const index = counts.get(base) || 0;
    counts.set(base, index + 1);
    return { ...reader, key: `${base}-${index}` };
  });
}

function CountUp({ value, delay = 0, paused = false }) {
  const motionValue = useMotionValue(paused ? value : 0);
  const formatted = useTransform(motionValue, (current) => formatDuration(Math.round(current)));
  useEffect(() => {
    if (paused) {
      motionValue.set(value);
      return undefined;
    }
    motionValue.set(0);
    const controls = animateMotion(motionValue, value, { duration: 1.15, delay, ease: [0.17, 0.67, 0.3, 1] });
    return () => controls.stop();
  }, [delay, motionValue, paused, value]);
  return <Motion.span>{formatted}</Motion.span>;
}

function useArenaClock() {
  const [now, setNow] = useState(() => new Date());
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const update = () => {
      const isVisible = document.visibilityState === "visible";
      setVisible(isVisible);
      if (isVisible) setNow(new Date());
    };
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [visible]);
  return { now, visible };
}

function TiesLabel({ reader, readers }) {
  return readers.filter((item) => item.rank === reader.rank).length > 1 ? <span className="arena-tie">TIE</span> : null;
}

function PodiumReader({ reader, readers, slotColumn, onSelect, paused, reduceMotion, burst }) {
  const rankDelay = reader.rank === 3 ? 0.04 : reader.rank === 2 ? 0.22 : 0.4;
  return (
    <Motion.button
      type="button"
      layout
      layoutId={`arena-reader-${reader.key}`}
      className={`arena-podium-reader rank-${reader.rank}`}
      style={{ "--podium-col": slotColumn }}
      onClick={() => onSelect(reader)}
      initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: paused || reduceMotion ? 0 : 0.52, delay: paused || reduceMotion ? 0 : rankDelay, ease: [0.2, 0.72, 0.22, 1] }}
      aria-label={`Rank ${reader.rank}, ${reader.name}, ${formatDuration(reader.totalSeconds)} reading time${reader.isYou ? ", you" : ""}`}
    >
      <span className="arena-podium-avatar-wrap" aria-hidden="true">
        <span className="arena-avatar-ring" />
        <span className="arena-avatar-initials">{initials(reader.name)}</span>
        {reader.rank === 1 && <Crown className="arena-crown" size={23} fill="currentColor" />}
      </span>
      <span className="arena-podium-name">{reader.name}<TiesLabel reader={reader} readers={readers} />{reader.isYou && <span className="arena-you-tag">YOU</span>}</span>
      <strong className="arena-podium-time"><CountUp value={reader.totalSeconds} delay={paused ? 0 : rankDelay} paused={paused || reduceMotion} /></strong>
      <span className="arena-pedestal"><span>#{reader.rank}</span></span>
      {reader.rank === 1 && burst && !reduceMotion && !paused && (
        <span className="arena-stars-burst" aria-hidden="true">
          {BURST_PARTICLES.map(([x, y], particleIndex) => <i key={particleIndex} style={{ "--burst-x": `${x}px`, "--burst-y": `${y}px`, animationDelay: `${particleIndex * 18}ms` }} />)}
        </span>
      )}
    </Motion.button>
  );
}

function RankingRow({ reader, readers, maximum, index, onSelect, paused, reduceMotion }) {
  const percentage = maximum > 0 ? Math.max(3, Math.min(100, (reader.totalSeconds / maximum) * 100)) : 0;
  return (
    <li>
      <Motion.button
        type="button"
        layout
        layoutId={`arena-reader-${reader.key}`}
        className={`arena-row${reader.rank <= 10 ? " top-ten" : ""}${reader.isYou ? " is-you" : ""}`}
        onClick={() => onSelect(reader)}
        initial={reduceMotion ? false : { opacity: 0, y: 9 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: paused || reduceMotion ? 0 : 0.28, delay: paused || reduceMotion ? 0 : Math.min(index * 0.035, 0.32) }}
        aria-label={`Rank ${reader.rank}, ${reader.name}, ${formatDuration(reader.totalSeconds)} reading time${reader.isYou ? ", you" : ""}`}
      >
        <span className="arena-row-rank">#{reader.rank}{readers.filter((item) => item.rank === reader.rank).length > 1 ? "=" : ""}</span>
        <span className="arena-row-avatar" aria-hidden="true">{initials(reader.name)}</span>
        <span className="arena-row-main">
          <span className="arena-row-name"><span className="arena-row-name-text">{reader.name}</span>{reader.isYou && <span className="arena-you-tag">YOU</span>}</span>
          <span className="arena-stat-pills"><span className="arena-stat-pill"><Clock3 size={11} /> Reading time</span></span>
          <span className="arena-row-progress" aria-hidden="true"><i style={{ transform: `scaleX(${percentage / 100})`, transitionDuration: paused || reduceMotion ? "0ms" : "650ms" }} /></span>
        </span>
          <strong className="arena-row-score"><CountUp value={reader.totalSeconds} paused={paused || reduceMotion} /></strong>
      </Motion.button>
    </li>
  );
}

function SelfArenaCard({ reader, rankings, onJoin, visible, reduceMotion }) {
  if (!reader) {
    return (
      <section className="arena-self arena-self-unranked" aria-label="Your Reader Arena ranking">
        <span className="arena-self-medal"><Sparkles size={19} /></span>
        <span className="arena-self-copy"><span>YOUR PLACE IN THE ARENA</span><b>Join the race</b><small>Your next reading session can put you on the board.</small></span>
        <button type="button" className="arena-action" onClick={onJoin}>Read now</button>
      </section>
    );
  }
  const above = rankings.filter((entry) => entry.rank < reader.rank).sort((left, right) => right.rank - left.rank)[0];
  const below = rankings.filter((entry) => entry.rank > reader.rank).sort((left, right) => left.rank - right.rank)[0];
  const difference = above ? Math.max(1, above.totalSeconds - reader.totalSeconds + 1) : 0;
  const span = above ? Math.max(1, above.totalSeconds - (below?.totalSeconds || 0)) : 1;
  const progress = above ? Math.max(0, Math.min(100, ((reader.totalSeconds - (below?.totalSeconds || 0)) / span) * 100)) : 100;
  return (
    <section className="arena-self" aria-label={`Your rank is ${reader.rank}`}>
      <span className="arena-self-medal"><Medal size={21} /></span>
      <span className="arena-self-copy"><span>YOUR PLACE IN THE ARENA</span><b>#{reader.rank} this week · {formatDuration(reader.totalSeconds)}</b><small>{above ? `${formatDuration(difference)} more to reach #${above.rank}` : "You’re leading the reading race."}</small></span>
      <Motion.span
        className="arena-self-progress"
        style={{ "--progress": `${progress}%` }}
        initial={reduceMotion ? false : { scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: visible && !reduceMotion ? 0.48 : 0, ease: "easeOut" }}
        aria-label={`${Math.round(progress)} percent progress toward the next rank`}
      ><span>{Math.round(progress)}%</span></Motion.span>
    </section>
  );
}

export default function ReaderArena({ onBack, onLibrary }) {
  const [period, setPeriod] = useState("weekly");
  const [rankings, setRankings] = useState([]);
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(0);
  const [selectedReader, setSelectedReader] = useState(null);
  const [burst, setBurst] = useState(false);
  const touchStart = useRef(null);
  const firstResult = useRef(false);
  const celebratedWinner = useRef(false);
  const { now, visible } = useArenaClock();
  const { triggerLightTap } = useHaptic();
  const reduceMotion = useReducedMotion();
  const countdown = formatWeekCountdown(now);
  useBackLayer(Boolean(selectedReader), () => setSelectedReader(null));

  useEffect(() => {
    let cancelled = false;
    const isInitial = !firstResult.current;
    if (isInitial) setStatus("loading");
    else setBusy(true);
    fetchReaderRankings(period).then(({ rankings: nextRankings }) => {
      if (cancelled) return;
      const keyed = stableReaderKeys(Array.isArray(nextRankings) ? nextRankings : []);
      setRankings(keyed);
      setStatus("ready");
      setBusy(false);
      firstResult.current = true;
      if (!celebratedWinner.current && keyed.some((reader) => reader.rank === 1)) {
        celebratedWinner.current = true;
        if (!reduceMotion) {
          setBurst(true);
          window.setTimeout(() => setBurst(false), 1500);
        }
      } else firstResult.current = true;
    }).catch(() => {
      if (cancelled) return;
      setStatus(navigator.onLine === false ? "offline" : "error");
      setBusy(false);
    });
    return () => { cancelled = true; };
  }, [period, requestId, reduceMotion]);

  useEffect(() => {
    const onOnline = () => {
      setStatus((current) => current === "offline" ? "loading" : current);
      setRequestId((value) => value + 1);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  function retry() {
    setRequestId((value) => value + 1);
  }

  function changePeriod(nextPeriod) {
    if (period === nextPeriod) return;
    triggerLightTap();
    setSelectedReader(null);
    setPeriod(nextPeriod);
  }

  function handleTabKeyDown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = period === "weekly" ? "all_time" : "weekly";
    changePeriod(next);
    window.requestAnimationFrame(() => document.getElementById(`arena-tab-${next}`)?.focus());
  }

  function handleTouchEnd(event) {
    if (touchStart.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) > 55) changePeriod(delta < 0 ? "all_time" : "weekly");
  }

  function selectReader(reader) {
    triggerLightTap();
    setSelectedReader(reader);
  }

  const currentReader = rankings.find((reader) => reader.isYou) || null;
  const podium = rankings.slice(0, 3);
  const rows = rankings.slice(3);
  const maximum = rankings[0]?.totalSeconds || 0;

  return (
    <MotionConfig reducedMotion={!visible || reduceMotion ? "always" : "never"}>
    <LayoutGroup id="reader-arena-shared">
      <div className="screen arena-screen" data-paused={!visible}>
        <header className="arena-header">
          <button type="button" className="arena-back" onClick={onBack} aria-label="Back to profile"><ChevronLeft size={20} /></button>
          <div className="arena-title"><h1>Reader Arena</h1><p>EVERY PAGE MOVES YOU UP</p></div>
          <button type="button" className="arena-refresh" onClick={retry} disabled={busy || status === "loading"} aria-label="Refresh Reader Arena" title="Refresh">
            <RefreshCw size={17} className={busy || status === "loading" ? "spinning" : ""} />
          </button>
        </header>

        <div className={`arena-tabs ${period === "all_time" ? "all-time" : "weekly"}`} role="tablist" aria-label="Reader ranking period" onKeyDown={handleTabKeyDown}>
          <Motion.span className="arena-tab-pill" layoutId="arena-period-pill" transition={{ type: "spring", stiffness: reduceMotion ? 1000 : 510, damping: reduceMotion ? 80 : 38 }} aria-hidden="true" />
          <button type="button" id="arena-tab-weekly" className="arena-tab" role="tab" aria-selected={period === "weekly"} aria-controls="arena-rankings" tabIndex={period === "weekly" ? 0 : -1} onClick={() => changePeriod("weekly")}>This week</button>
          <button type="button" id="arena-tab-all_time" className="arena-tab" role="tab" aria-selected={period === "all_time"} aria-controls="arena-rankings" tabIndex={period === "all_time" ? 0 : -1} onClick={() => changePeriod("all_time")}>All time</button>
        </div>
        <div className="arena-reset"><Clock3 size={12} /> Weekly race resets in <strong>{countdown}</strong> <span>IST</span></div>

        <main
          id="arena-rankings"
          className="arena-content"
          role="tabpanel"
          aria-busy={busy || status === "loading"}
          aria-labelledby={`arena-tab-${period}`}
          onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
          onTouchEnd={handleTouchEnd}
        >
          {status === "loading" && rankings.length === 0 && (
            <div className="arena-state" role="status" aria-label="Loading Reader Arena rankings"><div className="arena-skeleton"><i /><i /><i /></div></div>
          )}
          {(status === "offline" || status === "error") && (
            <div className="arena-state" role="alert"><div className="arena-state-copy">
              <span className="arena-state-icon">{status === "offline" ? <WifiOff size={22} /> : <RefreshCw size={21} />}</span>
              <h2>{status === "offline" ? "The Arena is out of reach" : "The rankings didn’t load"}</h2>
              <p>{status === "offline" ? "Reconnect to see the latest reading standings." : "Your reading time is safe. Try loading the rankings again."}</p>
              <button type="button" className="arena-action" onClick={retry}><RefreshCw size={14} /> Try again</button>
            </div></div>
          )}
          {status === "ready" && rankings.length === 0 && (
            <div className="arena-state"><div className="arena-state-copy">
              <span className="arena-state-icon"><Sparkles size={23} /></span>
              <h2>The arena is waiting for its first reader</h2>
              <p>Your reading time starts the race. Pick up a book and make the first move.</p>
              <button type="button" className="arena-action" onClick={onLibrary}>Join the race <TrendingUp size={15} /></button>
            </div></div>
          )}
          {status === "ready" && rankings.length > 0 && (
            <>
              <section className="arena-stage" aria-label="Top three readers">
                <span className="arena-beam" aria-hidden="true" />
                {podium.map((reader, index) => {
                  const slotColumn = podium.length === 1 ? 2 : podium.length === 2 ? [2, 1][index] : [2, 1, 3][index];
                  return <PodiumReader key={reader.key} reader={reader} readers={rankings} slotColumn={slotColumn} onSelect={selectReader} paused={!visible} reduceMotion={reduceMotion} burst={burst} />;
                })}
              </section>
              {rows.length > 0 && <>
                <div className="arena-list-heading"><span>THE FIELD</span><span>{rankings.length} readers · ranked by time</span></div>
                <ol className="arena-rows" aria-label="Other readers, ranked by reading time">
                  {rows.map((reader, index) => <RankingRow key={reader.key} reader={reader} readers={rankings} maximum={maximum} index={index} onSelect={selectReader} paused={!visible} reduceMotion={reduceMotion} />)}
                </ol>
              </>}
            </>
          )}
        </main>
        {status === "ready" && <SelfArenaCard reader={currentReader} rankings={rankings} onJoin={onLibrary} visible={visible} reduceMotion={reduceMotion} />}

        <AnimatePresence>
          {selectedReader && (
            <Motion.div className="arena-sheet-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedReader(null)}>
              <Motion.section className="arena-sheet" role="dialog" aria-modal="true" aria-labelledby="arena-reader-sheet-title" initial={reduceMotion ? false : { y: 90 }} animate={{ y: 0 }} exit={reduceMotion ? undefined : { y: 90 }} transition={{ type: "spring", stiffness: 360, damping: 32 }} onClick={(event) => event.stopPropagation()}>
                <span className="arena-sheet-grab" aria-hidden="true" />
                <button type="button" className="arena-sheet-close" onClick={() => setSelectedReader(null)} aria-label="Close reader details"><X size={17} /></button>
                <div className="arena-sheet-profile">
                  <span className="arena-sheet-avatar" aria-hidden="true">{initials(selectedReader.name)}</span>
                  <span><h2 id="arena-reader-sheet-title">{selectedReader.name}</h2><p>Reader #{selectedReader.rank}{selectedReader.isYou ? " · You" : ""}</p></span>
                </div>
                <div className="arena-sheet-stat"><Clock3 size={15} /> {formatDuration(selectedReader.totalSeconds)} reading time {period === "weekly" ? "this week" : "all time"}</div>
              </Motion.section>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
    </MotionConfig>
  );
}
