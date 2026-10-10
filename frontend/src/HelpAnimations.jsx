import {
  AlertTriangle, Bell, Bot, BookOpen, Brain, Bug, Camera, Cat, Check, ChevronRight, Clock, Cloud, Copy, Download, Flame, Gem, History, Languages, Library, Link2,
  Lock, LogOut, Maximize2, MessageSquareText, Moon, Palette, PenLine, Play, Plus, RefreshCw, Route, ScanText, Save, Search, Send, Shuffle, Square,
  Sparkles, Sprout, Sun, Trash2, TrendingUp, User, Volume2, Eye, ThumbsUp, Wrench, FlaskConical, Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getHelpAnimation } from "./helpAnimations.js";

const ICONS = {
  AlertTriangle, Bell, Bot, BookOpen, Brain, Bug, Camera, Cat, Check, ChevronRight, Clock, Cloud, Copy, Download, Flame, Gem, History, Languages, Library, Link2,
  Lock, LogOut, Maximize2, MessageSquareText, Moon, Palette, PenLine, Play, Plus, RefreshCw, Route, ScanText, Save, Search, Send, Shuffle, Square,
  Sparkles, Sprout, Sun, Trash2, TrendingUp, User, Volume2, Eye, ThumbsUp, Wrench, FlaskConical, Zap,
};
const Icon = ({ name, size = 16 }) => { const Cmp = ICONS[name] || Sparkles; return <Cmp size={size} />; };

function useCycle(length, ms, paused) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (paused || length < 2) return undefined;
    const id = setInterval(() => setIndex((current) => (current + 1) % length), ms);
    return () => clearInterval(id);
  }, [length, ms, paused]);
  return index;
}

const BAR_HEIGHTS = [28, 44, 36, 62, 52, 78, 90];

