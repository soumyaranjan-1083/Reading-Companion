/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
import { motion as Motion } from "framer-motion";
import {
    BellRing, Bug, Check, Clock3,
    ChevronLeft, ChevronRight,
    Cloud,
    Download, HardDrive, ImagePlus, Lightbulb,
    LogOut,
    Moon, Redo2, RefreshCw,
    Send,
    Shield,
    Sparkles, Sun, Target, Trash2, Undo2, Upload, Volume2, Wrench, X as XIcon, Zap
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch, apiFetchFast } from "./api.js";
import { useBackLayer } from "./backStack.js";
import MajorReleaseCard from "./MajorRelease.jsx";
import CatalogCard from "./CatalogCard.jsx";
import ReaderArenaReleaseCard from "./ReaderArenaReleaseCard.jsx";
import { INTERACTION_SPRING } from "./motionConfig.js";
import { useGeminiVoiceDriver } from "./onboarding/avatarDriver.js";
import { applyPushPrefs, collectSessionStarts, currentPushEndpoint, computeStudyPattern, formatClockMinute, loadPushPrefs, notificationPermission, pushErrorMessage } from "./pushNotifications.js";
import { getReleaseHistory, normalizeReportStatus } from "./reportIssueHelpers.js";
import { ReportDetail, ReportList } from "./ReportsView.jsx";
import "./SettingsScreens.css";
import { useHaptic } from "./useHaptic.js";
import { APP_VERSION } from "./version.js";
import { fetchArenaPhotoPreference, setArenaPhotoVisibility } from "./readingQuota.js";

export { APP_VERSION };
const VOICES = ["Leda", "Aoede", "Kore", "Despina", "Erinome", "Sulafat", "Achernar", "Charon", "Orus"];
const GOALS = ["10 min", "20 min", "30 min", "1 hour"];
const PREVIEW_PROMPT =
  "You are a calm, warm reading companion. Every message looks like: [LINE] text. Say ONLY that text, word for word, " +
  "in a natural, relaxed, medium-low pitched voice with an Indian accent. Never add words.";

function Head({ title, sub, onBack }) {
  return (
    <header className="screen-header st-head">
      <button className="st-back" onClick={onBack} aria-label="Back"><ChevronLeft size={20} /></button>
      <div className="header-left"><h1>{title}</h1>{sub && <p className="eyebrow">{sub}</p>}</div>
    </header>
  );
}
function Group({ title, children }) {
  return <section className="st-group"><div className="st-group-title">{title}</div>{children}</section>;
}

const versionKey = (value) => String(value || "").trim().replace(/^v/i, "");

