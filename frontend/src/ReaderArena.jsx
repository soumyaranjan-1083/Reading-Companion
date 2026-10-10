import { AnimatePresence, LayoutGroup, MotionConfig, animate as animateMotion, motion as Motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ChevronLeft, Clock3, Crosshair, Crown, Medal, RefreshCw, Share2, Sparkles, TrendingUp, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBackLayer } from "./backStack.js";
import { fetchReaderRankings } from "./readingQuota.js";
import { formatWeekCountdown } from "./readerArenaTime.js";
import { buildArenaProfile, buildWeeklyArenaData, formatDuration, getArenaAvatarUrl, getArenaGapText, getArenaMotionSettings, getArenaPlaceMessage, getArenaRosterLayout, getArenaRowClassName, getTieMark, initials, readerAccessibleLabel, stableReaderKeys } from "./readerArenaModel.js";
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
    const controls = animateMotion(motionValue, value, { duration: 0.4, delay, ease: [0.17, 0.67, 0.3, 1] });
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

function PodiumReader({ reader, readers, leader, runnerUp, slotColumn, onSelect, paused, reduceMotion, entrance = true, hero = false, index = 0 }) {
  const rankDelay = reader.rank === 1 && !hero ? 0.22 : index * 0.06;
  const motion = getArenaMotionSettings(reduceMotion);
  return (
    <Motion.button
      type="button"
      layout
      layoutId={`arena-reader-${reader.key}`}
      className={`arena-podium-reader rank-${reader.rank}${hero ? " arena-podium-hero" : ""}`}
      style={{ "--podium-col": slotColumn }}
      id={reader.isYou ? "arena-you-row" : undefined}
      onClick={() => onSelect(reader)}
      initial={!entrance ? false : reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: paused ? 0 : motion.rise ? 0.38 : motion.fadeDuration, delay: paused || !motion.rise ? 0 : rankDelay, ease: [0.2, 0.72, 0.22, 1] }}
      aria-label={readerAccessibleLabel(reader)}
    >
      <span className="arena-podium-avatar-wrap">
        <Motion.span
          className="arena-avatar-entrance"
          initial={!entrance ? false : reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: paused ? 0 : reduceMotion ? 0.12 : 0.34, delay: paused || reduceMotion ? 0 : rankDelay + 0.04 }}
        ><ReaderAvatar reader={reader} size={hero ? "hero" : "podium"} /></Motion.span>
        {reader.rank === 1 && <Crown className="arena-crown" size={hero ? 27 : 22} fill="currentColor" />}
      </span>
      <span className="arena-podium-name"><span className="arena-podium-name-text">{reader.name}</span><TiesLabel reader={reader} readers={readers} />{reader.isYou && <span className="arena-you-tag">YOU</span>}</span>
          <strong className="arena-podium-time"><CountUp value={reader.totalSeconds} delay={paused ? 0 : rankDelay} paused={paused || reduceMotion || !entrance} reduceMotion={reduceMotion} /></strong>
      <span className="arena-podium-gap">{getArenaGapText(reader, leader, runnerUp)}</span>
      {hero && <span className="arena-hero-subtitle">YOUR RACE STARTS HERE</span>}
      <span className="arena-pedestal"><Medal size={19} aria-hidden="true" /><span>{reader.rank}</span></span>
    </Motion.button>
  );
}