// Each scene fills the same fixed 96px stage so nothing can overflow the chat bubble.
function Scene({ kind, items, active }) {
  const count = items.length;
  switch (kind) {
    case "avatar":
      return (
        <div className="ha-scene ha-avatar">
          <div className="ha-orb"><Icon name={items[active].icon} size={26} /><i /><i /></div>
          <div className="ha-lines"><b /><b /></div>
        </div>
      );
    case "streak":
      return (
        <div className="ha-scene ha-streak">
          <div className="ha-flame"><Flame size={30} /></div>
          <div className="ha-days">{Array.from({ length: 7 }, (_, i) => <i key={i} className={i <= active + 2 ? "on" : ""} style={{ animationDelay: `${i * 70}ms` }} />)}</div>
        </div>
      );
    case "grid":
      return (
        <div className="ha-scene ha-grid" style={{ "--cols": count > 3 ? 2 : count }}>
          {items.map((entry, i) => (
            <span key={entry.label} className={`ha-tile ${i === active ? "on" : ""}`}><Icon name={entry.icon} size={15} /><small>{entry.label}</small></span>
          ))}
        </div>
      );
    case "bars":
      return (
        <div className="ha-scene ha-bars">
          {BAR_HEIGHTS.map((h, i) => <i key={i} className={i === 6 - active ? "hot" : ""} style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />)}
        </div>
      );
    case "ring":
      return (
        <div className="ha-scene ha-ring">
          <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" /><circle className="arc" cx="22" cy="22" r="18" style={{ "--p": 0.45 + active * 0.2 }} /></svg>
          <div className="ha-ring-side">
            {items.slice(0, 3).map((entry, i) => <span key={entry.label} className={i === active ? "on" : ""}><Icon name={entry.icon} size={13} />{entry.label}</span>)}
          </div>
        </div>
      );
    case "rows":
    case "toggles":
      return (
        <div className={`ha-scene ha-rows ${kind}`}>
          {items.map((entry, i) => (
            <span key={entry.label} className={`ha-row ${i === active ? "on" : ""}`}>
              <Icon name={entry.icon} size={14} /><em>{entry.label}</em>
              {kind === "toggles" ? <u className="ha-switch"><i /></u> : <u className="ha-chev" />}
            </span>
          ))}
        </div>
      );
    case "swatch":
      return (
        <div className="ha-scene ha-swatch">
          {items.map((entry, i) => <span key={entry.label} className={`ha-chip ${i === active ? "on" : ""}`}><Icon name={entry.icon} size={20} /><small>{entry.label}</small></span>)}
        </div>
      );
    case "flow":
      return (
        <div className="ha-scene ha-flow">
          {items.map((entry, i) => (
            <span key={entry.label} className="ha-step-wrap">
              <span className={`ha-node ${i < active ? "done" : i === active ? "on" : ""}`}><Icon name={i < active ? "Check" : entry.icon} size={15} /></span>
              {i < count - 1 && <i className={`ha-link ${i < active ? "done" : ""}`} />}
            </span>
          ))}
        </div>
      );
    case "timeline":
      return (
        <div className="ha-scene ha-timeline">
          {items.map((entry, i) => (
            <span key={entry.label} className={`ha-tl ${i < active ? "done" : i === active ? "on" : ""}`}>
              <b><Icon name={i < active ? "Check" : entry.icon} size={13} /></b><small>{entry.label}</small>
            </span>
          ))}
        </div>
      );
    case "graph":
      return (
        <div className="ha-scene ha-graph">
          <svg viewBox="0 0 120 70" aria-hidden="true">
            <path className="ha-edge" d="M20 50 L50 20 L90 34 L100 58 M50 20 L60 56" />
            {[[20, 50], [50, 20], [90, 34], [100, 58], [60, 56]].map(([x, y], i) => <circle key={i} className={i === active % 5 ? "hot" : ""} cx={x} cy={y} r="5" />)}
          </svg>
          <span className="ha-graph-tool"><Icon name={items[active].icon} size={15} /></span>
        </div>
      );
    case "chatui":
      return (
        <div className="ha-scene ha-chatui">
          <span className="ha-bubble me" /><span className="ha-bubble ai" /><span className="ha-bubble ai short" />
          <span className="ha-chatbar"><Icon name={items[active].icon} size={13} /><i /><Send size={13} /></span>
        </div>
      );
    default: // card
      return (
        <div className="ha-scene ha-card">
          <span className="ha-book"><BookOpen size={22} /></span>
          <div className="ha-card-copy"><b /><b className="short" /><em className={`ha-pill ${active % 2 ? "alt" : ""}`}><Icon name={items[active].icon} size={12} />{items[active].label}</em></div>
        </div>
      );
  }
}

function Animation({ animation }) {
  const [paused, setPaused] = useState(false);
  const active = useCycle(animation.items.length, 2300, paused);
  const entry = animation.items[active];
  return (
    <div className="ha-body" style={{ "--ha-accent": animation.accent }} onPointerDown={() => setPaused(true)}>
      <div className="ha-stage"><Scene kind={animation.kind} items={animation.items} active={active} /></div>
      <p key={active} className="ha-caption"><b>{entry.label}.</b> {entry.text}</p>
      <div className="ha-dots" aria-hidden="true">{animation.items.map((item, i) => <i key={item.label} className={i === active ? "on" : ""} />)}</div>
    </div>
  );
}

export default function HelpAnimations({ ids }) {
  const animations = (ids || []).map(getHelpAnimation).filter(Boolean);
  const [selected, setSelected] = useState(0);
  const current = animations[Math.min(selected, animations.length - 1)];
  if (!current) return null;
  return (
    <div className="help-anim" role="group" aria-label="Animated guide">
      {animations.length > 1 && (
        <div className="ha-tabs">
          {animations.map((animation, index) => (
            <button key={animation.id} type="button" className={index === selected ? "on" : ""} onClick={() => setSelected(index)}>{animation.title}</button>
          ))}
        </div>
      )}
      <Animation key={current.id} animation={current} />
    </div>
  );
}
