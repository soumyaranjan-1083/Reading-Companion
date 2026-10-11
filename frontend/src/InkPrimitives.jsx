import { useEffect, useState } from "react";
import { InkIcon } from "./InkIcons.jsx";
import { createHoldConfirmController, moveInkGoal, saveInkMotion, toggleInkSwitch } from "./inkMotion.js";
import "./InkUI.css";

export { InkIcon };

export function InkCard({ as: Element = "section", className = "", children, ...props }) {
  return <Element className={`ink-card ${className}`.trim()} {...props}>{children}</Element>;
}

export function InkChapter({ index, title, children, className = "" }) {
  return <section className={`ink-chapter ${className}`.trim()}>
    <header className="ink-chapter-head"><span className="ink-chapter-index">{index}</span><h2>{title}</h2><i aria-hidden="true" /></header>
    {children}
  </section>;
}

export function InkSwitch({ checked, onChange, label, disabled = false, hint }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} aria-describedby={hint ? `${label.replace(/\s+/g, "-")}-hint` : undefined} disabled={disabled} className={`ink-switch ${checked ? "is-on" : ""}`} onClick={() => {
    if (disabled) return;
    toggleInkSwitch(checked, onChange);
  }}>
    <span className="ink-switch-copy"><span>{label}</span>{hint && <small id={`${label.replace(/\s+/g, "-")}-hint`}>{hint}</small>}</span>
    <span className="ink-switch-track" aria-hidden="true"><i /></span>
  </button>;
}

export function InkGoalDial({ value, options, onChange, label = "Daily reading goal" }) {
  const selected = Math.max(0, options.indexOf(value));
  const onKeyDown = (event) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const nextValue = moveInkGoal(value, options, direction);
    const next = options.indexOf(nextValue);
    event.currentTarget.querySelector(`[data-goal-index="${next}"]`)?.focus();
    navigator.vibrate?.(8);
    onChange(nextValue);
  };
  return <div className="ink-goal" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
    <div className="ink-goal-arc" aria-hidden="true"><svg viewBox="0 0 240 138"><path className="ink-goal-track" d="M24 118a96 96 0 0 1 192 0" /><path className="ink-goal-value" d="M24 118a96 96 0 0 1 192 0" style={{ strokeDasharray: 302, strokeDashoffset: 302 - (302 * selected) / Math.max(options.length - 1, 1) }} /></svg><div><b>{value}</b><small>per day</small></div></div>
    <div className="ink-goal-detents">
      {options.map((option, index) => <button key={option} type="button" role="radio" aria-checked={selected === index} tabIndex={selected === index ? 0 : -1} data-goal-index={index} onClick={() => { navigator.vibrate?.(8); onChange(option); }}><i aria-hidden="true" />{option}</button>)}
    </div>
  </div>;
}

export function InkHoldConfirmButton({ label = "Hold to confirm", onConfirm, holdMs = 1200 }) {
  const [progress, setProgress] = useState(0);
  const [controller] = useState(() => createHoldConfirmController({ onConfirm, onProgress: setProgress, holdMs }));
  useEffect(() => {
    controller.updateHandlers(onConfirm, setProgress);
    return () => controller.stop();
  }, [controller, onConfirm]);
  const begin = () => controller.start();
  const finish = () => controller.stop();
  const keyboardConfirm = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    controller.keyboard();
  };
  return <button type="button" className="ink-hold" aria-label={`${label}; hold for ${Math.ceil(holdMs / 100) / 10} seconds, or activate normally with a screen reader`} onPointerDown={(event) => { if (event.button === 0) begin(); }} onPointerUp={finish} onPointerCancel={finish} onPointerLeave={finish} onKeyDown={keyboardConfirm} onClick={(event) => {
    if (event.detail === 0 && !controller.wasConfirmed()) { controller.keyboard(); return; }
    if (event.detail === 0 && controller.wasConfirmed()) return;
    if (!controller.wasConfirmed()) controller.stop();
  }}>
    <span className="ink-hold-ring" aria-hidden="true" style={{ transform: `scale(${0.45 + progress * 0.55})`, opacity: progress }} />
    <InkIcon name="trash" size={18} /><span>{label}</span>
  </button>;
}

export function InkConfirmationSheet({ message, onCancel, onConfirm, label = "Confirm delete" }) {
  return <div className="ink-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="ink-confirm-sheet" role="alertdialog" aria-modal="true" aria-label="Confirm destructive action">
      <span className="ink-confirm-seal"><InkIcon name="shield" size={22} /></span>
      <p>{message}</p>
      <div className="ink-confirm-actions"><button type="button" className="ink-confirm-cancel" onClick={onCancel}>Cancel</button><InkHoldConfirmButton label={label} onConfirm={onConfirm} /></div>
    </section>
  </div>;
}

export function InkStamp({ label, description = "", earned = false, seen = false, icon = "book", animate = true, delay = 0 }) {
  return <div className={`ink-stamp ${earned ? "earned" : "locked"}${earned && animate && !seen ? " thump" : ""}`} style={{ "--stamp-delay": `${delay}ms` }} aria-label={`${label}: ${earned ? "earned" : "not yet earned"}${description ? `. ${description}` : ""}`} title={description || undefined}>
    <InkIcon name={icon} size={19} /><small>{label}</small>
  </div>;
}

export function InkShelfMeter({ value, unit = "KB", reference = null, visualReference = null }) {
  const percent = reference ? Math.min(100, (value / reference) * 100) : 0;
  const visualPercent = visualReference ? Math.min(100, (value / visualReference) * 100) : percent;
  return <div className="ink-shelf-meter" role="img" aria-label={reference ? `${value} ${unit} used of ${reference} ${unit}` : `${value} ${unit} used; no fixed cap`}>
    <div className="ink-shelf-books" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ "--book-height": `${[22, 28, 34][index % 3]}px`, "--book-fill": visualReference || reference ? `${Math.max(0, Math.min(100, visualPercent - index * 12.5))}%` : "0%" }} />)}</div>
    <div className="ink-shelf-meta"><b>{value} {unit}</b><span>{reference ? `of ${reference} ${unit}` : "No fixed storage cap"}</span></div>
  </div>;
}

export function InkMotionControl({ value, onChange }) {
  return <div className="ink-motion-control" role="group" aria-label="Motion preference">
    {["rich", "calm"].map((mode) => <button key={mode} type="button" aria-pressed={value === mode} className={value === mode ? "selected" : ""} onClick={() => {
      navigator.vibrate?.(8);
      saveInkMotion(mode);
      onChange(mode);
    }}>{mode === "rich" ? "Rich" : "Calm"}</button>)}
  </div>;
}