function RankingRow({ reader, readers, index, onSelect, paused, reduceMotion, leaderSeconds = 0, notStarted = false, entrance = true }) {
  const tied = !notStarted && Boolean(getTieMark(readers, reader));
  return (
    <li id={reader.isYou ? "arena-you-row" : undefined}>
      <Motion.button
        type="button"
        layout
        layoutId={`arena-reader-${reader.key}`}
        className={getArenaRowClassName(reader)}
        onClick={() => onSelect(reader)}
        initial={!entrance ? false : reduceMotion ? { opacity: 0 } : { opacity: 0, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: paused ? 0 : reduceMotion ? 0.12 : 0.24, delay: paused || reduceMotion ? 0 : Math.min(index * 0.02, 0.18) }}
        aria-label={readerAccessibleLabel(reader)}
      >
        <span className="arena-row-rank">{notStarted ? `#${reader.allTimeRank} all-time` : `#${reader.rank}`}{tied ? <span className="arena-tie-mark" aria-label="Tied rank">=</span> : null}</span>
        <ReaderAvatar reader={reader} size="row" />
        <span className="arena-row-main">
          <span className="arena-row-name"><span className="arena-row-name-text">{reader.name}</span>{reader.isYou && <span className="arena-you-tag">YOU</span>}</span>
        </span>
        <strong className="arena-row-score">{notStarted ? "0m" : <CountUp value={reader.totalSeconds} paused={paused || reduceMotion || !entrance} reduceMotion={reduceMotion} />}</strong>
        <span className="arena-row-progress" aria-label={`Reading time ${leaderSeconds ? Math.round(reader.totalSeconds / leaderSeconds * 100) : 0}% of the weekly leader`}><i style={{ transform: `scaleX(${leaderSeconds ? Math.min(1, reader.totalSeconds / leaderSeconds) : 0})` }} /></span>
      </Motion.button>
    </li>
  );
}

function SelfArenaCard({ reader, rankings, isTopThree, onJoin, onFindMe, period }) {
  if (!reader) {
    return (
      <section className="arena-self arena-self-unranked" aria-label="Your Reader Arena ranking">
        <span className="arena-self-medal"><Sparkles size={19} /></span>
        <span className="arena-self-copy"><span>YOUR PLACE IN THE ARENA</span><b>Join the race</b><small>Your next reading session can put you on the board.</small></span>
        <button type="button" className="arena-action" onClick={onJoin}>Read now</button>
      </section>
    );
  }
  if (period === "weekly" && reader.weeklySeconds === 0) {
    return (
      <section className="arena-self arena-self-zero" aria-label="Your weekly Arena place">
        <span className="arena-self-medal"><Medal size={21} /></span>
        <ReaderAvatar reader={reader} size="self" />
        <span className="arena-self-copy"><span>YOUR PLACE IN THE ARENA</span><b>0m · Not started</b><small>All-time rank #{reader.allTimeRank}</small></span>
        <button type="button" className="arena-find-me" onClick={onFindMe} aria-label="Find your row"><Crosshair size={17} /></button>
      </section>
    );
  }
  return (
    <section className={`arena-self${isTopThree ? " compact" : ""}`} aria-label={`Your rank is ${reader.rank}`}>
      <span className="arena-self-medal"><Medal size={21} /></span>
      <ReaderAvatar reader={reader} size="self" />
      <span className="arena-self-copy"><span>YOUR PLACE IN THE ARENA</span><b>#{reader.rank} · {formatDuration(reader.totalSeconds)}</b><small>{getArenaPlaceMessage(rankings, reader)}</small></span>
      <button type="button" className="arena-find-me" onClick={onFindMe} aria-label="Find your row"><Crosshair size={17} /></button>
    </section>
  );
}