function ReleaseNotesScreen({ releases, onBack, highlightVersion = null }) {
  const target = versionKey(highlightVersion);
  const hasTarget = Boolean(target) && releases.some((release) => versionKey(release.version) === target);
  useEffect(() => {
    if (!hasTarget) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(`release-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [hasTarget, target]);
  return (
    <div className="screen set-screen">
      <div className="aurora-bg" />
      <PfHead title="Version & release notes" sub={`Current version ${APP_VERSION}`} onBack={onBack} />
      <div className="set-body">
      <SetSec title="Release history">
        {target && releases.length > 0 && !hasTarget && (
          <div className="st-note"><Sparkles size={15} /><span>Notes for v{target} are not published yet. Here is the full release history.</span></div>
        )}
        {releases.length === 0 ? (
          <div className="st-note"><Sparkles size={15} /><span>Release notes are loading or not available yet.</span></div>
        ) : (
          <div className="st-release-list">
            {releases.map((release, releaseIndex) => (
              <Motion.article
                key={`${release.version}-${release.date || "release"}`}
                id={`release-${versionKey(release.version)}`}
                data-version={versionKey(release.version)}
                className={`st-release-entry${hasTarget && versionKey(release.version) === target ? " is-target" : ""}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(releaseIndex * 0.07, 0.35), duration: 0.28, ease: "easeOut" }}
              >
                <span className="st-release-node" aria-hidden="true" />
                {release.arena ? <ReaderArenaReleaseCard release={release} /> : release.catalog ? <CatalogCard release={release} /> : release.major || release.ui || release.pulse ? <MajorReleaseCard release={release} variant={release.pulse ? "pulse" : release.ui ? "ui" : "major"} /> : (
                <div className="st-release elevated">
                  <div className="st-release-head">
                    <div>
                      <b>{release.title || `Version ${release.version}`}</b>
                      <small>{release.date || "Recently updated"}</small>
                    </div>
                    <span>v{release.version}</span>
                  </div>
                  <div className="st-release-cards">
                    {(release.items || []).map((item, index) => (
                      <div key={`${release.version}-${index}`} className={`st-release-card st-release-card-${index % 4}`}>
                        <span className="st-release-card-mark" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                        <p>{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </Motion.article>
            ))}
          </div>
        )}
      </SetSec>
      </div>
    </div>
  );
}

function UpdateDetailsScreen({ releases, onBack, onApply, applying }) {
  const updates = releases.flatMap((release) => (release.items || []).map((item, index) => ({
    ...item,
    key: `${release.version}-${index}`,
    version: release.version,
    date: release.date,
  })));
  return (
    <div className="screen set-screen">
      <div className="aurora-bg" />
      <PfHead title="Update available" sub="A fresh version is ready" onBack={onBack} />
      <div className="set-body">
      <SetSec title="What’s new">
        {updates.length ? (
          <div className="st-update-cards">
            {updates.map((item, index) => {
              const Icon = item.type === "fix" ? Bug : item.type === "improve" ? Wrench : Sparkles;
              return (
                <Motion.article
                  key={item.key}
                  className={`st-update-card st-release-card-${index % 4}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.06, 0.3), duration: 0.25 }}
                >
                  <span className="st-update-icon"><Icon size={17} /></span>
                  <div><b>{item.type === "fix" ? "Fixed" : item.type === "improve" ? "Improved" : "New"}</b><p>{item.text}</p></div>
                  <span className="st-update-card-version">v{item.version}</span>
                </Motion.article>
              );
            })}
          </div>
        ) : (
          <div className="st-update-card"><span className="st-update-icon"><Sparkles size={17} /></span><p>A newer app version is ready to install.</p></div>
        )}
      </SetSec>
      <SetSec>
        <button className="primary-button st-update-install" onClick={onApply} disabled={applying}>
          <Download size={16} /> {applying ? "Updating…" : "Update now"}
        </button>
      </SetSec>
      </div>
    </div>
  );
}

function PfHead({ title, sub, onBack }) {
  return (
    <header className="pf-head">
      <button type="button" className="pf-head-back" onClick={onBack} aria-label="Back"><ChevronLeft size={20} /></button>
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
    </header>
  );
}
function SetSec({ title, children }) {
  return (
    <Motion.section className="set-sec" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-30px" }} transition={{ duration: 0.4, ease: "easeOut" }}>
      {title && <h2><i />{title}</h2>}
      {children}
    </Motion.section>
  );
}
function SetSwitchRow({ icon, label, hint, checked, disabled, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="set-row set-switch-row" onClick={() => onChange(!checked)} disabled={disabled}>
      <span className="set-row-ic">{icon}</span>
      <span className="set-row-tx"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <span className={`switch ${checked ? "on" : ""}`} aria-hidden="true"><span className="switch-thumb" /></span>
    </button>
  );
}
function SetRow({ icon, label, hint, onClick, danger, trailing, chevron }) {
  return (
    <button type="button" className={`set-row ${danger ? "danger" : ""}`} onClick={onClick}>
      <span className="set-row-ic">{icon}</span>
      <span className="set-row-tx"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      {trailing}
      {chevron && <ChevronRight size={16} />}
    </button>
  );
}

export function AccountScreen({ nav }) {
  const [syncingNow, setSyncingNow] = useState(false);
  const syncing = syncingNow || nav.accountSyncStatus === "syncing";
  const failed = nav.accountSyncStatus === "error";

  async function syncNow() {
    if (syncing) return;
    setSyncingNow(true);
    try { await nav.syncAccountNow?.(); }
    finally { setSyncingNow(false); }
  }

  return (
    <div className="screen set-screen ac-screen">
      <div className="aurora-bg" />
      <PfHead title="Account" sub="Your reading, connected" onBack={nav.goBack} />
      <div className="set-body ac-body">
        <Motion.section className="ac-identity" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.48, ease: "easeOut" }}>
          <div className="ac-overline"><span /> READER ACCOUNT <span className="ac-overline-index">01 / 02</span></div>
          <div className="ac-title-row">
            <div className="ac-mark"><Cloud size={30} strokeWidth={1.7} /></div>
            <div><h2>Your reading<br />travels with you.</h2><p>Connected with Google</p></div>
          </div>
          <div className="ac-email">
            <div><small>CONNECTED ACCOUNT</small><b>{nav.accountEmail}</b></div>
            <span className="ac-connected"><Check size={14} /> Connected</span>
          </div>
        </Motion.section>

        <Motion.section className="ac-sync" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.42 }}>
          <div className="ac-sync-top">
            <div><span className="ac-section-label">CLOUD SNAPSHOT</span><h3>Reading data</h3></div>
            <span className={`ac-state ${failed ? "error" : syncing ? "working" : "ready"}`}>
              <i />{failed ? "Needs attention" : syncing ? "Syncing now" : "Up to date"}
            </span>
          </div>
          <div className={`ac-sync-line ${syncing ? "active" : ""}`} aria-hidden="true"><i /><span /><i /></div>
          <div className="ac-sync-caption"><span>This device</span><b>{failed ? "Sync paused" : syncing ? "Sending changes" : "Account backup"}</b></div>
          <p>Books, saved gems, preferences, and reading progress sync when your data changes.</p>
        </Motion.section>

        <div className="ac-actions">
          <button type="button" className="ac-sync-button" onClick={() => void syncNow()} disabled={syncing}>
            <RefreshCw size={17} className={syncing ? "spinning" : ""} />{syncing ? "Syncing…" : "Sync now"}
          </button>
          <button type="button" className="ac-signout-button" onClick={() => void nav.signOut?.()}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
        <p className="ac-footnote"><Shield size={15} /> Signing out disconnects this device. Your cloud snapshot stays with your account.</p>
      </div>
    </div>
  );
}

// ======================= SETTINGS =======================
export function SettingsScreen({ nav, stores }) {
  const { profile, library, memory, gems } = stores;
  const [, bump] = useState(0);
  const [msg, setMsg] = useState("");
  const [voice, setVoice] = useState(profile.data.voice || "Leda");
  const [theme, setThemeState] = useState(profile.getTheme());
  const [previewing, setPreviewing] = useState(false);
  const [updateDetailsOpen, setUpdateDetailsOpen] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [pushPrefs, setPushPrefs] = useState(loadPushPrefs);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const [arenaPhotoVisible, setArenaPhotoVisible] = useState(true);
  const [arenaPhotoBusy, setArenaPhotoBusy] = useState(false);
  const [arenaPhotoError, setArenaPhotoError] = useState("");
  const [deletedBooks, setDeletedBooks] = useState(() => library.listDeletedBooks());
  const [deletedBooksOpen, setDeletedBooksOpen] = useState(false);
  const [studyPattern] = useState(() => computeStudyPattern(collectSessionStarts(library)));
  const { triggerLightTap } = useHaptic();
  const drv = useGeminiVoiceDriver({ voiceName: voice });
  const fileRef = useRef(null);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2800); };
  function refreshDeletedBooks() {
    setDeletedBooks(library.listDeletedBooks());
    bump((n) => n + 1);
  }
  useEffect(() => {
    const refresh = () => setDeletedBooks(library.listDeletedBooks());
    window.addEventListener("rc:local-data-changed", refresh);
    return () => window.removeEventListener("rc:local-data-changed", refresh);
  }, [library]);
  useEffect(() => {
    let cancelled = false;
    if (!nav.userId) return undefined;
    fetchArenaPhotoPreference().then(({ showPhoto }) => {
      if (!cancelled) {
        setArenaPhotoVisible(showPhoto !== false);
        setArenaPhotoError("");
      }
    }).catch(() => {
      if (!cancelled) setArenaPhotoError("Arena photo privacy setting could not be loaded.");
    });
    return () => { cancelled = true; };
  }, [nav.userId]);

  async function updateArenaPhotoPreference(showPhoto) {
    const previous = arenaPhotoVisible;
    setArenaPhotoVisible(showPhoto);
    setArenaPhotoBusy(true);
    setArenaPhotoError("");
    try {
      await setArenaPhotoVisibility(showPhoto);
    } catch {
      setArenaPhotoVisible(previous);
      setArenaPhotoError("Could not save the Arena photo setting. Try again.");
    } finally {
      setArenaPhotoBusy(false);
    }
  }
  function restoreBook(book) {
    const related = library.restoreBook(book.id);
    if (!related) return;
    gems.restoreMany(related.gems);
    if (typeof related.conversation === "string") localStorage.setItem(`rc_convo_${book.id}`, related.conversation);
    refreshDeletedBooks();
    flash(`"${book.displayTitle || book.title}" restored with its reading data.`);
  }
  function permanentlyDeleteBook(book) {
    if (!window.confirm(`Permanently delete "${book.displayTitle || book.title}" and its archived gems and conversation history? This cannot be undone.`)) return;
    if (!library.permanentlyDeleteBook(book.id)) return;
    refreshDeletedBooks();
    flash("Book and its archived data permanently deleted.");
  }
  const save = (k, v) => { profile.data[k] = v; profile._save(); bump((n) => n + 1); };
  const kb = Math.round(Object.keys(localStorage).reduce((s, k) => s + k.length + (localStorage.getItem(k) || "").length, 0) * 2 / 1024);

  function setTheme(next) {
    triggerLightTap();
    setThemeState(next);
    profile.setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }
  async function preview() {
    if (previewing) return;
    setPreviewing(true);
    try {
      if (await drv.connect(PREVIEW_PROMPT)) {
        await drv.say("[LINE] Namaste! Main aapka reading companion hoon. Chaliye, kitaab kholte hain.", { fallback: "Namaste!" });
      } else flash("Voice preview is unavailable right now");
    } finally { drv.close(); setPreviewing(false); }
  }
  async function updatePushPref(key, value) {
    if (pushBusy) return;
    triggerLightTap();
    const next = { ...pushPrefs, [key]: value };
    setPushBusy(true);
    setPushError("");
    try {
      await applyPushPrefs(next, library);
      setPushPrefs(next);
      if (value) flash(key === "reminders" ? "Study reminders on" : "Notifications on");
    } catch (error) {
      setPushError(pushErrorMessage(error));
    } finally {
      setPushBusy(false);
    }
  }
  function exportAll() {
    const data = {};
    Object.keys(localStorage).forEach((k) => { if (k.startsWith("reading_companion") || k.startsWith("rc_")) data[k] = localStorage.getItem(k); });
    const blob = new Blob([JSON.stringify({ __rc: 1, version: APP_VERSION, data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "reading-companion-backup.json"; a.click();
    URL.revokeObjectURL(a.href);
    flash("Backup downloaded");
  }
  function importFile(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result));
        if (d.__rc === 1) Object.entries(d.data).forEach(([k, v]) => localStorage.setItem(k, v));
        else if (d.books) library.importData(String(r.result));
        else throw new Error("bad");
        flash("Restored. Reloading…");
        setTimeout(() => window.location.reload(), 600);
      } catch { flash("That is not a valid backup file"); }
    };
    r.readAsText(file);
  }
  function clearChats() {
    if (!window.confirm("Clear the saved conversation recaps for all books?")) return;
    Object.keys(localStorage).forEach((k) => { if (k.startsWith("rc_convo_") || k === "reading_companion_openers") localStorage.removeItem(k); });
    flash("Conversation history cleared"); bump((n) => n + 1);
  }
  function clearMemory() {
    if (!window.confirm("Delete all saved preferences?")) return;
    memory.memories = []; memory._save(); flash("Preferences cleared");
  }
  function clearGems() {
    if (!window.confirm("Delete ALL saved gems? This cannot be undone.")) return;
    gems.gems = []; gems._save(); flash("Gems deleted"); bump((n) => n + 1);
  }
  async function wipe() {
    if (!window.confirm("Delete EVERYTHING (books, gems, memory, profile)? This cannot be undone.")) return;
    try {
      await nav.deleteAccountData?.();
      localStorage.clear();
      window.location.reload();
    } catch (error) {
      flash(error?.message || "Cloud data could not be deleted. Nothing on this device was cleared.");
    }
  }
  async function checkUpdate() {
    if (nav.updateAvailable) {
      setUpdateDetailsOpen(true);
      return;
    }
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const available = await nav.checkForUpdates?.();
      if (available || nav.updateAvailable) setUpdateDetailsOpen(true);
      else flash("There is currently no update available for the app.");
    } catch {
      flash("Could not check for updates right now.");
    } finally {
      setCheckingUpdate(false);
    }
  }

  const [releaseHistory, setReleaseHistory] = useState([]);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/release-notes.json?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { releases: [] }))
      .then((data) => {
        if (active) setReleaseHistory(getReleaseHistory(data.releases || []));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  useBackLayer(updateDetailsOpen, () => setUpdateDetailsOpen(false));
  useBackLayer(releaseNotesOpen, () => setReleaseNotesOpen(false));
  useBackLayer(deletedBooksOpen, () => setDeletedBooksOpen(false));

  if (updateDetailsOpen) {
    return (
      <UpdateDetailsScreen
        releases={nav.updateReleases || []}
        onBack={() => setUpdateDetailsOpen(false)}
        onApply={async () => {
          setApplyingUpdate(true);
          try { await nav.applyUpdate?.(); }
          finally { setApplyingUpdate(false); }
        }}
        applying={applyingUpdate}
      />
    );
  }

  if (releaseNotesOpen) {
    return <ReleaseNotesScreen releases={releaseHistory} onBack={() => setReleaseNotesOpen(false)} />;
  }

  if (deletedBooksOpen) {
    return (
      <div className="screen set-screen">
        <div className="aurora-bg" />
        <PfHead title="Deleted books" sub={`${deletedBooks.length} ${deletedBooks.length === 1 ? "book" : "books"} in your bin`} onBack={() => setDeletedBooksOpen(false)} />
        <div className="set-body">
          <SetSec>
            <div className="set-card">
              {deletedBooks.length ? (
                <div className="set-rows">
                  {deletedBooks.map((book) => (
                    <div className="st-item" key={book.id}>
                      <div className="st-tx">
                        <b>{book.displayTitle || book.title}</b>
                        <small>Deleted {new Date(book.deletedAt).toLocaleDateString()}</small>
                      </div>
                      <button type="button" className="st-btn" onClick={() => restoreBook(book)}>Restore</button>
                      <button type="button" className="st-btn st-trash-permanent" onClick={() => permanentlyDeleteBook(book)} aria-label={`Permanently delete ${book.displayTitle || book.title}`}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              ) : <p className="st-note">Your deleted-books bin is empty.</p>}
            </div>
          </SetSec>
        </div>
        {msg && <div className="set-toast">{msg}</div>}
      </div>
    );
  }

  const usedPct = Math.min(100, Math.round((kb / 5120) * 100));

  return (
    <div className="screen set-screen">
      <div className="aurora-bg" />
      <PfHead title="Settings" sub={`Version ${APP_VERSION}`} onBack={nav.goBack} />

      <div className="set-body">
        <SetSec title="You & your companion">
          <div className="set-card">
            <label className="set-field"><span>Your name</span>
              <input className="set-input" defaultValue={profile.data.name} maxLength={30} onBlur={(e) => e.target.value.trim() && save("name", e.target.value.trim())} />
            </label>
            <label className="set-field"><span>Companion's name</span>
              <input className="set-input" defaultValue={profile.data.companionName || ""} maxLength={20} placeholder="e.g. Sathi" onBlur={(e) => save("companionName", e.target.value.trim())} />
              <small>What you call your reading friend</small>
            </label>
            <div className="set-field">
              <div className="set-label"><Target size={16} /> Daily reading goal</div>
              <div className="set-pills">
                {GOALS.map((g) => (
                  <Motion.button key={g} type="button" whileTap={{ scale: 0.94 }} transition={INTERACTION_SPRING} className={`set-pill ${profile.data.dailyGoal === g ? "on" : ""}`} onClick={() => { triggerLightTap(); save("dailyGoal", g); }}>{g}</Motion.button>
                ))}
              </div>
            </div>
          </div>
        </SetSec>

        <SetSec title="Appearance">
          <div className="set-card">
            <div className="set-themes" role="group" aria-label="Theme">
              <Motion.button type="button" whileTap={{ scale: 0.97 }} transition={INTERACTION_SPRING} className={`set-theme ${theme === "light" ? "on" : ""}`} onClick={() => setTheme("light")}>
                <span className="set-theme-art light"><i /><i /><b /></span>
                <span><Sun size={14} /> Light</span>
              </Motion.button>
              <Motion.button type="button" whileTap={{ scale: 0.97 }} transition={INTERACTION_SPRING} className={`set-theme ${theme === "dark" ? "on" : ""}`} onClick={() => setTheme("dark")}>
                <span className="set-theme-art dark"><i /><i /><b /></span>
                <span><Moon size={14} /> Dark</span>
              </Motion.button>
            </div>
          </div>
        </SetSec>

        <SetSec title="Voice">
          <div className="set-card">
            <div className="set-label"><Volume2 size={16} /> Companion voice</div>
            <div className="set-voices" role="radiogroup" aria-label="Companion voice">
              {VOICES.map((v) => (
                <button key={v} type="button" role="radio" aria-checked={voice === v} className={`set-pill ${voice === v ? "on" : ""}`} onClick={() => { triggerLightTap(); setVoice(v); save("voice", v); }}>{v}</button>
              ))}
            </div>
            <small className="set-hint">Applies from your next session</small>
            <button type="button" className="set-btn" onClick={preview} disabled={previewing}><Volume2 size={15} /> {previewing ? "Playing…" : "Preview this voice"}</button>
          </div>
        </SetSec>

        <SetSec title="Notifications">
          <div className="set-card">
            <div className="set-rows">
              <SetSwitchRow icon={<BellRing size={16} />} label="App updates & announcements" hint="New versions and important news, in your notification tray"
                checked={pushPrefs.announcements} disabled={pushBusy} onChange={(on) => updatePushPref("announcements", on)} />
              <SetSwitchRow icon={<Clock3 size={16} />} label="Smart study reminders"
                hint={studyPattern
                  ? `You usually read around ${formatClockMinute(studyPattern.typicalMinute)}. We'll nudge you at ${formatClockMinute(studyPattern.reminderMinute)}.`
                  : "We'll learn when you usually read and remind you just before. A few more sessions needed."}
                checked={pushPrefs.reminders} disabled={pushBusy} onChange={(on) => updatePushPref("reminders", on)} />
            </div>
            {pushError
              ? <small className="set-hint set-push-error" role="alert">{pushError}</small>
              : notificationPermission() === "denied" && <small className="set-hint">Notifications are blocked for this app in your device settings.</small>}
          </div>
        </SetSec>

        <SetSec title="Privacy & storage">
          <div className="set-card">
            <div className="set-note"><Shield size={16} />
              <span>Your books, gems, words and memories stay on this device and in your private account snapshot when sync is enabled. If Arena photo sharing is on, your cropped profile photo is stored in a private bucket and shown to signed-in Arena readers with an expiring link. During a session your voice, camera frames and page snapshots are sent to Google Gemini to generate replies.</span>
            </div>
            <div className="set-rows">
              <SetSwitchRow icon={<ImagePlus size={16} />} label="Show my photo in the Arena" hint="Other signed-in readers see your photo. Turn this off to show initials instead." checked={arenaPhotoVisible} disabled={!nav.userId || arenaPhotoBusy} onChange={updateArenaPhotoPreference} />
            </div>
            {arenaPhotoError && <small className="set-hint set-push-error" role="alert">{arenaPhotoError}</small>}
            <div className="set-meter">
              <div className="set-meter-top"><b><HardDrive size={14} style={{ verticalAlign: "-2px" }} /> Storage used</b><span>{kb} KB on this device</span></div>
              <div className="set-bar"><i style={{ width: `${Math.max(usedPct, 3)}%` }} /></div>
            </div>
            <div className="set-rows">
              <SetRow icon={<Trash2 size={16} />} label="Clear conversation history" hint="Recaps used for continuity" onClick={clearChats} />
              <SetRow icon={<Trash2 size={16} />} label="Clear saved preferences" onClick={clearMemory} />
              <SetRow icon={<Trash2 size={16} />} label="Delete all gems" onClick={clearGems} />
            </div>
          </div>
        </SetSec>

        <SetSec title="Deleted books">
          <div className="set-card">
            <div className="set-note"><Trash2 size={16} />
              <span>Deleted books and their reading data are kept in a separate bin until you restore or permanently remove them.</span>
            </div>
            <SetRow icon={<Trash2 size={16} />} label="Open deleted-books bin" hint={`${deletedBooks.length} ${deletedBooks.length === 1 ? "book" : "books"}`} onClick={() => setDeletedBooksOpen(true)} chevron />
          </div>
        </SetSec>

        <SetSec title="Reading limit">
          <div className="set-card">
            <div className="set-note"><Clock3 size={16} />
              <span>{nav.readingQuota
                ? `Your account allows ${nav.readingQuota.dailyLimitMinutes} minutes per UTC calendar day. ${Math.floor(nav.readingQuota.remainingSeconds / 60)} minutes remain today. Usage is tracked to your signed-in account.`
                : nav.quotaError || "Loading your account reading limit…"}
              </span>
            </div>
            {nav.quotaError && <button type="button" className="st-btn" onClick={() => void nav.refreshReadingQuota?.().catch((error) => flash(error.message))}>Retry limit check</button>}
            <button type="button" className="st-btn" onClick={() => nav.openDeveloperEmail("limit_increase", {
              request: "I would like to request an increase to my daily reading time limit.",
            })}>
              <Send size={15} /> Contact developer
            </button>
          </div>
        </SetSec>

        <SetSec title="Backup">
          <div className="set-duo">
            <SetRow icon={<Download size={18} />} label="Export backup" hint="One JSON file" onClick={exportAll} />
            <SetRow icon={<Upload size={18} />} label="Restore" hint="From a backup file" onClick={() => fileRef.current?.click()} />
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} />
        </SetSec>

        <SetSec title="App">
          <div className="set-card">
            <div className="set-rows">
              <SetRow icon={<RefreshCw size={16} />} label="Check for updates" hint={checkingUpdate ? "Checking for a newer version…" : `Version ${APP_VERSION}`} onClick={checkUpdate}
                trailing={nav.updateAvailable ? <span className="set-update-dot" aria-label="1 update available">1</span> : null} />
              <SetRow icon={<Sparkles size={16} />} label="Version & release notes" hint="See what’s new in Reading Companion" onClick={() => setReleaseNotesOpen(true)}
                trailing={<span className="set-version">v{APP_VERSION}</span>} chevron />
            </div>
          </div>
        </SetSec>

        <SetSec title="Danger zone">
          <SetRow icon={<Trash2 size={16} />} label="Delete all my data" hint="Books, gems, memory and profile" onClick={wipe} danger />
        </SetSec>
      </div>

      {msg && <div className="set-toast">{msg}</div>}
    </div>
  );
}

export { AboutScreen } from "./AboutScreen.jsx";

// ======================= REPORT AN ISSUE =======================
const REPORT_KEY = "rc_reports";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function signReportScreenshots(report) {
  const screenshots = Array.isArray(report.screenshots) ? report.screenshots : [];
  const paths = screenshots.filter((screenshot) => typeof screenshot === "string" && !/^(?:data:image\/|https?:\/\/)/i.test(screenshot));
  if (paths.length === 0 || !report.id) return { ...report, screenshotUrls: screenshots };

  try {
    const response = await apiFetch("/api/bug-reports/screenshot-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: report.id, paths }),
    });
    if (!response.ok) return { ...report, screenshotUrls: screenshots.filter((screenshot) => /^(?:data:image\/|https?:\/\/)/i.test(screenshot)) };
    const data = await response.json();
    const urls = new Map((data.screenshots || []).map(({ path, url }) => [path, url]));
    return {
      ...report,
      screenshotUrls: screenshots
        .map((screenshot) => urls.get(screenshot) || (/^(?:data:image\/|https?:\/\/)/i.test(screenshot) ? screenshot : null))
        .filter(Boolean),
    };
  } catch {
    return { ...report, screenshotUrls: screenshots.filter((screenshot) => /^(?:data:image\/|https?:\/\/)/i.test(screenshot)) };
  }
}

async function deliver(report) {
  let storedReport = null;
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const response = await apiFetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: { ...report, pushEndpoint: await currentPushEndpoint() } }),
      });
      if (!response.ok) return null;
      storedReport = await response.json();
    } catch {
      return null;
    }
  }
  const screenshots = storedReport?.screenshots || report.screenshots || [];
  if (!storedReport) return null;
  const displayReport = await signReportScreenshots({ ...report, screenshots });
  return {
    ticketNumber: storedReport?.ticketNumber || report.ticketNumber || null,
    screenshots,
    screenshotUrls: displayReport.screenshotUrls,
  };
}

