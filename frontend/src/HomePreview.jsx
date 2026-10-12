import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowLeft, BookOpen, Flame, Gem, Play, TrendingDown, TrendingUp } from "lucide-react";
import MascotCharacter from "./components/MascotCharacter.jsx";
import "./HomePreview.css";

function useLocalHour() {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    let timer;
    const update = () => {
      const nextHour = new Date().getHours();
      setHour((current) => current === nextHour ? current : nextHour);
      const now = new Date();
      const nextHourAt = new Date(now);
      nextHourAt.setHours(now.getHours() + 1, 0, 0, 0);
      timer = window.setTimeout(update, Math.max(1000, nextHourAt.getTime() - now.getTime() + 100));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        update();
      }
    };
    update();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  if (hour >= 5 && hour < 10) return "dawn";
  if (hour >= 10 && hour < 16) return "day";
  if (hour >= 16 && hour < 20) return "dusk";
  return "night";
}

function CountOnce({ value, calm }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (calm || reduceMotion) return undefined;
    let frame;
    let start;
    const step = (time) => {
      if (start === undefined) start = time;
      const progress = Math.min(1, (time - start) / 560);
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [calm, reduceMotion, value]);
  return calm || reduceMotion ? value : shown;
}

function dayPath(data) {
  const width = 320;
  const height = 126;
  const pad = 12;
  const max = Math.max(1, ...data.map((day) => day.count));
  const points = data.map((day, index) => ({
    ...day,
    x: pad + (index * (width - pad * 2)) / Math.max(1, data.length - 1),
    y: height - 22 - (day.count / max) * (height - 44),
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  return { points, path, width, height };
}

function InkTrail({ data }) {
  const [active, setActive] = useState(null);
  const { points, path, width, height } = dayPath(data);
  const selected = active === null ? null : points[active];
  return <svg className="desk-trail" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Vocabulary learned by day">
    {[0, 1, 2].map((line) => <line key={line} x1="8" x2={width - 8} y1={26 + line * 34} y2={26 + line * 34} className="desk-trail-grid" />)}
    <path d={path} className="desk-trail-line" />
    {selected && <g className="desk-trail-selection"><line x1={selected.x} x2={selected.x} y1="15" y2={height - 18} /><circle cx={selected.x} cy={selected.y} r="4" /><text x={Math.min(width - 70, Math.max(8, selected.x - 34))} y="14">{selected.short} {selected.mon}: {selected.count}</text></g>}
    {points.map((point, index) => <rect key={point.key} x={point.x - 18} y="0" width="36" height={height} fill="transparent" role="button" tabIndex="0" aria-label={`${point.label}: ${point.count} words`} onClick={() => setActive(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActive(index); } }} />)}
  </svg>;
}

function titleSeed(title = "") {
  return Array.from(title).reduce((sum, character) => (sum * 31 + character.codePointAt(0)) >>> 0, 7);
}

export default function HomePreview({ nav, mascot, mascotLine, onMascotTap, mascotTalking, mascotLevelRef, name, streak, streakDays, books, words, wordsThisWeek, weekDelta, gems, vocabData, range, onRangeChange, percent, gemBars, donutItems, bookRows, recent, recallCard, onSwitchBack, onStatTap }) {
  const hour = useLocalHour();
  const calm = typeof document !== "undefined" && document.documentElement.dataset.motion === "calm";
  const [activeGemDay, setActiveGemDay] = useState(null);
  const [activeWordBook, setActiveWordBook] = useState(null);
  const reduceMotion = useReducedMotion();
  const fireSize = streak >= 30 ? "grand" : streak >= 7 ? "steady" : streak > 0 ? "small" : "out";
  const colors = ["#7653b7", "#087f87", "#c06b29", "#b24968", "#427884", "#6b7f44"];
  const wordTotal = donutItems.reduce((sum, item) => sum + item.value, 0) || 1;
  const circumference = 2 * Math.PI * 40;

  return <div className="screen dashboard-screen home-v2" data-sky={hour}>
    <header className="desk-header">
      <div className="desk-title"><span>YOUR READING DESK</span><h1>Today at the desk</h1><time>{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</time></div>
      <button type="button" className="desk-preview-chip" onClick={onSwitchBack}><span>Preview</span><span><ArrowLeft size={13} /> Switch back</span></button>
    </header>
    <div className="desk-greeting-row">
      <div><span className="desk-greeting">{new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : new Date().getHours() < 21 ? "Good evening" : "Good night"}</span><h2>{name}</h2></div>
      <div className="desk-mascot-perch"><MascotCharacter characterId={mascot} size={72} animated={false} silent onTap={onMascotTap} talking={mascotTalking} levelRef={mascotLevelRef} /></div>
      <p className="desk-speech">{mascotLine}</p>
    </div>

    <main className="dashboard-content desk-content">
      <section className={`desk-lantern ${fireSize}`} aria-label={`${streak} day reading streak`}>
        <div className="desk-lantern-top"><span>READING STREAK</span><b><CountOnce value={streak} calm={calm || reduceMotion} /> {streak === 1 ? "day" : "days"}</b></div>
        <div className="desk-lantern-body"><span className="desk-flame-wrap"><Flame className="desk-flame" aria-hidden="true" /></span><span className="desk-lantern-glow" aria-hidden="true" /></div>
        <div className="desk-week" aria-label="Reading activity this week">{streakDays.map((day, index) => <span className={`desk-weekday ${day.active ? "lit" : ""} ${day.isToday ? "today" : ""}`} key={`${day.label}-${index}`}><i />{day.label}</span>)}</div>
      </section>

      <section className="desk-shelf" aria-label="Reading stats">
        <button type="button" className="desk-object books-object" onClick={onStatTap} aria-label={`Books: ${books}`}><span className="desk-count"><CountOnce value={books} calm={calm || reduceMotion} /></span><span className="desk-object-art" aria-hidden="true"><i /><i /><i /><i /></span><span className="desk-object-label">Books</span></button>
        <button type="button" className="desk-object words-object" onClick={onStatTap} aria-label={`Words learned: ${words}`}><span className="desk-count"><CountOnce value={words} calm={calm || reduceMotion} /></span><span className="desk-scroll-art" aria-hidden="true"><i /><i /><i /></span><span className="desk-object-label">Words learned</span></button>
        <button type="button" className="desk-object week-object" onClick={onStatTap} aria-label={`Words this week: ${wordsThisWeek}`}><span className="desk-count"><CountOnce value={wordsThisWeek} calm={calm || reduceMotion} /></span><span className={`desk-delta ${weekDelta >= 0 ? "up" : "down"}`}>{weekDelta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(weekDelta)}</span><span className="desk-object-label">Words this week</span></button>
        <button type="button" className="desk-object gems-object" onClick={onStatTap} aria-label={`Gems saved: ${gems}`}><span className="desk-count"><CountOnce value={gems} calm={calm || reduceMotion} /></span><span className="desk-jar-art" aria-hidden="true">{Array.from({ length: Math.min(6, gems) }, (_, index) => <i key={index}><Gem size={10} /></i>)}</span><span className="desk-object-label">Gems saved</span></button>
      </section>

      {recallCard}

      <section className="desk-section desk-vocab-section">
        <div className="desk-section-head"><div><span>INK TRAIL</span><h2>Vocabulary growth</h2></div><div className="desk-range" role="group" aria-label="Vocabulary chart range">{[7, 14, 30, 90].map((days) => <button type="button" key={days} aria-pressed={range === days} className={range === days ? "selected" : ""} onClick={() => onRangeChange(days)}>{days}D</button>)}</div></div>
        <p className="desk-hint">Tap a point to see that day</p>
        <InkTrail data={vocabData} />
      </section>

      <section className="desk-two-up">
        <article className="desk-section desk-progress"><span>OVERALL PROGRESS</span><strong>{percent}%</strong><div className="desk-progress-track"><i style={{ transform: `scaleX(${Math.max(0, Math.min(100, percent)) / 100})` }} /></div><small>chapters done</small></article>
        <article className="desk-section desk-gems-week"><span>GEMS THIS WEEK</span><div className="desk-gem-days">{gemBars.map((day, index) => <button type="button" key={day.key} className={activeGemDay === index ? "selected" : ""} onClick={() => setActiveGemDay(activeGemDay === index ? null : index)} aria-label={`${day.label}: ${day.count} gems`}><i style={{ transform: `scaleY(${day.count ? Math.max(.12, day.count / Math.max(1, ...gemBars.map((entry) => entry.count))) : .06})` }} /><small>{day.label.slice(0, 1)}</small></button>)}</div><small>{activeGemDay === null ? "Saved gems" : `${gemBars[activeGemDay].label}: ${gemBars[activeGemDay].count}`}</small></article>
      </section>

      {donutItems.length > 0 && <section className="desk-section desk-word-books"><span>WORDS BY BOOK</span><div className="desk-donut-layout"><svg viewBox="0 0 100 100" role="img" aria-label="Vocabulary share by book"><circle className="desk-donut-track" cx="50" cy="50" r="40" />{donutItems.slice(0, 6).map((item, index) => <circle key={item.label} className={`desk-donut-segment ${activeWordBook === index ? "selected" : ""}`} cx="50" cy="50" r="40" stroke={item.color || colors[index % colors.length]} strokeDasharray={`${circumference * Math.min(.94, item.value / Math.max(...donutItems.map((entry) => entry.value), 1))} ${circumference}`} strokeDashoffset={-index * 12} transform="rotate(-90 50 50)" />)}</svg><b>{activeWordBook === null ? wordTotal : donutItems[activeWordBook]?.value || wordTotal}<small>{activeWordBook === null ? "words" : donutItems[activeWordBook]?.label}</small></b></div><div className="desk-word-legend">{donutItems.slice(0, 6).map((item, index) => <button type="button" key={item.label} className={activeWordBook === index ? "selected" : ""} onClick={() => setActiveWordBook(activeWordBook === index ? null : index)}><i style={{ background: item.color || colors[index % colors.length] }} /><span>{item.label}</span><small>{Math.round(item.value / wordTotal * 100)}%</small></button>)}</div></section>}

      {bookRows.length > 0 && <section className="desk-section desk-book-progress"><span>BOOK PROGRESS</span>{bookRows.map((row) => { const progress = row.total ? Math.round(row.done / row.total * 100) : 0; return <div className="desk-book-row" key={row.book.id}><span className="desk-book-spine" style={{ "--spine": row.gradient[0] }}>{(row.book.title || "?").trim()[0]?.toUpperCase()}</span><span className="desk-book-detail"><b>{row.book.title}</b><i><span style={{ transform: `scaleX(${progress / 100})` }} /></i><small>{row.done} of {row.total} chapters · {row.words} words</small></span><strong>{progress}%</strong></div>; })}</section>}

      <section className="desk-continue"><div className="desk-section-head"><div><span>MARKED FOR LATER</span><h2>Continue reading</h2></div></div>{recent.length ? <div className="desk-bookmarks">{recent.map((row) => { const seed = titleSeed(row.book.title); const palette = colors[seed % colors.length]; const progress = row.total ? Math.max(4, Math.round(row.done / row.total * 100)) : 4; return <button type="button" className="desk-bookmark" key={row.book.id} style={{ "--cover-tone": palette, "--cover-mark": `${(seed % 35) + 20}%` }} onClick={() => nav.openRecap(row.book.id)}><span className="desk-bookmark-ribbon"><BookOpen size={15} /> Chapter {row.book.currentChapterNumber}</span><b>{row.book.title}</b><small>{row.done}/{row.total} chapters done</small><i><span style={{ transform: `scaleX(${progress / 100})` }} /></i><span className="desk-bookmark-play"><Play size={16} fill="currentColor" /></span></button>; })}</div> : <div className="desk-empty"><BookOpen size={23} /><p>No books yet. Add your first one to begin.</p><button type="button" onClick={nav.goLibrary}>Go to Library</button></div>}</section>
    </main>
  </div>;
}