export default function ReaderArena({ onBack, onLibrary }) {
  const [period, setPeriod] = useState("weekly");
  const [rankingSets, setRankingSets] = useState({ weekly: null, all_time: null });
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(0);
  const [selectedReader, setSelectedReader] = useState(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [racedVisible, setRacedVisible] = useState(50);
  const [waitingVisible, setWaitingVisible] = useState(50);
  const [animateEntrance, setAnimateEntrance] = useState(true);
  const touchStart = useRef(null);
  const sheetTouchStart = useRef(null);
  const sheetRef = useRef(null);
  const entranceTimer = useRef(null);
  const rankingCache = useRef({ weekly: null, all_time: null });
  const firstResult = useRef(false);
  const { now, visible } = useArenaClock();
  const { triggerLightTap } = useHaptic();
  const reduceMotion = useReducedMotion();
  const countdown = formatWeekCountdown(now);
  const rankings = rankingSets[period] || [];
  useBackLayer(Boolean(selectedReader), () => setSelectedReader(null));

  useEffect(() => {
    let cancelled = false;
    if (rankingCache.current.weekly && rankingCache.current.all_time && requestId === 0) {
      setRankingSets(rankingCache.current);
      setStatus("ready");
      setBusy(false);
      return undefined;
    }
    if (!firstResult.current) setStatus("loading");
    else setBusy(true);
    fetchReaderRankings(period).then((response) => {
      if (cancelled) return;
      const firstLoad = !firstResult.current;
      const weekly = stableReaderKeys(Array.isArray(response.weeklyRankings) ? response.weeklyRankings : period === "weekly" ? response.rankings || [] : []);
      const allTime = stableReaderKeys(Array.isArray(response.allTimeRankings) ? response.allTimeRankings : period === "all_time" ? response.rankings || [] : []);
      const nextSets = { weekly, all_time: allTime };
      rankingCache.current = nextSets;
      setAnimateEntrance(firstLoad);
      if (firstLoad) {
        window.clearTimeout(entranceTimer.current);
        entranceTimer.current = window.setTimeout(() => setAnimateEntrance(false), 680);
      }
      setRankingSets(nextSets);
      setStatus("ready");
      setBusy(false);
      firstResult.current = true;
    }).catch(() => {
      if (cancelled) return;
      setStatus(navigator.onLine === false ? "offline" : "error");
      setBusy(false);
    });
    return () => { cancelled = true; };
  }, [period, requestId]);

  useEffect(() => () => window.clearTimeout(entranceTimer.current), []);

  useEffect(() => {
    if (!selectedReader) return undefined;
    sheetRef.current?.querySelector("button")?.focus();
    return undefined;
  }, [selectedReader]);

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
    setAnimateEntrance(false);
    setSelectedReader(null);
    setRacedVisible(50);
    setWaitingVisible(50);
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
  const weeklyData = period === "weekly" ? buildWeeklyArenaData(rankings) : null;
  const activeRankings = weeklyData ? weeklyData.raced : rankings;
  const notStarted = weeklyData?.notStarted || [];
  const roster = getArenaRosterLayout(activeRankings);
  const podium = roster.podium;
  const rows = roster.rows;
  const leader = activeRankings[0] || null;
  const runnerUp = activeRankings[1] || null;
  const selectedProfile = buildArenaProfile(selectedReader, currentReader, period);

  function findCurrentReader() {
    if (!currentReader) return;
    const inRows = rows.findIndex((reader) => reader.isYou);
    if (inRows >= 0) setRacedVisible(Math.ceil((inRows + 1) / 50) * 50);
    const inWaiting = notStarted.findIndex((reader) => reader.isYou);
    if (inWaiting >= 0) setWaitingVisible(Math.ceil((inWaiting + 1) / 50) * 50);
    window.requestAnimationFrame(() => document.getElementById("arena-you-row")?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" }));
  }

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
              <Motion.div className="arena-results">
                {period === "weekly" && <p className="arena-raced-count">{weeklyData.racedCount} {weeklyData.racedCount === 1 ? "reader raced" : "readers raced"} this week</p>}
                {activeRankings.length > 0 && <section className={`arena-stage mode-${roster.mode}`} aria-label={roster.mode === "hero" ? "Reader Arena leader" : roster.mode === "duo" ? "Reader Arena top two" : "Reader Arena top three"}>
                  {roster.mode === "podium" && <span className="arena-beam" aria-hidden="true" />}
                  {podium.map((reader, index) => <PodiumReader key={reader.key} reader={reader} readers={activeRankings} leader={leader} runnerUp={runnerUp} slotColumn={reader.slotColumn} index={index} hero={roster.mode === "hero"} onSelect={selectReader} paused={!visible} reduceMotion={reduceMotion} entrance={animateEntrance} />)}
                </section>}
                {roster.showInvite && <div className="arena-invite-wrap">
                  <button type="button" className="arena-invite" onClick={inviteFriend}><Share2 size={16} /> Invite a friend to race</button>
                  {inviteMessage && <span className="arena-invite-status" aria-live="polite">{inviteMessage}</span>}
                </div>}
                {rows.length > 0 && <section className="arena-rows-scroll" aria-label="Reader rankings">
                  <div className="arena-list-heading"><span>THE FIELD</span><span>{rows.length} readers · ranks follow reading time; ties share rank</span></div>
                  <ol className="arena-rows" aria-label="Readers ranked by reading time">
                    {rows.slice(0, racedVisible).map((reader, index) => <RankingRow key={reader.key} reader={reader} readers={activeRankings} index={index} onSelect={selectReader} paused={!visible} reduceMotion={reduceMotion} leaderSeconds={leader?.totalSeconds || 0} entrance={animateEntrance} />)}
                  </ol>
                  {rows.length > racedVisible && <button type="button" className="arena-load-more" onClick={() => setRacedVisible((value) => value + 50)}>Load next 50 readers</button>}
                </section>}
                {notStarted.length > 0 && <section className="arena-rows-scroll arena-not-started" aria-label="Readers who have not started this week">
                  <div className="arena-list-heading"><span>HAVEN&apos;T STARTED THIS WEEK</span><span>{notStarted.length} readers · ordered by all-time rank</span></div>
                  <ol className="arena-rows" aria-label="Readers with zero weekly reading time">
                    {notStarted.slice(0, waitingVisible).map((reader, index) => <RankingRow key={reader.key} reader={reader} readers={notStarted} index={index} onSelect={selectReader} paused={!visible} reduceMotion={reduceMotion} notStarted entrance={animateEntrance} />)}
                  </ol>
                  {notStarted.length > waitingVisible && <button type="button" className="arena-load-more" onClick={() => setWaitingVisible((value) => value + 50)}>Load next 50 readers</button>}
                </section>}
              </Motion.div>
          )}
        </main>
        {status === "ready" && <SelfArenaCard reader={currentReader} rankings={activeRankings} isTopThree={currentReader?.rank != null && currentReader.rank <= 3} onJoin={onLibrary} onFindMe={findCurrentReader} period={period} />}

        <AnimatePresence>
          {selectedReader && (
            <Motion.div className="arena-sheet-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedReader(null)}>
              <Motion.section ref={sheetRef} className="arena-sheet" role="dialog" aria-modal="true" aria-labelledby="arena-reader-sheet-title" initial={reduceMotion ? false : { y: 90 }} animate={{ y: 0 }} exit={reduceMotion ? undefined : { y: 90 }} transition={{ type: "spring", stiffness: 360, damping: 32 }} onClick={(event) => event.stopPropagation()}
                onTouchStart={(event) => { sheetTouchStart.current = event.touches[0].clientY; }}
                onTouchEnd={(event) => { if (sheetTouchStart.current !== null && event.changedTouches[0].clientY - sheetTouchStart.current > 75) setSelectedReader(null); sheetTouchStart.current = null; }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") { event.preventDefault(); setSelectedReader(null); return; }
                  if (event.key !== "Tab") return;
                  const closeButton = sheetRef.current?.querySelector("button");
                  if (closeButton) { event.preventDefault(); closeButton.focus(); }
                }}>
                <span className="arena-sheet-grab" aria-hidden="true" />
                <button type="button" className="arena-sheet-close" onClick={() => setSelectedReader(null)} aria-label="Close reader details"><X size={17} /></button>
                <div className="arena-sheet-profile">
                  <ReaderAvatar reader={selectedReader} size="sheet" />
                  <span><h2 id="arena-reader-sheet-title">{selectedProfile.name}</h2><p>{selectedProfile.weeklyRank == null ? "Not started this week" : `This week #${selectedProfile.weeklyRank}`} · {selectedProfile.allTimeRank == null ? "All-time unranked" : `All time #${selectedProfile.allTimeRank}`}{selectedReader.isYou ? " · You" : ""}</p></span>
                </div>
                <div className="arena-profile-stats">
                  <div className="arena-sheet-stat"><Clock3 size={15} /> <span><small>This week</small><b>{selectedProfile.weeklySeconds === 0 ? "0m" : formatDuration(selectedProfile.weeklySeconds)}</b></span></div>
                  <div className="arena-sheet-stat"><Clock3 size={15} /> <span><small>All time</small><b>{formatDuration(selectedProfile.allTimeSeconds)}</b></span></div>
                </div>
                {selectedProfile.comparison && <p className="arena-profile-comparison">{selectedProfile.comparison}</p>}
              </Motion.section>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
    </MotionConfig>
  );
}