async function fetchReportFromSupabase(reportId) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !reportId) return null;
  const url = new URL(`${SUPABASE_URL}/rest/v1/bug_reports`);
  url.searchParams.set("select", "*");
  url.searchParams.set("id", `eq.${reportId}`);
  url.searchParams.set("limit", "1");
  const res = await fetch(url.toString(), { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) throw new Error(`report_fetch_failed_${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? signReportScreenshots(rows[0]) : null;
}

// Only reports this device submitted are synced; matching by reporter name would pull in other people's reports.
async function syncReportsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const ownedIds = loadReports().map((item) => item.id).filter((id) => /^r-\d+$/.test(id || ""));
  if (!ownedIds.length) return [];
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/bug_reports`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("id", `in.(${ownedIds.join(",")})`);
    const res = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? Promise.all(rows.map(signReportScreenshots)) : [];
  } catch {
    return [];
  }
}
const TYPES = [
  { id: "bug", label: "Bug", Icon: Bug, description: "Something is broken, confusing, or not working as expected." },
  { id: "issue", label: "Issue", Icon: Zap, description: "A problem, blocker, or friction point in the app flow." },
  { id: "feature", label: "New feature", Icon: Lightbulb, description: "Suggest a new capability or experience you want added." },
  { id: "enhance", label: "Improvement", Icon: Sparkles, description: "Recommend a better version of an existing feature or flow." },
];
const AREAS = ["Home", "Reading session", "Welcome tour", "Library", "Gems & story card", "Memory & mind map", "Profile & settings", "Other"];
const SEV = ["Low", "Medium", "High", "Blocking"];

