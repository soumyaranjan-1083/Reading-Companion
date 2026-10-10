import { AnimatePresence, LayoutGroup, MotionConfig, animate as animateMotion, motion as Motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ChevronLeft, Clock3, Crown, Medal, RefreshCw, Share2, Sparkles, TrendingUp, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBackLayer } from "./backStack.js";
import { fetchReaderRankings } from "./readingQuota.js";
import { formatWeekCountdown } from "./readerArenaTime.js";
import { formatDuration, getArenaAvatarUrl, getArenaMotionSettings, getArenaPlaceMessage, getArenaRosterLayout, getArenaRowClassName, getTieMark, initials, readerAccessibleLabel, stableReaderKeys } from "./readerArenaModel.js";
import { useHaptic } from "./useHaptic.js";
import "./ReaderArena.css";

function CountUp({ value, delay = 0, paused = false, reduceMotion = false }) {
  const motionValue = useMotionValue(paused || reduceMotion ? value : 0);
  const formatted = useTransform(motionValue, (current) => formatDuration(Math.round(current)));
  useEffect(() => {
    if (paused || reduceMotion) {
      motionValue.set(value);
      return undefined;
    }
    motionValue.set(0);
    const controls = animateMotion(motionValue, value, { duration: 0.58, delay, ease: [0.17, 0.67, 0.3, 1] });
    return () => controls.stop();
  }, [delay, motionValue, paused, reduceMotion, value]);
  return <Motion.span>{formatted}</Motion.span>;
}

function ReaderAvatar({ reader, size = "row" }) {
  const [failedUrl, setFailedUrl] = useState("");
  const avatarUrl = getArenaAvatarUrl(reader, failedUrl);
  const hasPhoto = Boolean(avatarUrl);
  return (
    <span className={`arena-avatar arena-avatar-${size}${reader.rank === 1 ? " winner" : ""}`} role="img" aria-label={`${reader.name} profile photo${hasPhoto ? "" : " initials"}`}>
      {hasPhoto
        ? <img src={avatarUrl} alt="" loading={size === "row" ? "lazy" : "eager"} decoding="async" onError={() => setFailedUrl(avatarUrl)} />
        : <span>{initials(reader.name)}</span>}
    </span>
  );
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
  return getTieMark(readers, reader) ? <span className="arena-tie">TIE</span> : null;
}

function PodiumReader({ reader, readers, slotColumn, onSelect, paused, reduceMotion, hero = false, index = 0 }) {
  const rankDelay = reader.rank === 1 && !hero ? 0.22 : index * 0.06;
  const motion = getArenaMotionSettings(reduceMotion);
  return (
    <Motion.button
      type="button"
      layout
      layoutId={`arena-reader-${reader.key}`}
      className={`arena-podium-reader rank-${reader.rank}${hero ? " arena-podium-hero" : ""}`}
      style={{ "--podium-col": slotColumn }}
      onClick={() => onSelect(reader)}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: paused ? 0 : motion.rise ? 0.38 : motion.fadeDuration, delay: paused || !motion.rise ? 0 : rankDelay, ease: [0.2, 0.72, 0.22, 1] }}
      aria-label={readerAccessibleLabel(reader)}
    >
      <span className="arena-podium-avatar-wrap">
        <Motion.span
          className="arena-avatar-entrance"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: paused ? 0 : reduceMotion ? 0.12 : 0.34, delay: paused || reduceMotion ? 0 : rankDelay + 0.04 }}
        ><ReaderAvatar reader={reader} size={hero ? "hero" : "podium"} /></Motion.span>
        {reader.rank === 1 && <Crown className="arena-crown" size={hero ? 27 : 22} fill="currentColor" />}
      </span>
      <span className="arena-podium-name"><span className="arena-podium-name-text">{reader.name}</span><TiesLabel reader={reader} readers={readers} />{reader.isYou && <span className="arena-you-tag">YOU</span>}</span>
      <strong className="arena-podium-time"><CountUp value={reader.totalSeconds} delay={paused ? 0 : rankDelay} paused={paused || reduceMotion} reduceMotion={reduceMotion} /></strong>
      {hero && <span className="arena-hero-subtitle">YOUR RACE STARTS HERE</span>}
      <span className="arena-pedestal"><span>#{reader.rank}</span></span>
    </Motion.button>
  );
}

function RankingRow({ reader, readers, index, onSelect, paused, reduceMotion }) {
  const tied = Boolean(getTieMark(readers, reader));
  return (
    <li>
      <Motion.button
        type="button"
        layout
        layoutId={`arena-reader-${reader.key}`}
        className={getArenaRowClassName(reader)}
        onClick={() => onSelect(reader)}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: paused ? 0 : reduceMotion ? 0.12 : 0.24, delay: paused || reduceMotion ? 0 : Math.min(index * 0.02, 0.18) }}
        aria-label={readerAccessibleLabel(reader)}
      >
        <span className="arena-row-rank">#{reader.rank}{tied ? <span className="arena-tie-mark" aria-label="Tied rank">=</span> : null}</span>
        <ReaderAvatar reader={reader} size="row" />
        <span className="arena-row-main">
          <span className="arena-row-name"><span className="arena-row-name-text">{reader.name}</span>{reader.isYou && <span className="arena-you-tag">YOU</span>}</span>
        </span>
        <strong className="arena-row-score"><CountUp value={reader.totalSeconds} paused={paused || reduceMotion} reduceMotion={reduceMotion} /></strong>
      </Motion.button>
    </li>
  );
}