function toDataUrl(file, max = 1000) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.72));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
function loadReports() { try { return JSON.parse(localStorage.getItem(REPORT_KEY) || "[]"); } catch { return []; } }

// Grows with the text up to a cap, so the page scrolls instead of the box.
function autoGrow(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight + 2, 240)}px`;
}

// Keeps the focused field clear of the fixed bottom bar and the on-screen keyboard.
function keepFieldVisible(event) {
  const field = event.target;
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(field?.tagName || "")) return;
  setTimeout(() => field.scrollIntoView({ block: "center", behavior: "smooth" }), 280);
}

function ImageLightbox({ images, index, onClose, onIndex }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && index < images.length - 1) onIndex(index + 1);
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onIndex]);
  return createPortal(
    <div className="rp-lightbox" role="dialog" aria-modal="true" aria-label="Screenshot preview" onClick={onClose}>
      <button type="button" className="rp-lightbox-close" onClick={onClose} aria-label="Close preview"><XIcon size={20} /></button>
      <img src={images[index]} alt={`Screenshot ${index + 1} of ${images.length}`} onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <div className="rp-lightbox-nav" onClick={(e) => e.stopPropagation()}>
          <button type="button" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Previous screenshot"><ChevronLeft size={20} /></button>
          <span>{index + 1} / {images.length}</span>
          <button type="button" disabled={index === images.length - 1} onClick={() => onIndex(index + 1)} aria-label="Next screenshot"><ChevronRight size={20} /></button>
        </div>
      )}
    </div>,
    document.body,
  );
}

export function ReportScreen({ nav, stores }) {
  const [lightbox, setLightbox] = useState(null);
  const [type, setType] = useState("bug");
  const [area, setArea] = useState(AREAS[0]);
  const [sev, setSev] = useState("Medium");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState("");
  const [shots, setShots] = useState([]);
  const [view, setView] = useState(() => {
    try { return sessionStorage.getItem("rc-open-reports") === "1" ? "reports" : "compose"; } catch { return "compose"; }
  });
  const [reportFilter, setReportFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [releaseView, setReleaseView] = useState(null);
  const [list, setList] = useState(loadReports);
  const [msg, setMsg] = useState("");
  const [refreshingReports, setRefreshingReports] = useState(false);
  const [refreshingOne, setRefreshingOne] = useState(false);
  const [rewrite, setRewrite] = useState(null);
  const rewriteRequestRef = useRef(0);
  const fileRef = useRef(null);
  const isFault = type === "bug" || type === "issue";

  const filteredReports = list.filter((item) => reportFilter === "all" || item.type === reportFilter);
  const selectedReport = filteredReports.find((item) => item.id === selectedId) || null;

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2800); };

  useEffect(() => {
    try { sessionStorage.removeItem("rc-open-reports"); } catch { /* storage unavailable */ }
  }, []);

  useBackLayer(view === "reports" && Boolean(selectedId), () => setSelectedId(null));
  useBackLayer(Boolean(releaseView), () => setReleaseView(null));
  useBackLayer(Boolean(lightbox), () => setLightbox(null));

  const releaseRequested = Boolean(releaseView);
  useEffect(() => {
    if (!releaseRequested) return undefined;
    let active = true;
    fetch(`/release-notes.json?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { releases: [] }))
      .then((data) => {
        if (active) setReleaseView((current) => (current ? { ...current, releases: getReleaseHistory(data.releases || []) } : current));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [releaseRequested]);

  function persist(next) {
    const prepared = next.map((r) => ({
      ...r,
      status: normalizeReportStatus(r),
      resolvedAt: r.resolvedAt || r.resolved_at || null,
      resolvedInVersion: r.resolvedInVersion || r.resolved_in_version || null,
      resolutionNote: r.resolutionNote || r.resolution_note || "",
    }));
    setList(prepared);
    try { localStorage.setItem(REPORT_KEY, JSON.stringify(prepared)); }
    catch { try { localStorage.setItem(REPORT_KEY, JSON.stringify(prepared.map((r) => ({ ...r, screenshots: [] })))); } catch { /* storage full */ } }
  }

  async function refreshReports() {
    if (!SUPABASE_URL || !SUPABASE_KEY || refreshingReports) return;
    setRefreshingReports(true);
    try {
      const remote = await syncReportsFromSupabase();
      if (remote.length) {
        const local = loadReports();
        const merged = [...remote, ...local.filter((item) => !remote.some((row) => row.id === item.id))];
        persist(merged.slice(0, 25));
      }
      flash("Report statuses refreshed");
    } catch {
      flash("Could not refresh reports right now");
    } finally {
      setRefreshingReports(false);
    }
  }

  async function refreshOneReport(reportId) {
    if (!SUPABASE_URL || !SUPABASE_KEY || refreshingOne) return;
    setRefreshingOne(true);
    try {
      // keep the spinner visible long enough to notice
      const [row] = await Promise.all([fetchReportFromSupabase(reportId), new Promise((resolve) => setTimeout(resolve, 600))]);
      if (row) {
        const local = loadReports();
        const exists = local.some((item) => item.id === reportId);
        persist(exists ? local.map((item) => (item.id === reportId ? { ...item, ...row } : item)) : [row, ...local].slice(0, 25));
        flash("Report updated");
      } else {
        flash("This report was not found online yet");
      }
    } catch {
      flash("Could not refresh this report right now");
    } finally {
      setRefreshingOne(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function sync() {
      if (!SUPABASE_URL || !SUPABASE_KEY) return;
      const remote = await syncReportsFromSupabase();
      if (!active || !remote.length) return;
      const local = loadReports();
      const merged = [...remote, ...local.filter((item) => !remote.some((row) => row.id === item.id))];
      persist(merged.slice(0, 25));
    }
    sync();
    return () => { active = false; };
  }, [stores.profile.data.name]);

  useEffect(() => {
    if (selectedId && !filteredReports.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredReports, selectedId]);

  async function flush(current) {
    let changed = false;
    const next = [...current];
    for (let i = 0; i < next.length; i++) {
      if (normalizeReportStatus(next[i]) === "queued") {
        const delivered = await deliver(next[i]);
        if (!delivered) continue;
        next[i] = {
          ...next[i],
          status: "sent",
          ticketNumber: delivered.ticketNumber,
          screenshots: delivered.screenshots,
          screenshotUrls: delivered.screenshotUrls,
        };
        changed = true;
      }
    }
    if (changed) persist(next);
  }
  useEffect(() => { flush(list); }, []);

  async function addShots(files) {
    const room = 4 - shots.length;
    const picked = [...files].slice(0, room);
    const done = await Promise.all(picked.map((f) => toDataUrl(f).catch(() => null)));
    setShots((s) => [...s, ...done.filter(Boolean)]);
  }

  async function improveReportText() {
    if (desc.trim().length < 10 || rewrite?.status === "loading") return;
    const original = { description: desc, steps };
    const requestId = ++rewriteRequestRef.current;
    setRewrite({ status: "loading" });
    try {
      const response = await apiFetchFast("/api/ai/report-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: original.description, steps: original.steps }),
      }, { timeoutMs: 17000 });
      if (!response.ok) throw new Error("rewrite_unavailable");
      const suggestion = await response.json();
      if (requestId !== rewriteRequestRef.current) return;
      if (typeof suggestion.description !== "string" || typeof suggestion.steps !== "string") throw new Error("rewrite_invalid");
      setRewrite({ status: "suggestion", original, suggestion });
    } catch {
      if (requestId === rewriteRequestRef.current) setRewrite({ status: "error" });
    }
  }

  function updateReportText(setter, value) {
    rewriteRequestRef.current += 1;
    setRewrite(null);
    setter(value);
  }

  function submit() {
    if (title.trim().length < 3 || desc.trim().length < 10) return flash("Add a short title and a few details first");
    const r = {
      id: `r-${Date.now()}`, type, area, severity: isFault ? sev : null,
      title: title.trim(), description: desc.trim(), steps: isFault ? steps.trim() : "",
      screenshots: shots, status: "queued", createdAt: new Date().toISOString(),
      reporter: stores.profile.data.name, appVersion: APP_VERSION,
      device: {
        ua: navigator.userAgent, screen: `${window.innerWidth}x${window.innerHeight}`, lang: navigator.language,
        theme: stores.profile.getTheme(), standalone: window.matchMedia?.("(display-mode: standalone)").matches || false,
      },
    };
    const next = [r, ...list].slice(0, 25);
    persist(next);
    setSelectedId(r.id);
    setView("reports");
    setTitle(""); setDesc(""); setSteps(""); setShots([]);
    rewriteRequestRef.current += 1; setRewrite(null);
    flash("Saved. Thank you for helping improve the app!");
    flush(next);
  }

  if (releaseView) {
    return <ReleaseNotesScreen releases={releaseView.releases || []} highlightVersion={releaseView.version} onBack={() => setReleaseView(null)} />;
  }

  return (
    <div className="screen st-screen">
      <div className="aurora-bg" />
      <div className="rp-pin">
        <Head title="Report an issue" sub="Bugs, ideas and improvements" onBack={nav.goBack} />
        <div className="rp-pin-tabs">
          <div className="rp-slider-wrap">
            <div className="rp-slider">
              <button className={view === "compose" ? "on" : ""} onClick={() => setView("compose")}>Raise an issue</button>
              <button className={view === "reports" ? "on" : ""} onClick={() => setView("reports")}>Your reports</button>
            </div>
          </div>
        </div>
      </div>

      {view === "compose" && (
        <>
          <Group title="What is it about?">
            <label className="rp-dropdown-label">
              <span>Category</span>
              <select className="rp-type-select" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <div className="rp-type-summary">
              <span className="rp-type-badge">{TYPES.find((entry) => entry.id === type)?.label}</span>
              <p>{TYPES.find((entry) => entry.id === type)?.description}</p>
            </div>
          </Group>

          <Group title="Details">
            <div className="st-form elevated" onFocusCapture={keepFieldVisible}>
              <label>Where did it happen?
                <select className="st-input full" value={area} onChange={(e) => setArea(e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
              </label>
              {isFault && (
                <div>
                  <div className="st-lbl">How serious?</div>
                  <div className="st-chips">{SEV.map((s) => <button key={s} className={sev === s ? "on" : ""} onClick={() => setSev(s)}>{s}</button>)}</div>
                </div>
              )}
              <label>Title<input className="st-input full" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={type === "feature" ? "e.g. Dark reading mode" : "e.g. Mind map does not load"} /></label>
              <label>{type === "feature" || type === "enhance" ? "Describe your idea" : "What went wrong?"}
                <textarea className="st-input full rp-grow" ref={(el) => autoGrow(el)} rows={4} value={desc} maxLength={1500} onChange={(e) => updateReportText(setDesc, e.target.value)} placeholder="Write as much as you like" />
              </label>
              {isFault && <label>Steps to reproduce (optional)<textarea className="st-input full rp-grow" ref={(el) => autoGrow(el)} rows={3} value={steps} maxLength={800} onChange={(e) => updateReportText(setSteps, e.target.value)} placeholder="1. Open Memory  2. Tap Mind Map  3. ..." /></label>}
              <div className="rp-ai">
                {rewrite?.status !== "suggestion" && rewrite?.status !== "accepted" && (
                  <button type="button" className="rp-ai-trigger" onClick={improveReportText} disabled={rewrite?.status === "loading" || desc.trim().length < 10}>
                    <Sparkles size={15} /> {rewrite?.status === "loading" ? "Preparing suggestion…" : "Improve with AI"}
                  </button>
                )}
                {rewrite?.status === "error" && <span role="status">AI is unavailable right now. Your text is unchanged.</span>}
                {rewrite?.status === "suggestion" && (
                  <div className="rp-ai-preview">
                    <span>Suggestion</span>
                    <p>{rewrite.suggestion.description}</p>
                    {isFault && rewrite.suggestion.steps && <p>{rewrite.suggestion.steps}</p>}
                    <div>
                      <button type="button" onClick={() => { setDesc(rewrite.suggestion.description); if (isFault) setSteps(rewrite.suggestion.steps); setRewrite({ ...rewrite, status: "accepted", applied: true }); }}>Use suggestion</button>
                      <button type="button" onClick={() => setRewrite(null)}>Keep mine</button>
                    </div>
                  </div>
                )}
                {rewrite?.status === "accepted" && (
                  <button type="button" className="rp-ai-restore" onClick={() => {
                    const next = rewrite.applied ? rewrite.original : rewrite.suggestion;
                    setDesc(next.description);
                    if (isFault) setSteps(next.steps);
                    setRewrite({ ...rewrite, applied: !rewrite.applied });
                  }}>
                    {rewrite.applied ? <><Undo2 size={14} /> Undo</> : <><Redo2 size={14} /> Redo</>}
                  </button>
                )}
              </div>
              <div>
                <div className="st-lbl">Screenshots ({shots.length}/4)</div>
                <div className="rp-shots">
                  {shots.map((s, i) => (
                    <div key={i} className="rp-shot"><img src={s} alt="" /><button onClick={() => setShots((x) => x.filter((_, j) => j !== i))} aria-label="Remove"><XIcon size={12} /></button></div>
                  ))}
                  {shots.length < 4 && <button className="rp-add" onClick={() => fileRef.current?.click()}><ImagePlus size={20} /></button>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addShots(e.target.files); e.target.value = ""; }} />
              </div>
              <button className="primary-button" onClick={submit}><Send size={15} /> Submit</button>
            </div>
          </Group>
        </>
      )}

      {view === "reports" && (
        <Group>
          {selectedId && selectedReport ? (
            <ReportDetail
              report={selectedReport}
              types={TYPES}
              appVersion={APP_VERSION}
              canRefresh={Boolean(SUPABASE_URL && SUPABASE_KEY)}
              refreshing={refreshingOne}
              onBack={() => setSelectedId(null)}
              onRefresh={() => refreshOneReport(selectedReport.id)}
              onOpenImage={(images, index) => setLightbox({ images, index })}
              onOpenRelease={(version) => setReleaseView({ version, releases: null })}
            />
          ) : (
            <>
              <div className="rp-filter-row">
                <label className="rp-filter-label">Filter</label>
                <select className="rp-filter" value={reportFilter} onChange={(e) => setReportFilter(e.target.value)}>
                  <option value="all">All</option>
                  {TYPES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                </select>
                {SUPABASE_URL && SUPABASE_KEY && (
                  <button className="rp-refresh" type="button" onClick={refreshReports} disabled={refreshingReports} aria-label="Refresh report statuses" title="Refresh report statuses">
                    <RefreshCw size={15} className={refreshingReports ? "spinning" : ""} />
                  </button>
                )}
              </div>
              <ReportList reports={filteredReports} types={TYPES} onSelect={setSelectedId} onCompose={() => setView("compose")} />
            </>
          )}
        </Group>
      )}
      {msg && <div className="st-toast">{msg}</div>}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(next) => setLightbox((current) => (current ? { ...current, index: next } : current))}
        />
      )}
    </div>
  );
}