function SelfArenaCard({ reader, rankings, isTopThree, onJoin }) {
  if (!reader) {
    return (
      <section className="arena-self arena-self-unranked" aria-label="Your Reader Arena ranking">
        <span className="arena-self-medal"><Sparkles size={19} /></span>
        <span className="arena-self-copy"><span>YOUR PLACE IN THE ARENA</span><b>Join the race</b><small>Your next reading session can put you on the board.</small></span>
        <button type="button" className="arena-action" onClick={onJoin}>Read now</button>
      </section>
    );
  }
  return (
    <section className={`arena-self${isTopThree ? " compact" : ""}`} aria-label={`Your rank is ${reader.rank}`}>
      <span className="arena-self-medal"><Medal size={21} /></span>
      <ReaderAvatar reader={reader} size="self" />
      <span className="arena-self-copy"><span>YOUR PLACE IN THE ARENA</span><b>#{reader.rank} · {formatDuration(reader.totalSeconds)}</b><small>{getArenaPlaceMessage(rankings, reader)}</small></span>
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
  const [inviteMessage, setInviteMessage] = useState("");
  const touchStart = useRef(null);
  const firstResult = useRef(false);
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

  async function inviteFriend() {
    const reportInvite = (text) => {
      setInviteMessage(text);
      window.setTimeout(() => setInviteMessage(""), 2400);
    };
    const shareData = {
      title: "Join my Reading Companion race",
      text: "Read a few pages with me in the Reading Companion Reader Arena.",
      url: new URL("/", window.location.origin).href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        reportInvite("Invite shared");
        return;
      }
      await navigator.clipboard.writeText(shareData.url);
      reportInvite("Arena link copied");
    } catch (error) {
      if (error?.name === "AbortError") return;
      try {
        const field = document.createElement("textarea");
        field.value = shareData.url;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(field);
        reportInvite(copied ? "Arena link copied" : "Copy the link from your browser address bar");
      } catch {
        reportInvite("Copy the link from your browser address bar");
      }
    }
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
  const roster = getArenaRosterLayout(rankings);
  const podium = roster.podium;
  const rows = roster.rows;

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
            <div className="arena-loading" role="status" aria-label="Loading Reader Arena rankings">
              <div className="arena-skeleton-stage"><i /><i /><i /></div>
              <div className="arena-skeleton-rows"><i /><i /><i /></div>
            </div>
          )}
          {(status === "offline" || status === "error") && (
            <div className="arena-state" role="alert"><div className="arena-state-copy">
              <span className="arena-state-icon">{status === "offline" ? <WifiOff size={22} /> : <RefreshCw size={21} />}</span>
              <h2>{status === "offline" ? "The Arena is out of reach" : "The rankings didn’t load"}</h2>
              <p>{status === "offline" ? "Reconnect to see the latest reading standings." : "Your reading time is safe. Try loading the rankings again."}</p>
              <button type="button" className="arena-action" onClick={retry} disabled={busy}>
                <RefreshCw size={14} className={busy ? "spinning" : ""} /> {busy ? "Trying again…" : "Try again"}
              </button>
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
            <AnimatePresence mode="wait" initial={false}>
              <Motion.div key={period} className="arena-results" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: reduceMotion ? 0.12 : 0.2 }}>
                <section className={`arena-stage mode-${roster.mode}`} aria-label={roster.mode === "hero" ? "Reader Arena leader" : roster.mode === "duo" ? "Reader Arena top two" : "Reader Arena top three"}>
                  {roster.mode === "podium" && <span className="arena-beam" aria-hidden="true" />}
                  {podium.map((reader, index) => <PodiumReader key={reader.key} reader={reader} readers={rankings} slotColumn={reader.slotColumn} index={index} hero={roster.mode === "hero"} onSelect={selectReader} paused={!visible} reduceMotion={reduceMotion} />)}
                </section>
                {roster.showInvite && <div className="arena-invite-wrap">
                  <button type="button" className="arena-invite" onClick={inviteFriend}><Share2 size={16} /> Invite a friend to race</button>
                  {inviteMessage && <span className="arena-invite-status" aria-live="polite">{inviteMessage}</span>}
                </div>}
                {rows.length > 0 && <section className="arena-rows-scroll" aria-label="Reader rankings">
                  <div className="arena-list-heading"><span>THE FIELD</span><span>{rows.length} readers · ranks follow reading time; ties share rank</span></div>
                  <ol className="arena-rows" aria-label="Readers ranked by reading time">
                    {rows.map((reader, index) => <RankingRow key={reader.key} reader={reader} readers={rankings} index={index} onSelect={selectReader} paused={!visible} reduceMotion={reduceMotion} />)}
                  </ol>
                </section>}
              </Motion.div>
            </AnimatePresence>
          )}
        </main>
        {status === "ready" && <SelfArenaCard reader={currentReader} rankings={rankings} isTopThree={currentReader ? currentReader.rank <= 3 : false} onJoin={onLibrary} />}

        <AnimatePresence>
          {selectedReader && (
            <Motion.div className="arena-sheet-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedReader(null)}>
              <Motion.section className="arena-sheet" role="dialog" aria-modal="true" aria-labelledby="arena-reader-sheet-title" initial={reduceMotion ? false : { y: 90 }} animate={{ y: 0 }} exit={reduceMotion ? undefined : { y: 90 }} transition={{ type: "spring", stiffness: 360, damping: 32 }} onClick={(event) => event.stopPropagation()}>
                <span className="arena-sheet-grab" aria-hidden="true" />
                <button type="button" className="arena-sheet-close" onClick={() => setSelectedReader(null)} aria-label="Close reader details"><X size={17} /></button>
                <div className="arena-sheet-profile">
                  <ReaderAvatar reader={selectedReader} size="sheet" />
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
