const OPENER_KEY = "reading_companion_openers";
const APP_STARTED_AT = Date.now();
const OPENING_ANGLES = [
  "a quick warm hello and one light question about where they want to pick up",
  "a playful remark about the time of day, then ask what they're diving into",
  "a short encouraging line about coming back to the book",
  "a curious one-liner about what part of the story is on their mind",
  "a calm chai-time hello with no question at all",
  "a tiny joke about books or vocabulary, then wait",
  "a simple 'main sun raha hoon, bolo' style ready-to-listen line",
];
function getRecentOpeners() { try { return JSON.parse(localStorage.getItem(OPENER_KEY) || "[]"); } catch { return []; } }
function saveOpener(text) {
  try { localStorage.setItem(OPENER_KEY, JSON.stringify([...getRecentOpeners(), text.slice(0, 160)].slice(-8))); } catch { /* ignore */ }
}
const SNAPSHOT_OFF_NOTE = "[SYSTEM NOTE] The reader switched to the LIVE camera. Ignore the earlier page snapshot and use only the live camera pictures from now on. Do not say anything about this note.";
function buildOpeningNote(cont) {
  const hour = new Date().getHours();
  const period = hour < 5 ? "late night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
  let angle = OPENING_ANGLES[Math.floor(Math.random() * OPENING_ANGLES.length)];
  if (cont && cont.minutesAgo < 45) {
    angle = `the reader only stepped away about ${Math.max(1, Math.round(cont.minutesAgo))} minutes ago and is back in the SAME sitting. Say a natural 'wapas aa gaye? chalo wahin se' style line (you may mention chapter ${cont.chapter}). Do NOT say Namaste and do NOT ask what they will read today`;
  } else if (cont && cont.minutesAgo < 720) {
    angle = `the reader is back later the same day; their last session ended ${describeTimeGap(cont.endedAt)} on chapter ${cont.chapter}. Welcome them back warmly and mention where they stopped. Do not ask what they will read today`;
  } else if (cont) {
    angle = `the reader last read ${describeTimeGap(cont.endedAt)}, stopping at chapter ${cont.chapter}. Greet them freshly and gently mention where they left off`;
  }
  const recent = getRecentOpeners();
  return `[SYSTEM NOTE] The mic is live. Say ONE short opening line in Hinglish (under 18 words). Angle: ${angle}. It is ${period} in India. ` +
    (recent.length ? `Your recent openings were: ${recent.map((r) => `"${r}"`).join("; ")}. Do NOT reuse or closely paraphrase any of them. ` : "") +
    "Then stay quiet and listen.";
}
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import {
    AlertTriangle,
    BookMarked,
    BookOpen,
    Brain,
    Bug,
    Camera as CameraIcon,
    CameraOff,
    Check,
    ChevronRight,
    Clock,
    Cloud,
    Copy,
    Fingerprint,
    Download,
    Flame,
    Gem,
    Home,
    Image as ImageIcon,
    Info,
    Library as LibraryIcon,
    Lock,
    Mail,
    MessageCircleMore,
    MessageSquareText,
    Mic,
    MicOff,
    Moon,
    Network,
    Pencil,
    PhoneOff,
    Play,
    Plus,
    Quote,
    RefreshCw,
    ScanText,
    Search,
    Settings as SettingsIcon,
    Sparkles,
    // Sun,
    Trash2,
    TrendingDown,
    TrendingUp,
    // Upload,
    User,
    Volume2,
    WifiOff,
    X as XIcon
} from "lucide-react";
import { Component, Fragment, lazy, Suspense, useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "./AccountContext.js";
import AccountGate from "./AccountGate.jsx";
import { apiUrl } from "./api.js";
import { computeBadges } from "./appBadges.js";
import { refreshPushSubscription } from "./pushNotifications.js";
import PushPrompt from "./PushPrompt.jsx";
import { clearLayers, configureBackStack, handleBackStackPop, popRoute, pushRoute, useBackLayer } from "./backStack.js";
import { AudioCapture } from "./audioCapture.js";
import { AudioPlayback } from "./audioPlayback.js";
import BookTile from "./BookTile.jsx";
import { CameraCapture } from "./cameraCapture.js";
import { EmptyGemsArt, EmptyLibraryArt } from "./components/EmptyStateArt.jsx";
import BookSearchFlow from "./components/BookSearchFlow.jsx";
import MascotCharacter from "./components/MascotCharacter.jsx";
import { describeLiveStatus, friendlyErrorMessage } from "./friendlyErrors.js";
import { GeminiLiveClient } from "./geminiLiveClient.js";
import { createOpeningMicFallback, SessionMicGate } from "./sessionMicGate.js";
import { SessionAudioMute } from "./sessionAudioMute.js";
import { sessionStatusView } from "./sessionStatus.js";
import { summarizeLatencies } from "./sessionLatency.js";
import { buildPageStatusNote, createPageContextProvider, loadPage, pageCanBeSentToLive, savePage } from "./sessionPage.js";
import { pageVerificationDecision, parsePageVerificationResponse, rejectedPageMessage } from "./pageVerification.js";
import { buildPlaceholderChapterKnowledgeBlock, groundPlaceholderBookContext, isPlaceholderChapter } from "./readingGrounding.js";
import { classifyUtterance, float32ToPcmChunks } from "./autoListen.js";
import { classifyVoiceIntent } from "./voiceIntent.js";
import { ensureGemInsights } from "./gemInsightClient.js";
import { Gems } from "./gems.js";
import GemStoryCard from "./GemStoryCard.jsx";
import HelpGuideScreen from "./HelpGuideScreen.jsx";
import JourneyRecap from "./JourneyRecap.jsx";
import { Library } from "./library.js";
import { useMascotLine } from "./mascotLines.js";
import { getMascot, setMascot } from "./mascotPreference.js";
import { CompanionMemory } from "./memory.js";
import MemoryConstellation from "./MemoryConstellation.jsx";
import { INTERACTION_SPRING } from "./motionConfig.js";
import { dismissNotice, notify, notifyPersistent } from "./notify.js";
import { MASCOT_VOICE_PROMPT, useGeminiVoiceDriver } from "./onboarding/avatarDriver.js";
import EmberOrb from "./onboarding/EmberOrb.jsx";
import Onboarding from "./onboarding/Onboarding.jsx";
import {
    CLOSE_CAMERA_TRIGGER,
    COMPLETE_CHAPTER_DECLARATION,
    DELETE_CHAPTER_DECLARATION,
    DELETE_GEM_DECLARATION,
    DELETE_MEMORY_DECLARATION,
    DELETE_VOCABULARY_DECLARATION,
    END_SESSION_TRIGGER,
    EXPLICIT_MEMORY_TRIGGER,
    GET_READING_STATUS_DECLARATION,
    GET_SESSION_ACTIVITY_DECLARATION,
    LIST_SAVED_ITEMS_DECLARATION,
    LOG_VOCABULARY_DECLARATION,
    OPEN_CAMERA_TRIGGER,
    READER_PROFILE,
    SNAPSHOT_READER_PROFILE,
    RENAME_CHAPTER_DECLARATION,
    REQUEST_DELETE_DECLARATION,
    SAVE_GEM_DECLARATION,
    SAVE_GEM_TRIGGER,
    SAVE_MEMORY_DECLARATION,
    SET_BOOK_AUTHOR_DECLARATION,
    SET_CHAPTER_OUTLINE_DECLARATION,
    SET_CHAPTER_PAGES_DECLARATION,
    SET_CURRENT_CHAPTER_DECLARATION,
    UPDATE_CHAPTER_SUMMARY_DECLARATION,
    UPDATE_MEMORY_DECLARATION,
} from "./persona.js";
import { Profile } from "./profile.js";
import { clearArenaAvatar, fetchReadingQuota, recordReadingUsage, uploadArenaAvatar } from "./readingQuota.js";
import ReaderArenaEntry from "./ReaderArenaEntry.jsx";
import DeveloperEmailSheet from "./DeveloperEmailSheet.jsx";
import "./ProfileUI.css";
import "./ProfileCard.css";
import AvatarCropper from "./AvatarCropper";
import ProfileFloaters from "./ProfileFloaters";
import { findApproxSpokenVariant } from "./pronunciationObservation.js";
import ServiceNotice from "./ServiceNotice.jsx";
import { getRecap, saveTurn } from "./sessionMemory.js";
import { AboutScreen, AccountScreen, ReportScreen, SettingsScreen } from "./SettingsScreens.jsx";
import { useDocsUnlocked } from "./docsUnlock.js";
import DocsAccessCard from "./DocsAccessCard.jsx";
const DocsScreen = lazy(() => import("./docs/DocsScreen.jsx"));
const ReaderArena = lazy(() => import("./ReaderArena.jsx"));
import { prepareSnapshot } from "./snapshotCapture.js";
import { resolveStorySource } from "./story/resolveStorySource.js";
import StoryTheatre from "./story/StoryTheatre.jsx";
import UpdateAnnouncement from "./UpdateAnnouncement.jsx";
import UpdateManager from "./UpdateManager.jsx";
import { useBookAura } from "./useBookAura.js";
import { useButtonHaptics, useHaptic } from "./useHaptic.js";
import { APP_VERSION } from "./version.js";

const MODEL_NAME = "gemini-3.1-flash-live-preview";
const FALLBACK_MODEL_NAME = "gemini-2.5-flash-native-audio-preview-12-2025";
const LEGACY_STREAMING = import.meta.env.VITE_SESSION_STREAMING_LEGACY === "true";
const FOLLOWUP_MIC_MS = 8_000;
const RESUME_WINDOW_MS = 2 * 60 * 60_000;
const SILENCE_CHECK_MS = 4 * 60 * 1000;
const SILENCE_SHUTDOWN_MS = 45 * 1000;
const VOCAB_CONFIRM_TRIGGER = /\b(?:yes|yeah|yep|yup|haan|han|ha|haa|haanji|bilkul|sure|okay|ok|kar do|kardo|kar dijiye|kijiye|save it|save kar|add it|go ahead)\b|हाँ|हां|हा(?![\u0900-\u097F])|बिलकुल|बिल्कुल|ठीक है|कर दो|करदो|कीजिए|सेव कर|एड कर/i;
const VOCAB_DECLINE_TRIGGER = /\b(?:no|nope|nah|nahi|nahin|nai|mat|cancel|not now|don't|do not)\b|rehne do|rehne de|mat save|नहीं|नही|मत(?![\u0900-\u097F])|रहने दो|रहने दें/i;
const EXPLICIT_VOCAB_SAVE_TRIGGER = /\b(?:save|add|log|include|put)\b.{0,50}\b(?:word|vocab(?:ulary)?|it|this)\b|\b(?:word|vocab(?:ulary)?)\b.{0,40}\b(?:save|add|log|include)\b|(?:ye|yeh|is|isko|ise)\s+(?:word\s+)?(?:ko\s+)?(?:save|add|log|daal|jod)|\b(?:save|add)\s+(?:kar|karo|kr)\b|(?:सेव|जोड़|एड|ऐड).{0,20}(?:कर|करो)|(?:वर्ड|शब्द|वोकैब).{0,30}(?:सेव|जोड़|एड|ऐड)/i;
const NON_MEMORY_CONTENT_TRIGGER = /\b(?:gem|quote|quotation|book line|passage|vocab(?:ulary)?|word|chapter note)\b/i;
const GHOST_DUST = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  drift: ((index * 31) % 72) - 36,
  delay: (index % 6) * 0.28,
  duration: 2.2 + (index % 5) * 0.35,
  size: 2 + (index % 3),
}));
const ACTIVITY_ICONS = { word: BookOpen, gem: Gem, author: User, chapter: Play, rename: Pencil, pages: BookOpen, summary: MessageSquareText, done: Check, outline: LibraryIcon, memory: Brain, delete: Trash2 };

const memoryStore = new CompanionMemory();
const library = new Library();
const gemsStore = new Gems();
const profileStore = new Profile();
const SILENT = new Map();
function silentChunk(len) {
  if (!SILENT.has(len)) SILENT.set(len, btoa("\0".repeat(((len * 3) >> 2) & ~1)));
  return SILENT.get(len);
}
function readLastPage(bookId) {
  try {
    const n = Number(localStorage.getItem(`rc_last_page_${bookId}`));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}
function writeLastPage(bookId, page) {
  try { if (page) localStorage.setItem(`rc_last_page_${bookId}`, String(page)); } catch { /* storage unavailable */ }
}
function isShortYes(text) {
  const t = String(text || "").trim();
  if (!t || t.split(/\s+/).length > 8) return false;
  if (/meaning|matlab|मतलब|अर्थ|kya hai|kya hota/i.test(t)) return false;
  return VOCAB_CONFIRM_TRIGGER.test(t);
}

function describeNow() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "device time";
  const text = new Date().toLocaleString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  return `${text} (${tz})`;
}
function buildTimeLine() {
  return `Reader's current local date and time (from their device): ${describeNow()}. Use it for greetings and time-aware remarks.`;
}
function getContactEnvironment() {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const device = /Android/i.test(agent) ? "Android phone" : /iPhone|iPad/i.test(agent) ? "iPhone or iPad" : (typeof navigator === "undefined" ? "Mobile device" : navigator.platform || "Mobile device");
  const browser = /SamsungBrowser/i.test(agent) ? "Samsung Internet" : /Edg\//i.test(agent) ? "Microsoft Edge" : /Firefox\//i.test(agent) ? "Firefox" : /Chrome\//i.test(agent) ? "Chrome" : /Safari\//i.test(agent) ? "Safari" : "Mobile browser";
  return { device, browser, localTime: new Date().toLocaleString() };
}
function isChapterClosed(c) {
  return ["closed", "completed", "done", "finished"].includes(String(c?.status || "").trim().toLowerCase());
}

const BADGE_GRADIENTS = [
  ["#8B5CF6", "#6366F1"], ["#22D3EE", "#0EA5E9"], ["#F59E0B", "#EF4444"],
  ["#34D399", "#10B981"], ["#F472B6", "#EC4899"], ["#A78BFA", "#7C3AED"],
  ["#FACC15", "#EAB308"], ["#38BDF8", "#2563EB"], ["#FB7185", "#E11D48"], ["#2DD4BF", "#0D9488"],
];
function badgeGradient(seed) {
  const [a, b] = BADGE_GRADIENTS[seed % BADGE_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
function formatLastRead(iso) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase(),
  };
}

function describeTimeGap(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = diffMs / 60000;
  if (minutes < 1) return "moments ago";
  if (minutes < 60) { const m = Math.round(minutes); return `${m} minute${m === 1 ? "" : "s"} ago`; }
  const hours = minutes / 60;
  if (hours < 20) { const h = Math.round(hours); return `${h} hour${h === 1 ? "" : "s"} ago`; }
  const days = hours / 24;
  if (days < 1.5) return "yesterday";
  if (days < 7) { const d = Math.round(days); return `${d} days ago`; }
  const weeks = days / 7;
  if (weeks < 5) { const w = Math.round(weeks); return `${w} week${w === 1 ? "" : "s"} ago`; }
  const mo = Math.round(days / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}
const GEM_ART_STYLE_OPTIONS = [
  { id: "minimalist-lofi", label: "Lo-fi Ghibli", desc: "Soft flat illustration, warm & calm" },
  { id: "charcoal-sketch", label: "Charcoal Sketch", desc: "Hand-drawn pencil sketch" },
  { id: "cinematic-silhouette", label: "Cinematic Silhouette", desc: "Moody backlit, photo-style" },
  { id: "white-ink-sketch", label: "White Ink Sketch", desc: "White pen on black journal page" },
];

function gemPaletteIndex(gem) {
  const id = String(gem?.id || gem?.quote || gem?.bookId || "unassigned");
  let value = 0;
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value % BADGE_GRADIENTS.length;
}

function pickGemArtStyle(gem) {
  const haystack = `${gem?.bookTitle || ""} ${gem?.quote || ""}`.toLowerCase();
  let bestStyle = null;
  let bestScore = 0;
  let tie = false;
  for (const style of GEM_ART_STYLE_OPTIONS.map((o) => o.id)) {
    const keywordSets = {
      "cinematic-silhouette": /(discipline|willpower|sacrifice|solitude|leadership|courage|resilience|struggle|transform|monk|warrior|battle)/i,
      "charcoal-sketch": /(poetry|literature|philosophy|wisdom|intellect|metaphor|narrative|epiphany|paradox)/i,
      "white-ink-sketch": /(journal|diary|memoir|confession|handwritten|letter|notebook)/i,
      "minimalist-lofi": /(peace|calm|stillness|breathe|gentle|hope|dream|quiet|serenity|meditation|soft|grace)/i,
    };
    const matches = haystack.match(keywordSets[style]);
    const score = matches ? matches.length : 0;
    if (score > bestScore) { bestScore = score; bestStyle = style; tie = false; }
    else if (score > 0 && score === bestScore) tie = true;
  }
  if (bestStyle && !tie) return bestStyle;
  const styles = GEM_ART_STYLE_OPTIONS.map((o) => o.id);
  return styles[Math.abs(haystack.length) % styles.length];
}
function formatPageRange(chapter, { short = false } = {}) {
  const startPage = Number.isFinite(chapter?.startPage) ? chapter.startPage : null;
  const endPage = Number.isFinite(chapter?.endPage) ? chapter.endPage : null;

  if (startPage !== null && endPage !== null) {
    return short ? `Pg ${startPage} - ${endPage}` : `Pages ${startPage} - ${endPage}`;
  }
  if (startPage !== null) {
    return short ? `Pg ${startPage} - ?` : `Pg ${startPage} - ?`;
  }
  if (endPage !== null) {
    return short ? `Pg ? - ${endPage}` : `Pg ? - ${endPage}`;
  }
  return short ? "Pg —" : "Pg —";
}

function fallbackTranslationToHindi(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return "सही अर्थ अभी उपलब्ध नहीं है।";
  const lower = normalized.toLowerCase();
  if (lower.includes("weaker") || lower.includes("lower state") || lower.includes("reduced to")) return "कमज़ोर या निचली स्थिति में होना";
  if (lower.includes("physically sturdy") || lower.includes("large build") || lower.includes("well-fed")) return "स्वस्थ, मोटा और मजबूत शरीर वाला";
  if (lower.includes("shaking uncontrollably") || lower.includes("shivering")) return "बेहद काँपना, डर या ठंड से हिलना";
  if (lower.includes("a person") && lower.includes("trained")) return "एक व्यक्ति जो नियमों के अनुसार काम करने के लिए प्रशिक्षित है";
  if (lower.includes("acting in a very wild")) return "बहुत उग्र या अराजक तरीके से व्यवहार करना";
  return normalized;
}

function fallbackTranslationToOdia(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return "ସଠିକ୍ ଅର୍ଥ ବର୍ତ୍ତମାନ ଉପଲବ୍ଧ ନାହିଁ।";
  const lower = normalized.toLowerCase();
  if (lower.includes("weaker") || lower.includes("lower state") || lower.includes("reduced to")) return "କମଜୋର କିମ୍ବା ନିଚଳ ଅବସ୍ଥାରେ ରହିବା";
  if (lower.includes("physically sturdy") || lower.includes("large build") || lower.includes("well-fed")) return "ସ୍ୱାସ୍ଥ୍ୟମୟ, ମୋଟା ଏବଂ ମଜବୁତ ଶରୀର";
  if (lower.includes("shaking uncontrollably") || lower.includes("shivering")) return "ବହୁତ କମ୍ପନ, ଡର କିମ୍ବା ଶୀତଲତାରେ ହଲନା";
  if (lower.includes("a person") && lower.includes("trained")) return "ଏକ ଆଦେଶ ଅନୁସାରେ କାମ କରିବାକୁ ତିଆରି ଜନ";
  if (lower.includes("acting in a very wild")) return "ବହୁତ ଉଦ୍ଗ୍ରୀବ ଅଥବା ଅନ୍ୟାୟ କରିବା";
  return normalized;
}

function buildVocabMetadata(vocab) {
  const term = String(vocab?.term || "").trim();
  const contextMeaning = String(vocab?.contextMeaning || vocab?.meaning || "").trim();
  const generalMeaning = String(vocab?.meaning || contextMeaning || "").trim();
  const rawGrammar = String(vocab?.grammar || vocab?.partOfSpeech || "").trim();
  const grammar = rawGrammar || "Not specified";
  const pronunciation = String(vocab?.pronunciation || "").trim();
  const synonyms = Array.isArray(vocab?.synonyms) && vocab.synonyms.length ? vocab.synonyms : ["close meaning"];
  const antonyms = Array.isArray(vocab?.antonyms) && vocab.antonyms.length ? vocab.antonyms : ["opposite sense"];
  const example = String(vocab?.example || "").trim();
  const sentence = String(vocab?.sentence || "").trim();
  const hindiMeaning = String(vocab?.hindiMeaning || fallbackTranslationToHindi(contextMeaning || generalMeaning)).trim();
  const odiaMeaning = String(vocab?.odiaMeaning || fallbackTranslationToOdia(contextMeaning || generalMeaning)).trim();
  const hindiSentence = String(vocab?.hindiSentence || "").trim();
  const odiaSentence = String(vocab?.odiaSentence || "").trim();

  return {
    ...vocab,
    term,
    grammar,
    pronunciation,
    contextMeaning: contextMeaning || generalMeaning || `Meaning for "${term}" not captured yet.`,
    meaning: generalMeaning || contextMeaning || `Meaning for "${term}" not captured yet.`,
    synonyms,
    antonyms,
    example,
    sentence,
    hindiMeaning,
    odiaMeaning,
    hindiSentence,
    odiaSentence,
  };
}

function getChapterStatus(chapter, isCurrent, isLocked) {
  const normalizedStatus = String(chapter?.status || "").trim().toLowerCase();
  if (isChapterClosed(chapter)) return { label: "Completed", tone: "done" };
  if (isCurrent) return { label: "Current", tone: "current" };
  if (isLocked) return { label: "Not Started", tone: "idle" };
  if (["inprogress", "in-progress", "progress"].includes(normalizedStatus)) return { label: "In Progress", tone: "progress" };
  const hasProgress = chapter && (
    chapter.startPage !== null && chapter.startPage !== undefined ||
    chapter.endPage !== null && chapter.endPage !== undefined ||
    (Array.isArray(chapter.vocabLog) && chapter.vocabLog.length > 0) ||
    (chapter.summary && chapter.summary.trim()) ||
    Boolean(chapter.jumpNote)
  );
  if (hasProgress) return { label: "In Progress", tone: "progress" };
  return { label: "Not Started", tone: "idle" };
}

const AVATAR_PRESETS = [
  { Icon: BookOpen, gradient: badgeGradient(0) },
  { Icon: Moon, gradient: badgeGradient(1) },
  { Icon: Gem, gradient: badgeGradient(2) },
  { Icon: Brain, gradient: badgeGradient(3) },
  { Icon: Flame, gradient: badgeGradient(4) },
  { Icon: User, gradient: badgeGradient(5) },
];

function renderAvatar(size) {
  const avatar = profileStore.data.avatar;
  if (avatar) return <img src={avatar} alt="" className="avatar-img" />;
  const presetIdx = profileStore.data.avatarPreset;
  if (presetIdx !== null && presetIdx !== undefined && AVATAR_PRESETS[presetIdx]) {
    const { Icon, gradient } = AVATAR_PRESETS[presetIdx];
    return (
      <div className="avatar-preset-fill" style={{ background: gradient }}>
        <Icon size={size} color="#fff" />
      </div>
    );
  }
  return (
    <div className="avatar-preset-fill" style={{ background: AVATAR_PRESETS[5].gradient }}>
      <User size={size} color="#fff" />
    </div>
  );
}

function useMascotPreference() {
  const [mascot, setMascotState] = useState(getMascot());

  useEffect(() => {
    const handleChange = () => setMascotState(getMascot());
    window.addEventListener("app:mascot-changed", handleChange);
    return () => window.removeEventListener("app:mascot-changed", handleChange);
  }, []);

  return mascot;
}
function shrinkDataUrl(dataUrl, max = 320) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}
// ==================== ERROR BOUNDARY ====================
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("[APP] screen crashed", error); }
  render() {
    if (this.state.error) {
      return (
        <div className="screen crash-screen">
          <div className="aurora-bg" />
          <h2>Yeh screen khul nahi paayi</h2>
          <p className="crash-message">App mein chhoti si gadbad ho gayi. Aapka saved data safe hai. Home par jaakar dobara try kijiye.</p>
          <button className="primary-button" onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}>
            Go home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppCore() {
  const account = useAccount();
  useButtonHaptics();
  const [screen, setScreen] = useState("dashboard");
  const [activeBookId, setActiveBookId] = useState(null);
  const [activeChapterNumber, setActiveChapterNumber] = useState(null);
  const [recapModal, setRecapModal] = useState(null);
  const [newBookModalOpen, setNewBookModalOpen] = useState(false);
  const [storyRequest, setStoryRequest] = useState(null);
  const [dailyLimitOpen, setDailyLimitOpen] = useState(false);
  const [developerEmailRequest, setDeveloperEmailRequest] = useState(null);
  const [readingQuota, setReadingQuota] = useState(null);
  const [quotaError, setQuotaError] = useState("");
  const quotaRef = useRef(null);
  const pendingQuotaSecondsRef = useRef(0);
  const quotaFlushRef = useRef(false);
  const quotaFlushPromiseRef = useRef(null);
  const quotaPendingKeyRef = useRef("");
  const [resetKey, setResetKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => !profileStore.hasCompletedOnboarding());
  const [updateState, setUpdateState] = useState({ available: false, releases: [] });
  const updateActionsRef = useRef(null);
  const routeRef = useRef({ screen: "dashboard", activeBookId: null, activeChapterNumber: null });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", profileStore.getTheme());
  }, []);

  useEffect(() => {
    refreshPushSubscription(library);
  }, []);

  useEffect(() => {
    let cancelled = false;
    quotaPendingKeyRef.current = `rc_pending_reading_seconds_${account.user.id}`;
    try {
      pendingQuotaSecondsRef.current = Math.max(0, Math.floor(Number(localStorage.getItem(quotaPendingKeyRef.current)) || 0));
    } catch (error) {
      console.warn("[READING_LIMIT] Could not restore pending usage", error);
      pendingQuotaSecondsRef.current = 0;
    }
    fetchReadingQuota().then((quota) => {
      if (cancelled) return;
      if (pendingQuotaSecondsRef.current) {
        const pending = Math.min(pendingQuotaSecondsRef.current, quota.remainingSeconds);
        quota.usedSeconds += pending;
        quota.remainingSeconds -= pending;
      }
      quotaRef.current = quota;
      setReadingQuota(quota);
      setQuotaError("");
      if (pendingQuotaSecondsRef.current) void flushReadingUsage();
    }).catch((error) => {
      if (cancelled) return;
      console.error("[READING_LIMIT] Could not load account limit", error);
      setQuotaError(error.message || "Your account reading limit is unavailable.");
    });
    return () => { cancelled = true; };
  }, [account.user.id]);

  async function refreshReadingQuota() {
    const quota = await fetchReadingQuota();
    quotaRef.current = quota;
    setReadingQuota(quota);
    setQuotaError("");
    return quota;
  }

  async function flushReadingUsage() {
    if (quotaFlushRef.current) {
      await quotaFlushPromiseRef.current;
      if (pendingQuotaSecondsRef.current >= 10) return flushReadingUsage();
      return;
    }
    if (pendingQuotaSecondsRef.current <= 0) return;
    const seconds = Math.min(60, pendingQuotaSecondsRef.current);
    pendingQuotaSecondsRef.current -= seconds;
    persistPendingQuotaSeconds();
    quotaFlushRef.current = true;
    quotaFlushPromiseRef.current = recordReadingUsage(seconds, profileStore.data.name);
    try {
      const quota = await quotaFlushPromiseRef.current;
      const pending = Math.min(pendingQuotaSecondsRef.current, quota.remainingSeconds);
      quota.usedSeconds += pending;
      quota.remainingSeconds -= pending;
      quotaRef.current = quota;
      setReadingQuota(quota);
      setQuotaError("");
    } catch (error) {
      pendingQuotaSecondsRef.current += seconds;
      persistPendingQuotaSeconds();
      console.error("[READING_LIMIT] Could not record active session time", error);
      setQuotaError(error.message || "Reading time could not be saved to your account.");
    } finally {
      quotaFlushRef.current = false;
      quotaFlushPromiseRef.current = null;
    }
    if (pendingQuotaSecondsRef.current >= 10) return flushReadingUsage();
  }

  function recordActiveReadingSeconds(seconds) {
    const current = quotaRef.current;
    if (!current) return 0;
    const increment = Math.max(0, Math.floor(Number(seconds) || 0));
    const limitSeconds = current.dailyLimitMinutes * 60;
    const next = {
      ...current,
      usedSeconds: Math.min(limitSeconds, current.usedSeconds + increment),
      remainingSeconds: Math.max(0, current.remainingSeconds - increment),
    };
    quotaRef.current = next;
    setReadingQuota(next);
    pendingQuotaSecondsRef.current += increment;
    persistPendingQuotaSeconds();
    if (pendingQuotaSecondsRef.current >= 10 || next.remainingSeconds <= 0) void flushReadingUsage();
    return next.remainingSeconds;
  }

  function persistPendingQuotaSeconds() {
    if (!quotaPendingKeyRef.current) return;
    try {
      if (pendingQuotaSecondsRef.current > 0) localStorage.setItem(quotaPendingKeyRef.current, String(pendingQuotaSecondsRef.current));
      else localStorage.removeItem(quotaPendingKeyRef.current);
    } catch (error) {
      console.warn("[READING_LIMIT] Could not persist pending usage", error);
    }
  }

  // Tapping a report-status notification opens the app on Your Reports.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("open") !== "reports") return;
    try { sessionStorage.setItem("rc-open-reports", "1"); } catch { /* storage unavailable */ }
    params.delete("open");
    const query = params.toString();
    window.history.replaceState({ screen: "dashboard" }, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
    navigateTo("report");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    configureBackStack({ routeState: () => routeRef.current });
    window.history.replaceState({ screen: "dashboard" }, "");
    const onPopState = (e) => {
      if (handleBackStackPop()) return;
      const state = e.state || { screen: "dashboard" };
      if (state.screen === "session" && (quotaRef.current?.remainingSeconds ?? 0) <= 0) {
        setScreen("dashboard");
        setActiveBookId(null);
        setActiveChapterNumber(null);
        routeRef.current = { screen: "dashboard", activeBookId: null, activeChapterNumber: null };
        setDailyLimitOpen(true);
        return;
      }
      routeRef.current = state;
      setScreen(state.screen);
      setActiveBookId(state.activeBookId ?? null);
      setActiveChapterNumber(state.activeChapterNumber ?? null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useBackLayer(newBookModalOpen, () => setNewBookModalOpen(false));
  useBackLayer(!!recapModal, () => setRecapModal(null));
  useBackLayer(!!storyRequest, () => setStoryRequest(null));

  function navigateTo(nextScreen, extra = {}) {
    clearLayers();
    if (nextScreen === "session") {
      if (!quotaRef.current) {
        notify(quotaError || "Checking your account reading limit. Please try again shortly.", "error");
        return;
      }
      if (quotaRef.current.remainingSeconds <= 0) {
        setDailyLimitOpen(true);
        return;
      }
    }
    const nextBookId = "activeBookId" in extra ? extra.activeBookId : activeBookId;
    const nextChapterNumber = "activeChapterNumber" in extra ? extra.activeChapterNumber : activeChapterNumber;
    setScreen(nextScreen);
    setActiveBookId(nextBookId);
    setActiveChapterNumber(nextChapterNumber);
    const nextRoute = { screen: nextScreen, activeBookId: nextBookId, activeChapterNumber: nextChapterNumber };
    routeRef.current = nextRoute;
    pushRoute(nextRoute);
  }

  function openNewBook() {
    setNewBookModalOpen(true);
  }
  async function handleDailyLimit() {
    await flushReadingUsage();
    setDailyLimitOpen(true);
    navigateTo("dashboard");
  }

  function openRecap(bookId) {
    const book = library.getBook(bookId);
    if (!book) return;
    setRecapModal({ bookId, chapterNumber: book.currentChapterNumber });
  }
  function startSessionFromRecap() {
    if (!recapModal) return;
    const bookId = recapModal.bookId;
    setRecapModal(null);
    navigateTo("session", { activeBookId: bookId });
  }
  function restartReadingSession(bookId) {
    navigateTo("dashboard");
    window.setTimeout(() => navigateTo("session", { activeBookId: bookId }), 80);
  }
  function openStoryFromRecap(bookId) {
    setRecapModal(null);
    openStory(bookId);
  }
  function openStory(bookId) {
    const book = library.getBook(bookId);
    if (!book) return;
    setStoryRequest({ bookId });
  }
  function finishStory(startSession = false) {
    if (!storyRequest) return;
    const bookId = storyRequest.bookId;
    setStoryRequest(null);
    if (startSession) navigateTo("session", { activeBookId: bookId });
  }
  function closeStory() {
    setStoryRequest(null);
  }
  function findExistingBook(title) {
    const wanted = title.trim().toLowerCase();
    return library.listBooks().find((b) => b.title.trim().toLowerCase() === wanted) || null;
  }
  async function createBookFromSearch({ title, displayTitle, authorName, coverUrl, isbn, portrait, bio, chapters }) {
    const book = library.getOrCreateBook(title);
    const authors = String(authorName || "").split(/\s*(?:,|&| and )\s*/i).filter(Boolean);
    const small = portrait ? await shrinkDataUrl(portrait) : "";
    library.updateBookMeta(book.id, {
      displayTitle: displayTitle || title,
      isbn: isbn || "",
      authorName: authorName || "",
      authorBio: bio || "",
      coverUrl: coverUrl || "",
      ...(small ? { authorPortrait: small, authorPortraits: [{ name: authors[0] || authorName, dataUrl: small, sourceUrl: null }] } : {}),
    });
    library.setChapterOutline(book.id, chapters.map((chapter) => ({
      chapterNumber: chapter.number, title: chapter.title, startPage: chapter.startPage,
      section: chapter.section, author: chapter.author, confidence: chapter.confidence,
    })));
    setNewBookModalOpen(false);
    notify(`"${title}" added with ${chapters.length} chapters.`, "success");
    if (screen !== "library") navigateTo("library");
    if (!small && authors.length) {
      try {
        const res = await fetch(apiUrl("/api/author-portrait"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorName, bookTitle: title }),
        });
        const data = await res.json();
        if (res.ok && (data?.portraits || []).some((p) => p.dataUrl)) {
          const list = await Promise.all(data.portraits.map(async (p) => ({ name: p.name, dataUrl: p.dataUrl ? await shrinkDataUrl(p.dataUrl) : null })));
          library.updateBookMeta(book.id, { authorPortrait: list.find((p) => p.dataUrl)?.dataUrl || "", authorPortraits: list });
        }
      } catch {
        // portrait stays optional; the author can add one from the Library
      }
    }
  }
  async function createManualBook({ title, authorName, authorType, authorBio, portrait, chapters }) {
    const book = library.getOrCreateBook(title);
    const small = portrait ? await shrinkDataUrl(portrait) : "";
    library.updateBookMeta(book.id, {
      authorName: authorName || "",
      authorType,
      authorBio: authorBio || "",
      ...(small ? { authorPortrait: small, authorPortraits: [{ name: authorName || "", dataUrl: small, sourceUrl: null }] } : {}),
    });
    library.setChapterOutline(book.id, chapters.map((chapter) => ({
      chapterNumber: chapter.number, title: chapter.title, startPage: chapter.startPage,
      section: chapter.section, author: chapter.author, confidence: chapter.confidence,
    })));
    setNewBookModalOpen(false);
    notify(`"${title}" added with ${chapters.length} chapters.`, "success");
    if (screen !== "library") navigateTo("library");
  }
  function goBack() {
    popRoute();
  }

  const badges = computeBadges({ updateAvailable: updateState.available });

  const nav = {
    userId: account.user.id,
    readerName: profileStore.data.name,
    accountEmail: account.user.email || "Google account",
    accountSyncStatus: account.syncStatus,
    signOut: account.signOut,
    syncAccountNow: account.syncNow,
    deleteAccountData: account.deleteAccountData,
    badges,
    goDashboard: () => navigateTo("dashboard"),
    goLibrary: () => navigateTo("library"),
    goGems: () => navigateTo("gems"),
    goMemory: () => navigateTo("memory"),
    goProfile: () => navigateTo("profile"),
    goReaderRanking: () => navigateTo("reader-ranking"),
    goAccount: () => navigateTo("account"),
    goSettings: () => navigateTo("settings"),
    goAbout: () => navigateTo("about"),
    goDocs: () => navigateTo("docs"),
    openDeveloperEmail: (kind, context = {}) => setDeveloperEmailRequest({ kind, context }),
    goReport: () => navigateTo("report"),
    goHelp: () => navigateTo("help"),
    openNewBook,
    updateAvailable: updateState.available,
    updateReleases: updateState.releases,
    readingQuota,
    quotaError,
    refreshReadingQuota,
    checkForUpdates: () => updateActionsRef.current?.checkForUpdates?.() || false,
    applyUpdate: () => updateActionsRef.current?.applyUpdate?.(),
    openChapterGrid: (bookId) => navigateTo("chapterGrid", { activeBookId: bookId }),
    openChapterDetail: (bookId, chapterNumber) => navigateTo("chapterDetail", { activeBookId: bookId, activeChapterNumber: chapterNumber }),
    openRecap,
    openStory,
    goBack,
  };

  return (
    <ErrorBoundary key={resetKey} onReset={() => { setResetKey((k) => k + 1); navigateTo("dashboard"); }}>
      {screen === "session" ? (
        <SessionScreen
          bookId={activeBookId}
          onEnd={async () => { await flushReadingUsage(); nav.goBack(); }}
          onRestart={() => restartReadingSession(activeBookId)}
          onUsageSecond={recordActiveReadingSeconds}
          onDailyLimit={handleDailyLimit}
        />
      ) : (
        <div className="app-shell">
          <div className="app-content">
            {screen === "dashboard" && <DashboardScreen nav={nav} />}
            {screen === "library" && <LibraryScreen nav={nav} />}
            {screen === "chapterGrid" && <ChapterGridScreen bookId={activeBookId} nav={nav} />}
            {screen === "chapterDetail" && <ChapterDetailScreen bookId={activeBookId} chapterNumber={activeChapterNumber} nav={nav} />}
            {screen === "gems" && <GemsScreen nav={nav} />}
            {/* {screen === "memory" && <MemoryScreen nav={nav} />} */}
            {screen === "memory" && <MemoryTab nav={nav} />}
            {screen === "profile" && <ProfileScreen nav={nav} />}
            {screen === "reader-ranking" && <Suspense fallback={<div role="status" className="pr-state">Opening Reader Arena…</div>}><ReaderArena onBack={nav.goBack} onLibrary={nav.goLibrary} /></Suspense>}
            {screen === "account" && <AccountScreen nav={nav} />}
                        {screen === "settings" && <SettingsScreen nav={nav} stores={{ profile: profileStore, library, memory: memoryStore, gems: gemsStore }} />}
            {screen === "about" && <AboutScreen nav={nav} />}
            {screen === "docs" && <Suspense fallback={<div role="status" style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--muted)" }}>Opening docs…</div>}><DocsScreen nav={nav} /></Suspense>}
            {screen === "report" && <ReportScreen nav={nav} stores={{ profile: profileStore }} />}
            {screen === "help" && <HelpGuideScreen nav={nav} userName={profileStore.data.name === "Reader" ? "there" : profileStore.data.name} />}
          </div>
          {screen === "dashboard" && <PushPrompt library={library} />}
          {screen !== "help" && screen !== "docs" && <BottomNav active={["account", "settings", "about", "report", "reader-ranking"].includes(screen) ? "profile" : screen} onNavigate={(id) => navigateTo(id)} badges={badges} />}
        </div>
      )}

      {recapModal && (
        <PreSessionRecapModal
          book={library.getBook(recapModal.bookId)}
          chapterNumber={recapModal.chapterNumber}
          onStart={startSessionFromRecap}
          onStory={() => openStoryFromRecap(recapModal.bookId)}
          onClose={() => setRecapModal(null)}
        />
      )}
      {newBookModalOpen && <NewBookModal onCreateManual={createManualBook} onCreateFromSearch={createBookFromSearch} findExisting={findExistingBook} onClose={() => setNewBookModalOpen(false)} />}
      <UpdateManager
        paused={screen === "session" || showOnboarding}
        onUpdateState={setUpdateState}
        actionsRef={updateActionsRef}
      />
      <UpdateAnnouncement
        available={updateState.available}
        releases={updateState.releases}
        paused={screen === "session" || showOnboarding}
        onUpdate={nav.applyUpdate}
      />
      <NotificationHost />
      {developerEmailRequest && (
        <DeveloperEmailSheet
          request={developerEmailRequest}
          user={{ id: account.user.id, email: account.user.email, displayName: profileStore.data.name }}
          context={{
            dailyLimitMinutes: readingQuota?.dailyLimitMinutes,
            minutesUsedToday: Number.isFinite(readingQuota?.usedSeconds) ? Math.round(readingQuota.usedSeconds / 6) / 10 : undefined,
            ...getContactEnvironment(),
          }}
          onClose={() => setDeveloperEmailRequest(null)}
        />
      )}
      <AnimatePresence>
        {dailyLimitOpen && (
          <Motion.div className="modal-overlay" role="presentation" onClick={() => setDailyLimitOpen(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Motion.section
              role="dialog" aria-modal="true" aria-labelledby="daily-limit-title"
              className="daily-limit-card"
              onClick={(event) => event.stopPropagation()}
              initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
            >
              <div className="daily-limit-icon"><Clock size={24} /></div>
              <p className="eyebrow">A little more tomorrow</p>
              <h2 id="daily-limit-title">You’ve reached today’s reading limit</h2>
              <p>Your {readingQuota?.dailyLimitMinutes ?? 30}-minute allowance is used for today. Your books and progress are saved safely. Contact the developer to request more reading time.</p>
              <button type="button" className="primary-button daily-limit-contact" onClick={() => nav.openDeveloperEmail("limit_increase", {
                request: "I have reached my daily reading limit and would like to request an increase.",
              })}>
                <Mail size={17} /> Contact Developer
              </button>
              <button type="button" className="daily-limit-close" onClick={() => setDailyLimitOpen(false)}>I’ll come back tomorrow</button>
            </Motion.section>
          </Motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {storyRequest && (
          <StoryTheatre
            key={`${storyRequest.bookId}-${library.getBook(storyRequest.bookId)?.currentChapterNumber}`}
            bookId={storyRequest.bookId}
            book={library.getBook(storyRequest.bookId)}
            voiceName={profileStore.data.voice || "Leda"}
            onClose={() => closeStory(false)}
            onRead={() => finishStory(true)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showOnboarding && (
          <Onboarding
            key="onboarding"
            initialName={profileStore.data.name === "Reader" ? "" : profileStore.data.name}
            voiceName={profileStore.data.voice || "Leda"}
            onFinish={(data) => {
              profileStore.completeOnboarding(data);
              setShowOnboarding(false);
              setScreen("dashboard");
            }}
          />
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <>
      <NetworkOfflineCurtain />
      <AccountGate><AppCore /></AccountGate>
    </>
  );
}

// ==================== SHARED STICKY HEADER ====================
function ScreenHeader({ title, subtitle, right }) {
  return (
    <header className="screen-header">
      <div className="header-left">
        <h1>{title}</h1>
        {subtitle && <p className="eyebrow">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

// ==================== GLOBAL TOASTS ====================

function NetworkOfflineCurtain() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const setOnlineState = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", setOnlineState);
    setOnlineState();
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", setOnlineState);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <Motion.div className="network-offline-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="network-offline-title" aria-describedby="network-offline-copy"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Motion.section className="network-offline-card"
            initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 230, damping: 22 }}>
            <div className="network-offline-signal" aria-hidden="true">
              <span className="network-offline-ring ring-one" />
              <span className="network-offline-ring ring-two" />
              <span className="network-offline-icon"><WifiOff size={34} strokeWidth={1.8} /></span>
            </div>
            <div className="network-offline-eyebrow">CONNECTION LOST</div>
            <h2 id="network-offline-title">Internet access is off</h2>
            <p id="network-offline-copy">Reconnect to continue reading with your companion.</p>
            <div className="network-offline-status"><i /><span>Waiting for connection</span><span className="network-offline-dots">...</span></div>
          </Motion.section>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}

function NotificationHost() {
  const [items, setItems] = useState([]);
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    const onNotify = (e) => {
      const t = e.detail;
      if (!t?.text) return;
      setItems((list) => [...list.slice(-2), t]);
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), t.ms || 4200);
    };
    const onNotice = (e) => {
      const notice = e.detail;
      if (!notice?.message) return;
      setNotices((current) => [...current.filter((item) => item.code !== notice.code), notice]);
    };
    const onDismiss = (e) => setNotices((current) => current.filter((item) => item.id !== e.detail?.id));
    window.addEventListener("app:notify", onNotify);
    window.addEventListener("app:notice", onNotice);
    window.addEventListener("app:notice-dismiss", onDismiss);
    return () => {
      window.removeEventListener("app:notify", onNotify);
      window.removeEventListener("app:notice", onNotice);
      window.removeEventListener("app:notice-dismiss", onDismiss);
    };
  }, []);
  const ICONS = { info: Info, error: AlertTriangle, success: Check };
  return createPortal(
    <>
      <div className="notice-host" role="status" aria-live="assertive">
        <AnimatePresence>
          {notices.map((notice) => (
            <Motion.div key={notice.id} className={`notice-banner ${notice.level || "error"}`} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={INTERACTION_SPRING}>
              <div className="notice-banner-copy"><b>{notice.title}</b><span>{notice.message}</span></div>
              {notice.action && <button type="button" className="notice-action" onClick={notice.action.onClick}>{notice.action.label}</button>}
              <button type="button" className="notice-dismiss" aria-label="Dismiss" onClick={() => dismissNotice(notice.id)}>×</button>
            </Motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="toast-host" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => {
            const IconC = ICONS[t.kind] || Info;
            return (
              <Motion.div key={t.id} className={`toast-item ${t.kind}`}
                initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={INTERACTION_SPRING}>
                <IconC size={15} /><span>{t.text}</span>
              </Motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>,
    document.body
  );
}

// ==================== CONFIRM MODAL ====================

function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return createPortal(
    <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={INTERACTION_SPRING} onClick={onCancel}>
      <Motion.div className="modal-card elevated confirm-card" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={INTERACTION_SPRING} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button className="icon-button ghost" onClick={onCancel}>Cancel</button>
          <button className="danger-button" onClick={onConfirm}><Trash2 size={14} /> Delete</button>
        </div>
      </Motion.div>
    </Motion.div>,
    document.body
  );
}

// ==================== BOTTOM NAV ====================

function BottomNav({ active, onNavigate, badges = {} }) {
  const { triggerLightTap } = useHaptic();
  const navRef = useRef(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const updateHeight = () => document.documentElement.style.setProperty("--bottom-nav-h", `${nav.getBoundingClientRect().height}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);
  const items = [
    { id: "dashboard", Icon: Home, label: "Home" },
    { id: "library", Icon: LibraryIcon, label: "Library" },
    { id: "gems", Icon: Gem, label: "Gems" },
    { id: "memory", Icon: Brain, label: "Memory" },
  ];
  return (
    <div className="bottom-nav-shell">
      <nav ref={navRef} className="bottom-nav elevated">
        {items.map(({ id, Icon, label }) => (
          <Motion.button key={id} className={`nav-item ${active === id ? "active" : ""}`} whileTap={{ scale: 0.9 }} transition={INTERACTION_SPRING} onClick={() => { triggerLightTap(); onNavigate(id); }}>
            <span className="nav-icon-box"><Icon size={28} strokeWidth={active === id ? 2.4 : 1.8} /></span>
            <span className="nav-label">{label}</span>
          </Motion.button>
        ))}
        <Motion.button className={`nav-item ${active === "profile" ? "active" : ""}`} whileTap={{ scale: 0.9 }} transition={INTERACTION_SPRING} onClick={() => { triggerLightTap(); onNavigate("profile"); }}>
          <span className="nav-icon-box">
            <span className="nav-avatar">{renderAvatar(22)}</span>
            {badges.profile > 0 && <span className="rc-badge" aria-label={`${badges.profile} pending`}>{badges.profile}</span>}
          </span>
          <span className="nav-label">Profile</span>
        </Motion.button>
      </nav>
    </div>
  );
}

// ==================== NEW BOOK MODAL ====================

function NewBookModal({ onCreateManual, onCreateFromSearch, findExisting, onClose }) {
  const [view, setView] = useState("choose");
  const [title, setTitle] = useState("");

  function toManual(prefill, reason) {
    if (prefill) setTitle(prefill);
    if (reason === "notfound") notify("That book wasn't found in the public catalogue. You can add it manually.", "info", 5200);
    setView("manual");
  }

  return (
    <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={INTERACTION_SPRING} onClick={onClose}>
      <Motion.div className={`modal-card elevated${view === "search" ? " bsf-card" : ""}`} initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={INTERACTION_SPRING} onClick={(e) => e.stopPropagation()}>
        {view === "choose" && (
          <>
            <h2>Add a book</h2>
            <div className="nb-choose">
              <button type="button" className="nb-choice" onClick={() => setView("search")}>
                <span className="nb-choice-ico"><Search size={20} /></span>
                <span><b>Search a book</b><small>Find it by title. Author and chapters are filled in for you.</small></span>
              </button>
              <button type="button" className="nb-choice plain" onClick={() => setView("manual")}>
                <span className="nb-choice-ico"><Pencil size={20} /></span>
                <span><b>Add manually</b><small>Type the title and add details as you read.</small></span>
              </button>
            </div>
            <div className="modal-actions"><button className="icon-button ghost" onClick={onClose}>Cancel</button></div>
          </>
        )}
        {view === "search" && (
          <BookSearchFlow initialTitle={title} findExisting={findExisting} onSave={onCreateFromSearch} onManual={toManual} onClose={onClose} />
        )}
        {view === "manual" && (
          <BookSearchFlow mode="manual" initialTitle={title} findExisting={findExisting} onManualSave={onCreateManual} onClose={onClose} />
        )}
      </Motion.div>
    </Motion.div>
  );
}
// ==================== PRE-SESSION RECAP MODAL ====================

function PreSessionRecapModal({ book, chapterNumber, onStart, onStory, onClose }) {
  if (!book) return null;
  const chapter = book.chapters[chapterNumber];
  const storySource = resolveStorySource(book);
  const pageRange = chapter?.startPage
    ? chapter.endPage ? `Pages ${chapter.startPage}–${chapter.endPage}` : `From page ${chapter.startPage}`
    : null;
  return (
    <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={INTERACTION_SPRING} onClick={onClose}>
      <Motion.div className="modal-card elevated recap-card" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={INTERACTION_SPRING} onClick={(e) => e.stopPropagation()}>
        <div className="recap-label">Last time</div>
        <h2>{book.title}</h2>
        <div className="recap-chapter">
          Chapter {chapterNumber}{chapter?.title && chapter.title !== `Chapter ${chapterNumber}` ? ` · ${chapter.title}` : ""}
          {pageRange ? ` · ${pageRange}` : ""}
        </div>
        <p className="recap-summary">{chapter?.summary || "No summary yet for this chapter - you'll start fresh."}</p>
        <div className="modal-actions">
          <button className="icon-button ghost" onClick={onClose}>Skip</button>
          {storySource.mode !== "empty" && <button className="icon-button ghost" onClick={onStory}><Play size={14} /> Hear the story</button>}
          <button className="primary-button" onClick={onStart}><Play size={14} /> Start Reading</button>
        </div>
      </Motion.div>
    </Motion.div>
  );
}

// ==================== DASHBOARD ====================

function getGreeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night";
}
function bucketByDay(timestamps, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    out.push({ key: d.toDateString(), label: d.toLocaleDateString(undefined, { weekday: "short" }), short: d.getDate(), mon: d.toLocaleDateString(undefined, { month: "short" }), count: 0 });
  }
  const idx = new Map(out.map((o, i) => [o.key, i]));
  timestamps.forEach((t) => { const k = new Date(t).toDateString(); if (idx.has(k)) out[idx.get(k)].count += 1; });
  return out;
}
function allVocabTimestamps() {
  const ts = [];
  library.listBooks().forEach((b) => Object.values(b.chapters).forEach((c) => (c.vocabLog || []).forEach((v) => v.timestamp && ts.push(v.timestamp))));
  return ts;
}
function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
function useReady(delay = 200) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), delay); return () => clearTimeout(t); }, [delay]);
  return ready;
}
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }
  return d;
}

function StreakHero() {
  const streak = profileStore.getStreak();
  const days = profileStore.getLast7Days();
  const ready = useReady(150);
  const shown = useCountUp(streak, 1100);
  const R = 46, C = 2 * Math.PI * R;
  const pct = Math.min(streak / 7, 1);
  const left = 7 - streak;
  return (
    <div className="streak-hero elevated dash-card" style={{ "--i": 0 }}>
      <div className="sh-glow" />
      <div className={`sh-corner ${streak > 0 ? "lit" : ""}`} aria-hidden="true">
        <span className="sh-corner-halo" />
        <svg viewBox="0 0 24 24" className="sh-corner-flame">
          <defs>
            <linearGradient id="shFlameOuter" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ef4444" /><stop offset="0.6" stopColor="#f97316" /><stop offset="1" stopColor="#fbbf24" /></linearGradient>
          </defs>
          <path d="M12 1.5c.6 3.2-1.6 5-3.4 7.4C6.9 11 6 12.6 6 14.8a6 6 0 0 0 12 0c0-2.4-1-4-2.4-5.6-.3 1.6-1 2.6-2 3 .8-3.8.3-7.5-1.6-10.7z" fill="url(#shFlameOuter)" />
          <path className="sh-corner-core" d="M12 22a3.6 3.6 0 0 1-3.6-3.6c0-1.8 1.2-2.8 2.1-4.2.4 1 1 1.5 1.5 1.6.2-1.4 1-2.4 1.6-3.2.9 1.2 2 2.4 2 5.8A3.6 3.6 0 0 1 12 22z" fill="#fde68a" />
        </svg>
        <i /><i /><i />
      </div>
      <div className="sh-top">
        <div className="sh-ring">
          <span className="sh-pulse" aria-hidden="true" />
          {streak > 0 && (
            <span className="sh-sparks" aria-hidden="true"><i /><i /><i /><i /></span>
          )}
          <svg viewBox="0 0 108 108">
            <defs>
              <linearGradient id="streakGradBig" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f59e0b" /><stop offset="55%" stopColor="#ef4444" /><stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <circle cx="54" cy="54" r={R} className="sh-track" />
            <circle cx="54" cy="54" r={R} className="sh-prog" stroke="url(#streakGradBig)" strokeDasharray={C} strokeDashoffset={ready ? C * (1 - pct) : C} />
          </svg>
          <div className="sh-center">
            <Flame className="sh-flame" size={24} />
            <span className="sh-count">{shown}</span>
          </div>
        </div>
        <div className="sh-info">
          <div className="sh-headline">{streak > 0 ? `${streak}-day streak` : "Start your streak"}</div>
          <div className="sh-sub">{streak >= 7 ? "Weekly goal complete. Legend!" : streak === 0 ? "Read today to light the flame" : `${left} more day${left === 1 ? "" : "s"} to a 7-day streak`}</div>
        </div>
      </div>
      <div className="sh-days">
        {days.map((d, i) => (
          <span key={i} style={{ "--d": i }} className={`sh-day ${d.active ? "active" : ""} ${d.isToday ? "today" : ""}`}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

const KPI_TONES = {
  books: ["#8b5cf6", "#6366f1"],
  words: ["#22d3ee", "#3b82f6"],
  week: ["#f59e0b", "#ef4444"],
  gems: ["#ec4899", "#8b5cf6"],
};
const KPI_SPINES = ["#8b5cf6", "#22d3ee", "#f59e0b", "#ec4899", "#6366f1", "#34d399"];
const KPI_SPINE_HEIGHTS = [26, 34, 22, 38, 30, 24];
const KPI_LETTERS = [["A", 6, 0], ["अ", 24, 0.9], ["W", 42, 1.7], ["ଅ", 60, 0.5], ["a", 14, 2.3], ["क", 52, 1.2]];

function KpiArt({ kind, value, series }) {
  if (kind === "books") {
    const shown = Math.min(Math.max(value, 1), 6);
    return (
      <svg className="kpi-art" viewBox="0 0 84 52" aria-hidden="true">
        <line x1="2" y1="48" x2="82" y2="48" className="kpi-shelf" />
        {KPI_SPINE_HEIGHTS.map((h, i) => (
          <rect key={i} x={6 + i * 13} y={48 - h} width="10" height={h} rx="2" className={`kpi-spine ${i < shown ? "on" : ""}`} style={{ "--d": `${i * 110}ms`, fill: KPI_SPINES[i] }} />
        ))}
      </svg>
    );
  }
  if (kind === "words") {
    return (
      <div className="kpi-art kpi-letters" aria-hidden="true">
        {KPI_LETTERS.map(([ch, left, delay]) => <span key={ch} style={{ left, animationDelay: `${delay}s` }}>{ch}</span>)}
      </div>
    );
  }
  if (kind === "week") {
    const W = 84, H = 44, max = Math.max(...series, 1);
    const pts = series.map((n, i) => ({ x: 4 + (i * (W - 8)) / Math.max(1, series.length - 1), y: H - 6 - (n / max) * (H - 16) }));
    const line = smoothPath(pts);
    const last = pts[pts.length - 1];
    return (
      <svg className="kpi-art" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path d={`${line} L${last.x},${H - 2} L${pts[0].x},${H - 2} Z`} className="kpi-area" />
        <path d={line} pathLength="1" className="kpi-line" />
        <circle cx={last.x} cy={last.y} r="3" className="kpi-dot" />
        <circle cx={last.x} cy={last.y} r="3" className="kpi-dot-ring" />
      </svg>
    );
  }
  return (
    <div className="kpi-art kpi-gem" aria-hidden="true">
      <div className="kpi-gem-spin">
        <svg viewBox="0 0 48 44">
          <defs>
            <linearGradient id="kpiGemFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f9a8d4" /><stop offset="0.55" stopColor="#ec4899" /><stop offset="1" stopColor="#7c3aed" /></linearGradient>
          </defs>
          <polygon points="12,4 36,4 46,16 24,42 2,16" fill="url(#kpiGemFill)" />
          <path d="M2 16 H46 M12 4 L18 16 L24 42 L30 16 L36 4" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1" strokeLinejoin="round" />
          <polyline points="18,16 24,4 30,16" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      </div>
      <i className="kpi-spark s1" /><i className="kpi-spark s2" /><i className="kpi-spark s3" />
    </div>
  );
}

function KpiTile({ kind, icon, label, value, delta, series = [], index }) {
  const shown = useCountUp(value);
  const [burst, setBurst] = useState(0);
  const { triggerLightTap } = useHaptic();
  const [c1, c2] = KPI_TONES[kind];
  return (
    <Motion.button
      type="button"
      className={`kpi-tile kpi2 ${kind}`}
      style={{ "--k1": c1, "--k2": c2, "--i": index }}
      whileTap={{ scale: 0.96 }}
      transition={INTERACTION_SPRING}
      onClick={() => { triggerLightTap(); setBurst((b) => b + 1); }}
      aria-label={`${label}: ${value}`}
    >
      <span className="kpi-shine" aria-hidden="true" />
      <div key={burst} className={`kpi-art-wrap ${burst ? "pop" : ""}`}><KpiArt kind={kind} value={value} series={series} /></div>
      <div className="stat-badge">{icon}</div>
      <div className="kpi-bottom">
        <div className="kpi-value">{shown}</div>
        {delta !== undefined && (
          <span className={`kpi-delta ${delta >= 0 ? "up" : "down"}`}>
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(delta)}
          </span>
        )}
      </div>
      <div className="kpi-label">{label}</div>
    </Motion.button>
  );
}

function WeeklyRecallCard({ books }) {
  const [, refresh] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const now = APP_STARTED_AT;
  const due = now ? books.flatMap((book) => Object.values(book.chapters || {}).flatMap((chapter) =>
    (chapter.vocabLog || []).map((entry) => ({ entry, bookId: book.id, bookTitle: book.title, chapterNumber: chapter.number }))
  )).filter(({ entry }) => {
    const savedAt = new Date(entry.timestamp || 0).getTime();
    const lastRecall = new Date(entry.lastRecallAt || 0).getTime();
    return savedAt && now - savedAt >= 24 * 60 * 60 * 1000
      && (Number(entry.recallSuccesses) || 0) < 2
      && (!lastRecall || now - lastRecall >= 5 * 24 * 60 * 60 * 1000);
  }).sort((a, b) => {
    const everyday = Number(b.entry.usageRegister === "everyday") - Number(a.entry.usageRegister === "everyday");
    return everyday || new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime();
  }).slice(0, 3) : [];
  if (!due.length || dismissed) return null;
  const current = due[0];
  const remember = (recalled) => {
    library.markVocabularyRecall(current.bookId, current.chapterNumber, current.entry.term, recalled);
    setRevealed(false);
    refresh((value) => value + 1);
  };
  return (
    <Motion.section className="recall-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={INTERACTION_SPRING}>
      <div className="recall-head"><span><Sparkles size={14} /> Revisit these</span><button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss recall card"><XIcon size={14} /></button></div>
      <div className="recall-meta">{current.bookTitle}{Number.isFinite(Number(current.chapterNumber)) ? ` · Chapter ${current.chapterNumber}` : ""}</div>
      <h3>{current.entry.term}</h3>
      {revealed && <p className="recall-meaning">{current.entry.contextMeaning || current.entry.meaning || "Is word ka meaning abhi saved nahi hai."}</p>}
      <div className="recall-actions">
        <button type="button" className="recall-primary" onClick={() => remember(true)}><Check size={14} /> Yaad tha</button>
        <button type="button" className="recall-secondary" onClick={() => revealed ? remember(false) : setRevealed(true)}>{revealed ? "Agli baar" : "Hint dekhein"}</button>
      </div>
      <p className="recall-soft">Bas ek chhota reminder, koi test nahi.</p>
    </Motion.section>
  );
}

function VocabAreaChart({ data }) {
  const [active, setActive] = useState(null);
  const W = 320, H = 160, padX = 10, padTop = 26, padBottom = 22;
  const max = Math.max(...data.map((d) => d.count), 3);
  const step = (W - padX * 2) / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => ({ ...d, x: padX + i * step, y: padTop + (H - padTop - padBottom) * (1 - d.count / max) }));
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1].x},${H - padBottom} L${pts[0].x},${H - padBottom} Z`;
  const a = active !== null ? pts[active] : null;
  const tipX = a ? Math.min(Math.max(a.x - 52, 2), W - 106) : 0;
  const labelIdx = data.length <= 7
    ? data.map((_, i) => i)
    : Array.from({ length: 5 }, (_, k) => Math.round((k * (data.length - 1)) / 4));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="area-chart">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="areaStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--primary)" /><stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      {[0, 1, 2].map((g) => {
        const y = padTop + ((H - padTop - padBottom) / 2) * g;
        return <line key={g} x1={padX} x2={W - padX} y1={y} y2={y} className="area-grid" />;
      })}
      <path d={area} fill="url(#areaFill)" className="area-fill" />
      <path d={line} fill="none" stroke="url(#areaStroke)" strokeWidth="3" strokeLinecap="round" pathLength="1" className="area-line" />
      {labelIdx.map((i, k) => {
        const p = pts[i];
        return (
          <text key={i} x={p.x} y={H - 6} textAnchor={k === 0 ? "start" : k === labelIdx.length - 1 ? "end" : "middle"} className="area-label">
            {data.length <= 7 ? p.label : `${p.short} ${p.mon}`}
          </text>
        );
      })}
      {a && (
        <g>
          <line x1={a.x} x2={a.x} y1={padTop - 6} y2={H - padBottom} className="area-cursor" />
          <circle cx={a.x} cy={a.y} r="5" className="area-dot" />
          <rect x={tipX} y="2" width="104" height="18" rx="9" className="area-tip" />
          <text x={tipX + 52} y="14.5" textAnchor="middle" className="area-tip-text">{a.short} {a.mon}: {a.count} word{a.count === 1 ? "" : "s"}</text>
        </g>
      )}
      {pts.map((p, i) => (
        <rect key={i} x={p.x - step / 2} y="0" width={step} height={H} fill="transparent"
          onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} onTouchStart={() => setActive(i)} />
      ))}
    </svg>
  );
}

function RadialProgress({ percent }) {
  const ready = useReady(250);
  const shown = useCountUp(percent, 1200);
  const R = 44, C = 2 * Math.PI * R;
  return (
    <div className="radial-wrap">
      <svg viewBox="0 0 110 110">
        <defs>
          <linearGradient id="radialGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" /><stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <circle cx="55" cy="55" r={R} className="radial-track" />
        <circle cx="55" cy="55" r={R} className="radial-prog" stroke="url(#radialGrad)" strokeDasharray={C} strokeDashoffset={ready ? C * (1 - percent / 100) : C} />
      </svg>
      <div className="radial-center"><span className="radial-num">{shown}%</span><span className="radial-sub">chapters done</span></div>
    </div>
  );
}

function MiniBars({ data }) {
  const [active, setActive] = useState(null);
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="mini-bars gw">
      <svg width="0" height="0" className="gw-defs" aria-hidden="true">
        <defs>
          <linearGradient id="gwFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f9a8d4" /><stop offset="0.55" stopColor="#ec4899" /><stop offset="1" stopColor="#7c3aed" /></linearGradient>
        </defs>
      </svg>
      {data.map((d, i) => {
        const has = d.count > 0;
        const top = has && d.count === max;
        const size = has ? 38 + (d.count / max) * 62 : 30;
        return (
          <button key={i} type="button" className={`mini-col gw-col ${has ? "has" : ""} ${top ? "top" : ""} ${active === i ? "on" : ""}`} onClick={() => setActive(active === i ? null : i)} aria-label={`${d.label}: ${d.count} gem${d.count === 1 ? "" : "s"}`}>
            <span className="mini-count">{active === i || d.count > 0 ? d.count : ""}</span>
            <span className="gw-stage">
              {has && <span className="gw-glow" />}
              <svg className="gw-gem" viewBox="0 0 24 28" preserveAspectRatio="xMidYMax meet" style={{ height: `${size}%`, animationDelay: `${i * 90}ms` }}>
                <polygon className="gw-body" points="6,2 18,2 23,10 12,27 1,10" />
                <path className="gw-facet" d="M1 10H23M6 2L10 10L12 27L14 10L18 2" />
              </svg>
              {top && <><i className="gw-spark a" /><i className="gw-spark b" /></>}
            </span>
            <span className="mini-label">{d.label.slice(0, 1)}</span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyShelfArt() {
  return (
    <div className="es-art" aria-hidden="true">
      <span className="es-glow" />
      <svg viewBox="0 0 72 56">
        <path className="es-page l" d="M36 16C27 9 14 9 5 14V45C14 40 27 40 36 47Z" />
        <path className="es-page r" d="M36 16C45 9 58 9 67 14V45C58 40 45 40 36 47Z" />
        <path className="es-spine" d="M36 16V47" />
        <path className="es-text" d="M12 22C18 20 24 21 30 24M12 29C18 27 24 28 30 31M42 24C48 21 54 20 60 22M42 31C48 28 54 27 60 29" />
      </svg>
      <i className="es-spark a" /><i className="es-spark b" /><i className="es-spark c" />
    </div>
  );
}

function WordRings({ items }) {
  const [sel, setSel] = useState(null);
  const ready = useReady(250);
  const list = items.slice(0, 6);
  const total = list.reduce((s, i) => s + i.value, 0) || 1;
  const max = Math.max(...list.map((i) => i.value), 1);
  const radii = [54, 46, 38, 30, 22, 14];
  const shown = sel !== null ? list[sel] : null;
  return (
    <div className="wr-row">
      <div className="wr-box">
        <svg viewBox="0 0 120 120">
          <g transform="rotate(-90 60 60)">
            {list.map((it, i) => {
              const R = radii[i], C = 2 * Math.PI * R;
              const frac = Math.max(it.value / max, 0.06) * 0.92;
              return (
                <g key={i} style={{ opacity: sel !== null && sel !== i ? 0.22 : 1, transition: "opacity .3s" }}>
                  <circle cx="60" cy="60" r={R} className="wr-track" />
                  <circle cx="60" cy="60" r={R} className="wr-prog" stroke={it.color}
                    strokeDasharray={C} strokeDashoffset={ready ? C * (1 - frac) : C}
                    style={{ transitionDelay: `${i * 130}ms` }} />
                </g>
              );
            })}
          </g>
        </svg>
        <div className="wr-center">
          <span className="wr-num">{shown ? shown.value : total}</span>
          <span className="wr-sub">{shown ? shown.label.slice(0, 12) : "words"}</span>
        </div>
      </div>
      <div className="wr-legend">
        {list.map((it, i) => (
          <button key={i} type="button" className={`wr-item ${sel === i ? "on" : ""}`} onClick={() => setSel(sel === i ? null : i)}>
            <span className="wr-dot" style={{ background: it.color }} />
            <span className="wr-name">{it.label}</span>
            <span className="wr-val">{Math.round((it.value / total) * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BookProgressList({ rows }) {
  const ready = useReady(300);
  return (
    <div className="bpl">
      {rows.map((r, i) => {
        const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
        return (
          <div className="bpl-row" key={r.book.id} style={{ "--c1": r.gradient[0], "--c2": r.gradient[1], "--d": i }}>
            <div className="bpl-cover">{(r.book.title || "?").trim()[0]?.toUpperCase()}</div>
            <div className="bpl-main">
              <div className="bpl-top"><span className="bpl-title">{r.book.title}</span><span className="bpl-pct">{pct}%</span></div>
              <div className="bpl-bar">
                <span className="bpl-fill" style={{ width: ready ? `${Math.max(pct, 4)}%` : "0%" }}><i className="bpl-knob" /></span>
              </div>
              <div className="bpl-meta">{r.done} of {r.total} chapters · {r.words} words</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DashboardScreen({ nav }) {
  const books = library.listBooks();
  const stats = library.getStats();
  const gemsList = gemsStore.list();
  const mascot = useMascotPreference();
  const [range, setRange] = useState(7);
  const { triggerLightTap } = useHaptic();
  const [now] = useState(() => Date.now());

  const vocabTs = allVocabTimestamps();
  const areaData = bucketByDay(vocabTs, range);
  const last14 = bucketByDay(vocabTs, 14);
  const thisWeek = last14.slice(7).reduce((s, d) => s + d.count, 0);
  const prevWeek = last14.slice(0, 7).reduce((s, d) => s + d.count, 0);
  const gemBars = bucketByDay(gemsList.map((g) => g.createdAt), 7);
  const mascotLine = useMascotLine({ streak: profileStore.getStreak(), words: stats.totalWords, books: stats.totalBooks, gems: gemsList.length, weekWords: thisWeek });
  const unlocked = profileStore.getStreak() >= 90 || (import.meta.env.DEV && localStorage.getItem("mascot_unlock") === "1");
  const voice = useGeminiVoiceDriver({ voiceName: profileStore.data.voice || "Leda" });
  const speakBusy = useRef(false);
  async function mascotSpeak() {
    if (speakBusy.current) return;
    speakBusy.current = true;
    const line = mascotLine.line;
    await voice.connect(MASCOT_VOICE_PROMPT);
    await voice.say(`[LINE] ${line}`, { fallback: line });
    voice.close();
    speakBusy.current = false;
  }

  const rows = books.map((b, i) => {
    const chs = library.getChapters(b.id);
    const total = chs.length;
    const done = chs.filter((c) => !c.isPlaceholder && isChapterClosed(c)).length;
    const words = chs.reduce((s, c) => s + (c.vocabLog?.length || 0), 0);
    return { book: b, total, done, words, gradient: BADGE_GRADIENTS[i % BADGE_GRADIENTS.length] };
  });
  const totalCh = rows.reduce((s, r) => s + r.total, 0);
  const doneCh = rows.reduce((s, r) => s + r.done, 0);
  const percent = totalCh ? Math.round((doneCh / totalCh) * 100) : 0;
  const wordRows = rows.filter((r) => r.words > 0).sort((a, b) => b.words - a.words);
const topItems = wordRows.slice(0, 5).map((r) => ({ label: r.book.title, value: r.words, color: r.gradient[0] }));
const restWords = wordRows.slice(5).reduce((s, r) => s + r.words, 0);
const donutItems = restWords > 0 ? [...topItems, { label: "Other books", value: restWords, color: "#94a3b8" }] : topItems;
  const recent = rows.filter((r, i) => i === 0 || now - new Date(r.book.lastReadAt).getTime() < 7 * 86400000).slice(0, 3);

  return (
    <div className="screen dashboard-screen">
      <div className="aurora-bg" />

      <div className="dash-sticky-header">
        <div className="dash-hero">
        <div className="dash-hero-text">
          <div className="dash-greeting">{getGreeting()}</div>
          <h1 className="dash-name">{profileStore.data.name}</h1>
          <p className="dash-date">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="dash-mascot">
          <MascotCharacter characterId={mascot} size={84} animated silent
            onTap={unlocked ? mascotSpeak : mascotLine.next}
            talking={voice.speaking} levelRef={voice.levelRef} />
        </div>
      </div>
      <div className="mascot-say" key={mascotLine.line}>
        <span className="say-dot d1" />
        <span className="say-dot d2" />
        <div className="say-bubble">{mascotLine.line}</div>
      </div>
      </div>

      <div className="dashboard-content">
      <StreakHero />

      <div className="kpi-grid">
        <KpiTile index={1} kind="books" label="Books" value={stats.totalBooks} icon={<BookOpen size={16} />} />
        <KpiTile index={2} kind="words" label="Words learned" value={stats.totalWords} icon={<Brain size={16} />} />
        <KpiTile index={3} kind="week" label="Words this week" value={thisWeek} delta={thisWeek - prevWeek} series={last14.slice(7).map((d) => d.count)} icon={<Flame size={16} />} />
        <KpiTile index={4} kind="gems" label="Gems saved" value={gemsList.length} icon={<Gem size={16} />} />
      </div>

      <WeeklyRecallCard books={books.map((book) => library.getBook(book.id)).filter(Boolean)} />

      <div className="dash-card elevated" style={{ "--i": 5 }}>
        <div className="dash-card-head">
          <div><div className="dash-card-title">Vocabulary growth</div><div className="dash-card-sub">Tap the chart to see a day</div></div>
          <div className="seg">
            {[7, 14, 30, 90].map((r) => (
              <Motion.button key={r} className={`seg-btn ${range === r ? "active" : ""}`} whileTap={{ scale: 0.92 }} transition={INTERACTION_SPRING} onClick={() => { triggerLightTap(); setRange(r); }}>{r}D</Motion.button>
            ))}
          </div>
        </div>
        <VocabAreaChart key={range} data={areaData} />
      </div>

      <div className="dash-grid-2">
        <div className="dash-card elevated" style={{ "--i": 6 }}>
          <div className="dash-card-title">Overall progress</div>
          <RadialProgress percent={percent} />
        </div>
        <div className="dash-card elevated" style={{ "--i": 7 }}>
          <div className="dash-card-title">Gems this week</div>
          <MiniBars data={gemBars} />
        </div>
      </div>

            {donutItems.length > 0 && (
        <div className="dash-card elevated" style={{ "--i": 8 }}>
          <div className="dash-card-title">Words by book</div>
          <div className="dash-card-sub">Tap a book to focus its ring</div>
          <WordRings items={donutItems} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="dash-card elevated" style={{ "--i": 9 }}>
          <div className="dash-card-title">Book progress</div>
          <BookProgressList rows={rows.slice(0, 6)} />
        </div>
      )}

      <div className="dash-section-title">Continue reading</div>
      {recent.length > 0 ? (
        <div className={`cr-scroll ${recent.length === 1 ? "single" : ""}`}>
          {recent.map((r) => {
            const pct = r.total ? Math.max(Math.round((r.done / r.total) * 100), 4) : 4;
            return (
              <Motion.button key={r.book.id} className="cr2-card" style={{ "--c1": r.gradient[0], "--c2": r.gradient[1] }} whileHover={{ y: -4, scale: 1.015 }} whileTap={{ scale: 0.985 }} transition={INTERACTION_SPRING} onClick={() => nav.openRecap(r.book.id)}>
                <span className="cr2-mark">{(r.book.title || "?").trim()[0]?.toUpperCase()}</span>
                <div className="cr2-top">
                  <span className="cr2-chip">Chapter {r.book.currentChapterNumber}</span>
                  <span className="cr2-when">{describeTimeGap(r.book.lastReadAt) || ""}</span>
                </div>
                <div className="cr2-title">{r.book.title}</div>
                <div className="cr2-bottom">
                  <div className="cr2-prog">
                    <div className="cr2-prog-bar"><span style={{ width: `${pct}%` }} /></div>
                    <span className="cr2-prog-txt">{r.done}/{r.total} chapters done</span>
                  </div>
                  <span className="cr2-play"><Play size={18} /></span>
                </div>
              </Motion.button>
            );
          })}
        </div>
      ) : (
        <div className="dash-card elevated dash-empty" style={{ "--i": 10 }}>
          <EmptyShelfArt />
          <p className="empty-hint">No books yet. Add your first one to begin.</p>
          <button className="primary-button" onClick={nav.goLibrary}>Go to Library</button>
        </div>
      )}
      </div>
    </div>
  );
}

// ==================== LIBRARY ====================

function LibraryScreen({ nav }) {
  const [books, setBooks] = useState(library.listBooks());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [authorEditor, setAuthorEditor] = useState(null);
  useBackLayer(Boolean(confirmDelete), () => setConfirmDelete(null));
  useBackLayer(Boolean(authorEditor), () => setAuthorEditor(null));
  const [portraitSearching, setPortraitSearching] = useState(false);
  const [portraitError, setPortraitError] = useState(false);

  function refresh() { setBooks(library.listBooks()); }
  useEffect(() => {
    const sync = () => setBooks(library.listBooks());
    window.addEventListener("rc:local-data-changed", sync);
    return () => window.removeEventListener("rc:local-data-changed", sync);
  }, []);
  function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    const related = {
      gems: gemsStore.removeForBook(confirmDelete.id),
      conversation: localStorage.getItem(`rc_convo_${confirmDelete.id}`),
    };
    localStorage.removeItem(`rc_convo_${confirmDelete.id}`);
    library.deleteBook(confirmDelete.id, related);
    setConfirmDelete(null);
    refresh();
    notify(`"${confirmDelete.displayTitle || confirmDelete.title}" moved to Settings → Deleted books.`, "success");
  }
  function openAuthorModal(book) {
    setPortraitSearching(false); setPortraitError(false);
    setAuthorEditor({
      bookId: book.id,
      authorName: book.authorName || "",
      authorBio: book.authorBio || "",
      authorPortrait: book.authorPortrait || "",
      authorPortraits: book.authorPortraits || [],
      mode: book.authorName ? "view" : "edit",
    });
  }
  function saveAuthorInfo() {
    if (!authorEditor) return;
    library.updateBookMeta(authorEditor.bookId, {
      authorName: authorEditor.authorName,
      authorBio: authorEditor.authorBio,
    });
    setAuthorEditor(null);
    refresh();
  }
  async function findAuthorPortrait(isAutoRetry = false) {
    if (!authorEditor?.authorName) return;
    setPortraitSearching(true);
    if (!isAutoRetry) setPortraitError(false);
    try {
      const res = await fetch(apiUrl("/api/author-portrait"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: authorEditor.authorName, bookTitle: library.getBook(authorEditor.bookId)?.title || "", tried: authorEditor.tried || [] }),
      });
      const data = await res.json();
      const fallbackPortraits = data?.dataUrl ? [{ name: authorEditor.authorName, dataUrl: data.dataUrl, sourceUrl: data.sourceUrl || null }] : [];
      const list = await Promise.all((data.portraits || fallbackPortraits).map(async (p) => ({ name: p.name || authorEditor.authorName, dataUrl: p.dataUrl ? await shrinkDataUrl(p.dataUrl) : null, sourceUrl: p.sourceUrl || null })));
      const firstUrl = list.find((p) => p.dataUrl)?.dataUrl || "";
      if (firstUrl) {
        library.updateBookMeta(authorEditor.bookId, { authorPortrait: firstUrl, authorPortraits: list });
        const newTried = (data.portraits || fallbackPortraits).map((p) => p.sourceUrl).filter(Boolean);
        setAuthorEditor((prev) => ({ ...prev, authorPortrait: firstUrl, authorPortraits: list, tried: [...(prev.tried || []), ...newTried] }));
        refresh();
        return;
      }
      if (res.status === 503 && !isAutoRetry) {
        // sources were rate-limited, not empty - quietly try once more
        setTimeout(() => findAuthorPortrait(true), 6000);
        return;
      }
      throw new Error(data?.error || "not_found");
    } catch {
      setPortraitError(true);
      setAuthorEditor((prev) => (prev ? { ...prev, tried: [] } : prev));
      if (!isAutoRetry) notify("Author ki photo online nahi mil payi - naam ki spelling check karke phir try karein.", "error");
    } finally {
      setPortraitSearching(false);
    }
  }

  return (
    <div className="screen library-screen">
      <div className="aurora-bg" />
      <ScreenHeader
        title="Library"
        subtitle={`${books.length} book${books.length === 1 ? "" : "s"} on your shelf`}
        right={<button className="add-book-btn" onClick={nav.openNewBook}><Plus size={18} strokeWidth={2.6} /> Add book</button>}
      />
      <div className="book-grid">
        {books.length === 0 && (
          <div className="empty-library-state elevated">
            <EmptyLibraryArt />
            <p className="empty-hint">No books yet. Tap "Add book" above to start one..</p>
          </div>
        )}
        {books.map((b, i) => {
        const chapters = library.getChapters(b.id);
        const total = chapters.length;
        const completed = chapters.filter((c) => !c.isPlaceholder && isChapterClosed(c)).length;
        const { date, time } = formatLastRead(b.lastReadAt);
        return (
          <BookTile
            key={b.id}
            book={b}
            index={i}
            completed={completed}
            total={total}
            date={date}
            time={time}
            onOpen={() => nav.openChapterGrid(b.id)}
            onDelete={(e) => { e.stopPropagation(); setConfirmDelete(b); }}
            onAuthor={(e) => { e.stopPropagation(); openAuthorModal(b); }}
            onPlay={() => nav.openRecap(b.id)}
          />
        );
      })}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete this book?"
          message={`"${confirmDelete.displayTitle || confirmDelete.title}", its chapters, vocabulary and linked gems will move to Settings → Deleted books. You can restore it later.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {authorEditor && (
        <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={INTERACTION_SPRING} onClick={() => setAuthorEditor(null)}>
          <Motion.div className="modal-card elevated author-modal" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={INTERACTION_SPRING} onClick={(e) => e.stopPropagation()}>
            {authorEditor.mode === "view" ? (
              <>
              <div className="author-info-card">
                  {(() => {
                    const faces = authorEditor.authorPortraits?.length
                      ? authorEditor.authorPortraits
                      : [{ name: authorEditor.authorName, dataUrl: authorEditor.authorPortrait }];
                    const hasAny = faces.some((f) => f.dataUrl);
                    return (
                      <>
                        <div className={`author-faces n${faces.length}`}>
                          {faces.map((f, i) => (
                            <div className="author-face" key={i}>
                              {f.dataUrl
                                ? <img className="author-info-portrait" src={f.dataUrl} alt={f.name} />
                                : <div className="author-info-avatar">{(f.name || "?")[0]?.toUpperCase()}</div>}
                              {faces.length > 1 && <span className="author-face-name">{f.name}</span>}
                            </div>
                          ))}
                        </div>
                        <div className="author-info-name">{authorEditor.authorName}</div>
                        {authorEditor.authorBio && <div className="author-info-bio">{authorEditor.authorBio}</div>}
                        {portraitSearching ? (
                          <div className="portrait-generating-hint">Searching online...</div>
                        ) : (
                          <button className="icon-button ghost portrait-generate-btn" onClick={findAuthorPortrait}>
                            {hasAny ? <RefreshCw size={14} /> : <Search size={14} />}{" "}
                            {portraitError ? "No photo found - Retry" : hasAny ? "Look up again" : "Find photo online"}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="modal-actions">
                  <button className="icon-button ghost" onClick={() => setAuthorEditor(null)}>Close</button>
                  <button className="primary-button" onClick={() => setAuthorEditor((prev) => ({ ...prev, mode: "edit" }))}>Edit</button>
                </div>
              </>
            ) : (
              <>
                <h2>Author details</h2>
                <input
                  className="title-input compact"
                  value={authorEditor.authorName}
                  onChange={(e) => setAuthorEditor((prev) => ({ ...prev, authorName: e.target.value }))}
                  placeholder="Author name"
                />
                <textarea
                  className="author-bio-input"
                  value={authorEditor.authorBio}
                  onChange={(e) => setAuthorEditor((prev) => ({ ...prev, authorBio: e.target.value }))}
                  placeholder="Comprehensive author bio (a few sentences)"
                  rows={5}
                />
                <div className="modal-actions">
                  <button className="icon-button ghost" onClick={() => setAuthorEditor(null)}>Cancel</button>
                  <button className="primary-button" onClick={saveAuthorInfo}>Save</button>
                </div>
              </>
            )}
          </Motion.div>
        </Motion.div>
      )}
    </div>
  );
}
// ==================== CHAPTER GRID ====================

function ChapterGridScreen({ bookId, nav }) {
  const book = library.getBook(bookId);
  if (!book) return <div className="screen"><ScreenHeader title="Book not found" onBack={nav.goBack} /></div>;

  const chapters = library.getChapters(bookId);
  const realChapters = chapters.filter((c) => !c.isPlaceholder);

  return (
    <ChapterGridTabs book={book} bookId={bookId} chapters={chapters} realChapters={realChapters} nav={nav} />
  );
}

function ChapterGridTabs({ book, bookId, chapters, realChapters, nav }) {
  const [view, setView] = useState("chapters");
  const { triggerLightTap } = useHaptic();
  return (
    <div className="screen chapter-grid-screen">
      <div className="aurora-bg" />
      <ScreenHeader title={book.title} subtitle={`${chapters.length} chapter${chapters.length === 1 ? "" : "s"}`} onBack={nav.goBack} />

      <div className="cg-tabs">
        <Motion.button className={`cg-tab ${view === "chapters" ? "on" : ""}`} whileTap={{ scale: 0.96 }} transition={INTERACTION_SPRING}
          onClick={() => { triggerLightTap(); setView("chapters"); }}>Chapters</Motion.button>
        <Motion.button className={`cg-tab ${view === "timeline" ? "on" : ""}`} whileTap={{ scale: 0.96 }} transition={INTERACTION_SPRING}
          onClick={() => { triggerLightTap(); setView("timeline"); }}>Journey Timeline</Motion.button>
      </div>

      {view === "timeline" ? (
        <div className="cg-timeline-wrap">
          {realChapters.length ? (
            <JourneyRecap embedded book={book} chapters={realChapters} />
          ) : (
            <p className="empty-hint">Kahani abhi shuru hui hai - pehla chapter padhna shuru karo, phir yahan timeline banegi.</p>
          )}
        </div>
      ) : (
      <div className="chapter-list-stack">
        {chapters.map((c) => {
          if (c.isPlaceholder) {
            return (
              <div key={c.number} className="chapter-card chapter-card-placeholder">
                <div className="chapter-card-header">
                  <span className="chapter-card-chapter">CH {c.number}</span>
                  <span className="chapter-card-status-text">Not Started</span>
                </div>
                <div className="chapter-card-title muted">Chapter {c.number}</div>
              </div>
            );
          }
          const isCurrent = c.number === book.currentChapterNumber;
          const isLocked = !isCurrent && c.number > book.currentChapterNumber;
          const status = getChapterStatus(c, isCurrent, isLocked);
          const pageRange = formatPageRange(c, { short: true });
          const gemsSaved = gemsStore.list().filter((g) => g.bookId === book.id && Number(g.chapterNumber ?? g.chapter) === c.number).length;
          const vocabCount = Array.isArray(c.vocabLog) ? c.vocabLog.length : 0;

          return (
            <Motion.button
              key={c.number}
              type="button"
              className={`chapter-card ${status.tone} ${isCurrent ? "active" : ""} ${isLocked ? "locked" : ""}`}
              whileHover={!isLocked ? { y: -3, scale: 1.01 } : undefined}
              whileTap={!isLocked ? { scale: 0.985 } : undefined}
              transition={INTERACTION_SPRING}
              onClick={() => !isLocked && nav.openChapterDetail(bookId, c.number)}
              disabled={isLocked}
            >
              <div className="chapter-card-top">
                <div className="chapter-card-left">
                  <span className="chapter-card-chapter">CH {c.number}</span>
                  <span className="chapter-card-page">{pageRange}</span>
                </div>
                <div className="chapter-card-status-box">
                  {isLocked && <Lock size={12} className="chapter-card-lock" />}
                  <span className={`chapter-card-status-pill ${status.tone}`}>{status.label}</span>
                </div>
              </div>

              <div className="chapter-card-title">{c.title}</div>

              <div className="chapter-card-footer">
                <span className="chapter-card-metrics">
                  <span className="chapter-card-metric">
                    <Gem size={12} className="chapter-card-gem-icon" />
                    {gemsSaved}
                  </span>
                  <span className="chapter-card-metric">
                    <BookOpen size={12} className="chapter-card-gem-icon" />
                    {vocabCount}
                  </span>
                </span>
                <span className="chapter-card-arrow">→</span>
              </div>
            </Motion.button>
          );
        })}
      </div>
      )}
    </div>
  );
}

// ==================== CHAPTER DETAIL ====================

function ChapterDetailScreen({ bookId, chapterNumber, nav }) {
  const [tab, setTab] = useState("summary");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [selectedVocab, setSelectedVocab] = useState(null);
  useBackLayer(!!selectedVocab, () => setSelectedVocab(null));
  const [detailTab, setDetailTab] = useState("context");
  const [detailLang, setDetailLang] = useState("hindi");
  const { triggerLightTap } = useHaptic();
  const chapter = library.getChapter(bookId, chapterNumber);
  const book = library.getBook(bookId);

  if (!chapter || !book) return <div className="screen"><ScreenHeader title="Chapter not found" onBack={nav.goBack} /></div>;
  const storySource = resolveStorySource(book);

  function saveTitle() {
    if (titleDraft.trim()) library.renameChapter(bookId, chapterNumber, titleDraft.trim());
    setEditingTitle(false);
  }

  function speakText(text, language = "en-US") {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  }

  function getLanguageText(vocab, lang) {
    if (lang === "odia") {
      return vocab?.odiaMeaning || "Odia meaning not added yet.";
    }
    return vocab?.hindiMeaning || "Hindi meaning not added yet.";
  }

  const pageRange = formatPageRange(chapter);

  if (selectedVocab) {
    const vocab = buildVocabMetadata(selectedVocab);
    const dictionaryText = getLanguageText(vocab, detailLang);

    return (
      <div className="screen chapter-detail-screen">
        <div className="aurora-bg" />
        <header className="screen-header">
          <button className="gem-back-btn" onClick={() => setSelectedVocab(null)} aria-label="Back to chapter">
            <ChevronRight size={18} className="back-chevron" />
          </button>
          <div className="header-left">
            <p className="eyebrow">{book.title} · Chapter {chapterNumber}</p>
            <h1 className="chapter-detail-title">{vocab.term}</h1>
          </div>
        </header>

        <div className="vocab-detail-tabs">
          <Motion.button className={`tab ${detailTab === "context" ? "active" : ""}`} whileTap={{ scale: 0.97 }} transition={INTERACTION_SPRING} onClick={() => setDetailTab("context")}>Context</Motion.button>
          <Motion.button className={`tab ${detailTab === "dictionary" ? "active" : ""}`} whileTap={{ scale: 0.97 }} transition={INTERACTION_SPRING} onClick={() => setDetailTab("dictionary")}>Analysis</Motion.button>
        </div>

        {detailTab === "context" ? (
          <div className="vocab-detail-panel">
            <div className="vocab-detail-card elevated">
              <div className="vocab-detail-label">Phrase from chapter</div>
              <div className="vocab-detail-quote">{vocab.sentence ? `“${vocab.sentence}”` : "The source sentence was not captured."}</div>

              <div className="vocab-detail-header-row">
                <div className="vocab-detail-subhead">{detailLang === "odia" ? "Odia" : "Hindi"} translation</div>
                <div className="vocab-language-toggle">
                  <Motion.button className={`lang-btn ${detailLang === "hindi" ? "active" : ""}`} whileTap={{ scale: 0.96 }} transition={INTERACTION_SPRING} onClick={() => { triggerLightTap(); setDetailLang("hindi"); }}>Hindi</Motion.button>
                  <Motion.button className={`lang-btn ${detailLang === "odia" ? "active" : ""}`} whileTap={{ scale: 0.96 }} transition={INTERACTION_SPRING} onClick={() => { triggerLightTap(); setDetailLang("odia"); }}>Odia</Motion.button>
                </div>
              </div>
              <div className="vocab-detail-meaning">
                {detailLang === "odia"
                  ? vocab.odiaSentence || "Sentence translation was not captured yet."
                  : vocab.hindiSentence || "Sentence translation was not captured yet."}
              </div>

              <div className="vocab-detail-example-block">
                <div className="vocab-detail-subhead">Meaning in this context</div>
                <div className="vocab-detail-meaning">{vocab.contextMeaning || vocab.meaning || "Contextual meaning not provided yet."}</div>
              </div>

              {vocab.example && (
                <div className="vocab-detail-example-block">
                  <div className="vocab-detail-subhead">Example</div>
                  <div className="vocab-detail-example">“{vocab.example}”</div>
                </div>
              )}

              {vocab.grammar && (
                <div className="vocab-detail-example-block">
                  <div className="vocab-detail-subhead">Grammar</div>
                  <div className="vocab-detail-example">{vocab.grammar}</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="vocab-detail-panel">
            <div className="vocab-detail-card elevated">
              <div className="vocab-detail-header-row">
                <div className="vocab-detail-term-wrap">
                  <div className="vocab-detail-term">{vocab.term}</div>
                  {vocab.grammar && <span className="vocab-grammar">{vocab.grammar}</span>}
                </div>
                <button className="icon-button ghost square" onClick={() => speakText(vocab.term)} aria-label={`Listen to ${vocab.term}`} title="Listen to word">
                  <Volume2 size={16} />
                </button>
                <div className="vocab-language-toggle">
                  <Motion.button className={`lang-btn ${detailLang === "hindi" ? "active" : ""}`} whileTap={{ scale: 0.96 }} transition={INTERACTION_SPRING} onClick={() => { triggerLightTap(); setDetailLang("hindi"); }}>Hindi</Motion.button>
                  <Motion.button className={`lang-btn ${detailLang === "odia" ? "active" : ""}`} whileTap={{ scale: 0.96 }} transition={INTERACTION_SPRING} onClick={() => { triggerLightTap(); setDetailLang("odia"); }}>Odia</Motion.button>
                </div>
              </div>

              <button className="icon-button ghost square" onClick={() => speakText(dictionaryText, detailLang === "odia" ? "or-IN" : "hi-IN")} aria-label={`Listen to ${detailLang} translation`} title={`Listen to ${detailLang} translation`}>
                <Volume2 size={16} />
              </button>

              <div className="vocab-definition-block">
                <div className="vocab-detail-subhead">Part of speech</div>
                <div className="vocab-detail-meaning">{vocab.grammar || "Not specified"}</div>
              </div>

              {vocab.pronunciation && (
                <div className="vocab-definition-block">
                  <div className="vocab-detail-subhead">Pronunciation</div>
                  <div className="vocab-detail-meaning">{vocab.pronunciation}</div>
                </div>
              )}

              <div className="vocab-definition-block">
                <div className="vocab-detail-subhead">General meaning</div>
                <div className="vocab-detail-meaning">{vocab.meaning || "Meaning not provided yet."}</div>
              </div>

              <div className="vocab-definition-block">
                <div className="vocab-detail-subhead">{detailLang === "odia" ? "Odia" : "Hindi"} meaning</div>
                <div className="vocab-detail-meaning">{dictionaryText}</div>
              </div>

              {(Array.isArray(vocab.synonyms) && vocab.synonyms.length > 0) && (
                <div className="vocab-definition-block">
                  <div className="vocab-detail-subhead">Synonyms</div>
                  <div className="vocab-detail-tags">{vocab.synonyms.map((item) => <span key={item}>{item}</span>)}</div>
                </div>
              )}

              {(Array.isArray(vocab.antonyms) && vocab.antonyms.length > 0) && (
                <div className="vocab-definition-block">
                  <div className="vocab-detail-subhead">Antonyms</div>
                  <div className="vocab-detail-tags muted">{vocab.antonyms.map((item) => <span key={item}>{item}</span>)}</div>
                </div>
              )}

              {vocab.example && (
                <div className="vocab-definition-block">
                  <div className="vocab-detail-subhead">Example</div>
                  <div className="vocab-detail-example">“{vocab.example}”</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="screen chapter-detail-screen">
      <div className="aurora-bg" />
      <header className="screen-header">
        <button className="gem-back-btn" onClick={nav.goBack} aria-label="Back to chapters">
          <ChevronRight size={18} className="back-chevron" />
        </button>
        <div className="header-left">
          <p className="eyebrow">{book.title} · Chapter {chapterNumber}{pageRange ? ` · ${pageRange}` : ""}</p>
          {!editingTitle ? (
            <h1 className="chapter-detail-title" onClick={() => { setTitleDraft(chapter.title); setEditingTitle(true); }}>
              {chapter.title} <Pencil size={13} className="edit-hint-icon" />
            </h1>
          ) : (
            <div className="chapter-title-edit-row">
              <input className="title-input compact" autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveTitle()} />
              <button className="icon-button ghost square" onClick={saveTitle}><Check size={14} /></button>
              <button className="icon-button ghost square" onClick={() => setEditingTitle(false)}><XIcon size={14} /></button>
            </div>
          )}
        </div>
      </header>

      <div className="tab-row">
        <Motion.button className={`tab ${tab === "summary" ? "active" : ""}`} whileTap={{ scale: 0.97 }} transition={INTERACTION_SPRING} onClick={() => setTab("summary")}>Summary</Motion.button>
        <Motion.button className={`tab ${tab === "vocab" ? "active" : ""}`} whileTap={{ scale: 0.97 }} transition={INTERACTION_SPRING} onClick={() => setTab("vocab")}>Vocabulary</Motion.button>
      </div>

      <div className="tab-viewport">
        <Motion.div className="tab-slider" initial={false} animate={{ x: tab === "summary" ? "0%" : "-50%" }} transition={INTERACTION_SPRING}>
          <div className="tab-panel">
            {chapter.jumpNote && <div className="jump-note elevated">Started out of order: {chapter.jumpNote}</div>}
            {chapter.completionNote && <div className="jump-note elevated">Closing note: {chapter.completionNote}</div>}
            {chapter.summary ? (
              <div className="plot-summary-card elevated">{chapter.summary}</div>
            ) : (
              <p className="empty-hint">No summary yet for this chapter - it'll build up automatically as you read across sessions, matching only what's actually covered so far.</p>
            )}
            {Number(chapterNumber) === Number(book.currentChapterNumber) && storySource.mode !== "empty" && (
              <button type="button" className="story-listen-button" onClick={() => nav.openStory(book.id)}>
                <Play size={16} /> Hear the story
              </button>
            )}
          </div>
          <div className="tab-panel">
            {chapter.vocabLog.some((entry) => (entry.pronunciationHints || []).some((hint) => hint.count >= 2)) && (
              <section className="pronunciation-notes">
                <div className="pronunciation-notes-head"><Volume2 size={15} /><b>Words you might want to practice saying</b></div>
                <p>Yeh ek informal nudge hai, exact pronunciation score nahi.</p>
                {chapter.vocabLog.filter((entry) => (entry.pronunciationHints || []).some((hint) => hint.count >= 2)).map((entry) => (
                  <div key={entry.term} className="pronunciation-note"><b>{entry.term}</b><span>{entry.pronunciationHints.find((hint) => hint.count >= 2)?.observed}</span></div>
                ))}
              </section>
            )}
            <div className="vocab-list">
              {chapter.vocabLog.length === 0 && <p className="empty-hint">No words logged for this chapter yet.</p>}
              {chapter.vocabLog.slice().reverse().map((v, i) => {
                const contextualMeaning = v.contextMeaning || v.meaning || "";
                const shortMeaning = v.meaning && v.contextMeaning && v.meaning !== v.contextMeaning ? v.meaning : "";

                return (
                  <button
                    type="button"
                    className="vocab-card elevated"
                    key={i}
                    style={{ "--badge": badgeGradient(i) }}
                    onClick={() => { setSelectedVocab(v); }}
                  >
                    <div className="vocab-term-row">
                      <div className="vocab-term">{v.term}</div>
                      {v.grammar && <span className="vocab-grammar">{v.grammar}</span>}
                    </div>
                    <div className="vocab-learning-tags">
                      {v.usageRegister === "everyday" && <span className="vocab-register everyday">Everyday</span>}
                      {v.usageRegister === "formal-literary" && <span className="vocab-register formal">Formal / literary</span>}
                      {Number(v.practiceCount) > 0 && <span className="vocab-practiced"><Check size={11} /> Practiced</span>}
                    </div>

                    {contextualMeaning && <div className="vocab-context"><strong>Context:</strong> {contextualMeaning}</div>}
                    {shortMeaning && <div className="vocab-meaning"><strong>Meaning:</strong> {shortMeaning}</div>}

                    {(v.hindiMeaning || v.odiaMeaning) && (
                      <div className="vocab-bilingual">
                        {v.hindiMeaning && <div><strong>Hindi:</strong> {v.hindiMeaning}</div>}
                        {v.odiaMeaning && <div><strong>Odia:</strong> {v.odiaMeaning}</div>}
                      </div>
                    )}

                    {(Array.isArray(v.synonyms) && v.synonyms.length > 0) || (Array.isArray(v.antonyms) && v.antonyms.length > 0) ? (
                      <div className="vocab-relations">
                        {Array.isArray(v.synonyms) && v.synonyms.length > 0 && (
                          <div><strong>Synonyms:</strong> {v.synonyms.join(", ")}</div>
                        )}
                        {Array.isArray(v.antonyms) && v.antonyms.length > 0 && (
                          <div><strong>Antonyms:</strong> {v.antonyms.join(", ")}</div>
                        )}
                      </div>
                    ) : null}

                    {v.sentence && <div className="vocab-sentence"><strong>In book:</strong> {v.sentence}</div>}
                    {v.example && <div className="vocab-example"><strong>Example:</strong> "{v.example}"</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </Motion.div>
      </div>
    </div>
  );
}

// ==================== GEMS — book filter as a dropdown ====================

function GemsScreen({ nav }) {
  const [filterBook, setFilterBook] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [selectedGemId, setSelectedGemId] = useState(null);
  const [stylePicking, setStylePicking] = useState(false);
  const [storyGem, setStoryGem] = useState(null);
  useBackLayer(!!selectedGemId, () => { setSelectedGemId(null); setStylePicking(false); });
  useBackLayer(!!storyGem, () => setStoryGem(null));
  const [, forceTick] = useState(0);
  const allGems = gemsStore.list();
  const bookOptions = [...allGems.reduce((map, gem) => {
    const key = String(gem.bookId || gem.bookTitle || "unknown");
    const current = map.get(key) || { key, title: gem.bookTitle || "Untitled book", count: 0 };
    current.count += 1;
    map.set(key, current);
    return map;
  }, new Map()).values()];
  const search = searchText.trim().toLowerCase();
  const gems = allGems.filter((gem) => {
    const key = String(gem.bookId || gem.bookTitle || "unknown");
    const matchesBook = filterBook === "all" || key === filterBook;
    const matchesSearch = !search || `${gem.quote || ""} ${gem.bookTitle || ""} ${gem.takeawaySituation || ""}`.toLowerCase().includes(search);
    return matchesBook && matchesSearch;
  });

  useEffect(() => {
    const onGemsUpdate = () => forceTick((n) => n + 1);
    window.addEventListener("gems:updated", onGemsUpdate);
    return () => window.removeEventListener("gems:updated", onGemsUpdate);
  }, []);

  function getGemPreview(gem) {
    if (gem.summary && gem.summary.trim()) return gem.summary.trim();
    const raw = gem.quote || "A meaningful quote";
    return raw.length > 120 ? `${raw.slice(0, 117).trim()}…` : raw;
  }

  async function generateIllustration(gem, style) {
    setStylePicking(false);
    gemsStore.setSketchStyle(gem.id, style);
    gemsStore.markSketchPending(gem.id);
    forceTick((n) => n + 1);
    try {
      const res = await fetch(apiUrl("/api/sketch-gem"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, quote: gem.quote, bookTitle: gem.bookTitle }),
      });
      const data = await res.json();
      if (!res.ok || !data?.dataUrl) throw new Error(data?.error || "no_image_returned");
      gemsStore.setSketchSuccess(gem.id, data.dataUrl);
    } catch {
      gemsStore.setSketchFailed(gem.id);
      notify("Illustration abhi nahi ban payi - backend server ya internet check karke phir try karein.", "error");
    }
    forceTick((n) => n + 1);
  }

  function getGemAuthor(gem) {
    const bookAuthor = gem?.bookId ? library.getBook(gem.bookId)?.authorName || "" : "";
    return (gem?.attributedTo || gem?.authorName || gem?.quoteSource || bookAuthor || "Author unknown").trim() || "Author unknown";
  }


  const selectedGem = selectedGemId ? gems.find((g) => g.id === selectedGemId) || null : null;

  if (selectedGem) {
    return (
        <div className="screen gem-detail-screen">
        <div className="aurora-bg" />
        <div className="gem-detail-header">
          <button className="gem-back-btn" onClick={() => { setSelectedGemId(null); setStylePicking(false); }} aria-label="Back to gems">
            <ChevronRight size={18} className="back-chevron" />
          </button>
          <div className="gem-detail-title-block">
            {selectedGem.bookTitle && <div className="gem-detail-book">{selectedGem.bookTitle}</div>}
            <div className="gem-detail-meta-row">
              {(selectedGem.attributedTo || selectedGem.authorName || selectedGem.quoteSource) && (
                <span className="gem-detail-author">{getGemAuthor(selectedGem)}</span>
              )}
              {Number.isFinite(Number(selectedGem.chapterNumber)) && (
                <span className="gem-detail-chapter">Chapter {selectedGem.chapterNumber}</span>
              )}
            </div>
          </div>
        </div>

        <div className="gem-detail-card elevated gem-gallery-detail" style={{ "--gem-accent": BADGE_GRADIENTS[gemPaletteIndex(selectedGem)][0], "--gem-accent-2": BADGE_GRADIENTS[gemPaletteIndex(selectedGem)][1] }}>
          <div className="gem-detail-poster">
            <span className="gem-detail-crystal" aria-hidden="true"><i /><i /><i /></span>
            <Quote size={17} className="gem-detail-quote-mark" aria-hidden="true" />
            <div className="gem-detail-quote">“{String(selectedGem.quote || "A meaningful quote").trim()}”</div>
            <div className="gem-detail-source">{selectedGem.bookTitle || "Saved idea"}{Number.isFinite(Number(selectedGem.chapterNumber)) ? ` · Chapter ${selectedGem.chapterNumber}` : ""}</div>
          </div>

          <div className="gem-detail-art-wrap">
            {selectedGem.sketch === "pending" && (
              <div className="gem-sketch-skeleton" aria-label="Sketch loading">
                <div className="gem-sketch-shimmer" />
              </div>
            )}
            {selectedGem.sketch && typeof selectedGem.sketch === "object" && selectedGem.sketch.dataUrl && (
              <div className="gem-art-card">
                <img className="gem-sketch-image" src={selectedGem.sketch.dataUrl} alt="Decorative illustration for saved gem" />
                <div className="gem-art-overlay" aria-hidden="true" />
              </div>
            )}
            {selectedGem.sketch === "failed" && (
              <button className="gem-retry-btn" onClick={() => generateIllustration(selectedGem, selectedGem.sketchStyle || pickGemArtStyle(selectedGem))}>
                Illustration failed - Retry
              </button>
            )}
            {!selectedGem.sketch && !stylePicking && (
              <button className="icon-button ghost illustration-cta" onClick={() => setStylePicking(true)}>
                <ImageIcon size={14} /> Generate illustration for this quote
              </button>
            )}
            {stylePicking && (
              <div className="portrait-style-grid">
                {GEM_ART_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className={`portrait-style-btn ${pickGemArtStyle(selectedGem) === opt.id ? "suggested" : ""}`}
                    onClick={() => generateIllustration(selectedGem, opt.id)}
                  >
                    <div className="portrait-style-label">{opt.label}{pickGemArtStyle(selectedGem) === opt.id ? " · Suggested" : ""}</div>
                    <div className="portrait-style-desc">{opt.desc}</div>
                  </button>
                ))}
              </div>
            )}
            {selectedGem.sketch && typeof selectedGem.sketch === "object" && !stylePicking && (
              <button className="icon-button ghost illustration-cta" onClick={() => setStylePicking(true)}>
                <RefreshCw size={14} /> Regenerate illustration
              </button>
            )}
          </div>
          {/* <button className="icon-button ghost illustration-cta" style={{ marginBottom: 16 }} onClick={() => setStoryGem(selectedGem)}>
            <Share2 size={14} /> Create story card
          </button>    */}
          <div className="gem-application-block gem-detail-application">
            <div className="gem-application-label">Real-life application</div>
            {selectedGem.takeawaySituation || selectedGem.takeawaySteps?.length ? (
              <div className="gem-takeaway-structured">
                {selectedGem.takeawaySituation && (
                  <div className="gem-takeaway-part">
                    <div className="gem-takeaway-heading">Situation</div>
                    <div className="gem-takeaway-text">{selectedGem.takeawaySituation}</div>
                  </div>
                )}
                {selectedGem.takeawaySteps?.length > 0 && (
                  <div className="gem-takeaway-part">
                    <div className="gem-takeaway-heading">Steps</div>
                    <ol className="gem-takeaway-steps">
                      {selectedGem.takeawaySteps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  </div>
                )}
                {selectedGem.takeawayExample && (
                  <div className="gem-takeaway-part">
                    <div className="gem-takeaway-heading">Example</div>
                    <div className="gem-takeaway-text">{selectedGem.takeawayExample}</div>
                  </div>
                )}
                {selectedGem.takeawayWhyItMatters && (
                  <div className="gem-takeaway-part">
                    <div className="gem-takeaway-heading">Why it matters</div>
                    <div className="gem-takeaway-text">{selectedGem.takeawayWhyItMatters}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="gem-application">{selectedGem.takeaway || selectedGem.application || "Keep this idea close and apply it in a small, concrete way."}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen gems-screen">
      <div className="aurora-bg" />
      {storyGem && <GemStoryCard gem={storyGem} author={getGemAuthor(storyGem)} onClose={() => setStoryGem(null)} />}
      <ScreenHeader title="Gems" subtitle={`${gems.length} saved`} onProfile={nav.goProfile} />

      <div className="gem-gallery-controls">
        <label className="gem-gallery-search"><Search size={16} /><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search quotes or books" aria-label="Search gems" />{searchText && <button type="button" onClick={() => setSearchText("")} aria-label="Clear search"><XIcon size={14} /></button>}</label>
        {bookOptions.length > 0 && (
          <div className="gem-book-chips" aria-label="Filter gems by book">
            <button type="button" className={`gem-book-chip ${filterBook === "all" ? "on" : ""}`} onClick={() => setFilterBook("all")}>All <span>{allGems.length}</span></button>
            {bookOptions.map((book) => <button type="button" key={book.key} className={`gem-book-chip ${filterBook === book.key ? "on" : ""}`} onClick={() => setFilterBook(book.key)}>{book.title} <span>{book.count}</span></button>)}
          </div>
        )}
      </div>

      <div className="gems-list">
        {gems.length === 0 && (
          <div className="empty-state-card elevated tiny-mascot-card">
            <EmptyGemsArt />
            <p className="empty-hint">{allGems.length === 0 ? "No quotes saved yet. Your kept ideas will find a home here." : "Koi saved quote nahi mila. Search ya book filter badal kar dekhiye."}</p>
          </div>
        )}
        {gems.map((g, i) => (
          <Motion.article className="gem-card elevated compact gem-gallery-card" key={g.id} style={{ "--badge": badgeGradient(gemPaletteIndex(g)), "--gem-accent": BADGE_GRADIENTS[gemPaletteIndex(g)][0], "--gem-accent-2": BADGE_GRADIENTS[gemPaletteIndex(g)][1], "--gem-i": i }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32, delay: Math.min(i * .045, .32) }}>
            <div className="gem-card-toolbar">
              <div className="gem-badge"><span className="gem-crystal-mini" aria-hidden="true"><i /><i /></span><Gem size={14} /></div>
              <div className="gem-toolbar-actions">
                <button className="gem-download-btn" onClick={(e) => { e.stopPropagation(); setStoryGem(g); }} aria-label="Download gem card">
                  <Download size={14} />
                </button>
                <button className="gem-delete-btn" onClick={(e) => { e.stopPropagation(); gemsStore.remove(g.id); forceTick((n) => n + 1); if (selectedGemId === g.id) setSelectedGemId(null); }} aria-label="Delete gem">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <Motion.button className="gem-card-toggle" whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.985 }} transition={INTERACTION_SPRING} onClick={() => setSelectedGemId(g.id)}>
                <div className="gem-preview-block">
                {g.bookTitle && (
                  <div className="gem-book-title"><BookMarked size={12} /> {g.bookTitle}{Number.isFinite(Number(g.chapterNumber)) ? ` · Ch. ${g.chapterNumber}` : ""}</div>
                )}
                <div className="gem-preview-quote">“{getGemPreview(g)}”</div>
                <span className="gem-open-cue">Open saved idea <ChevronRight size={13} /></span>
              </div>
              <div className="gem-chevron-wrap"><ChevronRight size={18} /></div>
            </Motion.button>
          </Motion.article>
        ))}
      </div>
    </div>
  );
}

function MemoryTab({ nav }) {
  const [data, setData] = useState(() => ({ books: library.listBooks(), gems: gemsStore.list() }));
  const [tab, setTab] = useState("list");
  const saveGemInsight = useCallback((id, insight) => gemsStore.updateInsight(id, insight), []);
  const tabs = [
    { id: "list", label: "Preferences", Icon: Brain },
    { id: "map", label: "Mind Map", Icon: Network },
  ];
  const spring = INTERACTION_SPRING;
  const { triggerLightTap } = useHaptic();

  // keep the mind map fresh: gems saved during sessions arrive via this event
  useEffect(() => {
    const refresh = () => setData({ books: library.listBooks(), gems: gemsStore.list() });
    window.addEventListener("gems:updated", refresh);
    return () => window.removeEventListener("gems:updated", refresh);
  }, []);

  return (
    <div className="mem-tab">
      <ScreenHeader title="Memory" subtitle="Preferences & your mind map" />

      <div className="mem-switch" role="tablist">
        <div className="mem-switch-in">
          <Motion.span className="mem-pill" initial={false} animate={{ x: tab === "list" ? "0%" : "100%" }} transition={spring} />
          {tabs.map(({ id, label, Icon }) => (
            <Motion.button key={id} role="tab" aria-selected={tab === id} className={`mem-tab-btn ${tab === id ? "on" : ""}`} whileTap={{ scale: 0.96 }} transition={spring} onClick={() => { triggerLightTap(); setTab(id); if (id === "map") setData({ books: library.listBooks(), gems: gemsStore.list() }); }}>
              <Icon size={15} /> {label}
            </Motion.button>
          ))}
        </div>
      </div>

      <div className="mem-viewport">
        <Motion.div className="mem-track" initial={false} animate={{ x: tab === "list" ? "0%" : "-50%" }} transition={spring}>
          <div className="mem-pane scroll"><MemoryScreen nav={nav} /></div>
          <div className="mem-pane"><MemoryConstellation books={data.books} gems={data.gems} paused={tab !== "map"} onGemInsight={saveGemInsight} /></div>
        </Motion.div>
      </div>
    </div>
  );
}
// ==================== MEMORY ====================

function MemoryScreen() {
  const [, setTick] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingText, setEditingText] = useState(null);
  useBackLayer(Boolean(confirmDelete), () => setConfirmDelete(null));
  const [editDraft, setEditDraft] = useState("");
  const now = APP_STARTED_AT;
  const memories = memoryStore?.memories || [];
  const orderedMemories = memories.slice().reverse();
  const memoryGroups = orderedMemories.length > 8 && now
    ? [
      { title: "This week", entries: orderedMemories.filter((m) => m.timestamp && now - new Date(m.timestamp).getTime() < 7 * 86400000) },
      { title: "Earlier", entries: orderedMemories.filter((m) => !m.timestamp || now - new Date(m.timestamp).getTime() >= 7 * 86400000 && now - new Date(m.timestamp).getTime() < 30 * 86400000) },
      { title: "Saved before", entries: orderedMemories.filter((m) => m.timestamp && now - new Date(m.timestamp).getTime() >= 30 * 86400000) },
    ].filter((group) => group.entries.length)
    : [{ title: "Your preferences", entries: orderedMemories }];

  function iconForMemory(text) {
    const value = String(text || "").toLowerCase();
    if (/book|read|chapter|story/.test(value)) return BookOpen;
    if (/goal|daily|time|minute|hour/.test(value)) return Clock;
    if (/language|hindi|odia|english/.test(value)) return Volume2;
    if (/work|job|study|exam/.test(value)) return User;
    return Brain;
  }
  function memoryAge(timestamp) {
    if (!timestamp) return "Saved earlier";
    const age = describeTimeGap(timestamp);
    return age ? `Saved ${age}` : "Saved earlier";
  }

  function handleDeleteConfirmed() {
    if (confirmDelete !== null) { memoryStore.remove(confirmDelete); setConfirmDelete(null); setTick((n) => n + 1); }
  }
  function startEdit(text) {
    setEditingText(text);
    setEditDraft(text);
  }
  function saveEdit() {
    if (editingText !== null && editDraft.trim()) memoryStore.update(editingText, editDraft.trim());
    setEditingText(null);
    setTick((n) => n + 1);
  }

  return (
    <div className="memory-screen">
      <div className="memory-list">
        {memories.length === 0 && (
          <div className="pref-empty">
            <span className="pref-empty-orbit"><Brain size={25} /></span>
            <b>Your reading style, remembered</b>
            <p>Preferences you ask your companion to remember will appear here.</p>
          </div>
        )}
        {memoryGroups.map((group) => (
          <section className="pref-group" key={group.title}>
            {memories.length > 8 && <h3>{group.title}<span>{group.entries.length}</span></h3>}
            {group.entries.map((m, i) => {
              const Icon = iconForMemory(m.text);
              return (
          <Motion.div className="memory-card elevated pref-card" key={`${m.timestamp || "legacy"}-${i}`} whileHover={{ y: -2 }} transition={INTERACTION_SPRING}>
            {editingText === m.text ? (
              <div className="memory-edit-row">
                <input
                  className="title-input compact memory-edit-input"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  autoFocus
                />
                <button className="icon-button ghost square" onClick={saveEdit}><Check size={14} /></button>
                <button className="icon-button ghost square" onClick={() => setEditingText(null)}><XIcon size={14} /></button>
              </div>
            ) : (
              <>
                <span className="pref-card-icon"><Icon size={17} /></span>
                <div className="memory-text-block">
                  <span className="memory-text">{m.text}</span>
                  <span className="memory-timestamp">{memoryAge(m.timestamp)}</span>
                </div>
                <div className="memory-card-actions">
                  <button className="pref-action" onClick={() => startEdit(m.text)} aria-label="Edit memory"><Pencil size={14} /></button>
                  <button className="pref-action danger" onClick={() => setConfirmDelete(m.text)} aria-label="Delete memory"><Trash2 size={14} /></button>
                </div>
              </>
            )}
          </Motion.div>
              );
            })}
          </section>
        ))}
      </div>
      {confirmDelete !== null && (
        <ConfirmModal title="Delete this memory?" message="This preference will be permanently deleted." onConfirm={handleDeleteConfirmed} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  );
}
// ==================== PROFILE — with photo upload + default presets ====================

function ProfileScreen({ nav }) {
  const docsUnlocked = useDocsUnlocked();
  const [name, setName] = useState(profileStore.data.name);
  const profileAvatar = profileStore.data.avatar;
  const mascot = useMascotPreference();
  const [, forceUpdate] = useState(0);
  const fileInputRef = useRef(null);
  const [cropFile, setCropFile] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uidCopied, setUidCopied] = useState(false);
  const arenaAvatarSyncRef = useRef(Promise.resolve());
  const arenaAvatarSignatureRef = useRef("");

  useEffect(() => {
    if (!nav.userId) return undefined;
    const avatar = profileAvatar;
    if (!avatar && !arenaAvatarSignatureRef.current) return undefined;
    const signature = avatar ? `${avatar.length}:${avatar.slice(0, 48)}:${avatar.slice(-32)}` : "removed";
    const syncKey = `rc_arena_avatar_sync_${nav.userId}`;
    try {
      if (localStorage.getItem(syncKey) === signature) {
        arenaAvatarSignatureRef.current = signature;
        return undefined;
      }
    } catch {
      // Sync continues if storage is unavailable.
    }
    if (arenaAvatarSignatureRef.current === signature) return undefined;
    arenaAvatarSignatureRef.current = signature;
    arenaAvatarSyncRef.current = arenaAvatarSyncRef.current.catch(() => {}).then(() => (
      avatar ? uploadArenaAvatar(avatar) : clearArenaAvatar()
    )).then(() => {
      try {
        if (avatar) localStorage.setItem(syncKey, signature);
        else localStorage.removeItem(syncKey);
      } catch {
        // The next Profile visit can safely retry the sync.
      }
    }).catch((error) => {
      console.warn("[READING_ARENA] Could not sync profile photo", error?.message || error);
      if (arenaAvatarSignatureRef.current === signature) arenaAvatarSignatureRef.current = "";
    });
    return undefined;
  }, [nav.userId, profileAvatar]);

  function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setCropFile(file);
  }
  function handleAvatarRemove() {
    profileStore.clearAvatar();
    setPickerOpen(false);
    forceUpdate((n) => n + 1);
  }
  function handlePresetPick(idx) {
    profileStore.clearAvatar();
    profileStore.setAvatarPreset(idx);
    setPickerOpen(false);
    forceUpdate((n) => n + 1);
  }
  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(nav.userId);
    } catch {
      const field = document.createElement("textarea");
      field.value = nav.userId;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try { document.execCommand("copy"); } finally { document.body.removeChild(field); }
    }
    setUidCopied(true);
    window.setTimeout(() => setUidCopied(false), 2200);
  }

  const hasPhoto = !!profileAvatar;
  const rise = (i) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: 0.06 * i, ease: "easeOut" } });

  return (
    <div className="screen pf-screen">
      <div className="aurora-bg" />

      <Motion.section className="pc" {...rise(0)}>
        <span className="pc-rim" aria-hidden="true" />
        <ProfileFloaters />
        <div className="pc-badge">Reader profile</div>

        <div className="pc-stage">
        <div className="pc-avatar">
          <span className="pc-ripples" aria-hidden="true"><i /><i /><i /></span>
          <button type="button" className="pc-photo" onClick={() => fileInputRef.current?.click()} aria-label="Change photo">
            {renderAvatar(34)}
          </button>
          <button type="button" className="pc-cam" onClick={() => fileInputRef.current?.click()} aria-label="Upload photo">
            <CameraIcon size={13} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarPick} />
        </div>
        </div>

        <input className="pc-name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} onBlur={() => profileStore.setName(name)} aria-label="Your name" />
        {nav.userId && <div className="pc-uid">
          <span><Fingerprint size={14} aria-hidden="true" /><b>UID:</b><code>{nav.userId}</code></span>
          <button type="button" onClick={copyUserId} aria-label={uidCopied ? "User ID copied" : "Copy user ID"}>
            {uidCopied ? <Check size={14} /> : <Copy size={14} />}{uidCopied && <small aria-live="polite">Copied</small>}
          </button>
        </div>}

        <button type="button" className="pc-change" aria-expanded={pickerOpen} onClick={() => setPickerOpen((v) => !v)}>
          {pickerOpen ? "Close" : "Change avatar"}
        </button>

        <AnimatePresence initial={false}>
          {pickerOpen && (
            <Motion.div
              key="tray"
              className="pc-tray-wrap"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <div className="pc-tray" role="group" aria-label="Default avatars">
                {AVATAR_PRESETS.map(({ Icon, gradient }, idx) => (
                  <Motion.button
                    key={idx}
                    type="button"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 22, delay: 0.04 * idx }}
                    whileTap={{ scale: 0.9 }}
                    className={`pc-swatch ${!hasPhoto && profileStore.data.avatarPreset === idx ? "on" : ""}`}
                    style={{ background: gradient }}
                    onClick={() => handlePresetPick(idx)}
                    aria-label={`Choose default icon ${idx + 1}`}
                  >
                    <Icon size={22} color="#fff" />
                  </Motion.button>
                ))}
              </div>
              {hasPhoto && <button type="button" className="pc-remove" onClick={handleAvatarRemove}>Remove photo</button>}
            </Motion.div>
          )}
        </AnimatePresence>
      </Motion.section>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={(dataUrl) => { profileStore.setAvatar(dataUrl); setCropFile(null); forceUpdate((n) => n + 1); }}
        />
      )}
      <Motion.section className="pf-block" {...rise(2)}>
        <div className="pf-block-head"><h2>Your companion</h2><span>Pick who reads with you</span></div>
        <div className="pf-companions">
          {["owl", "robot", "sprout", "fox", "book"].map((id) => (
            <Motion.button
              key={id}
              type="button"
              whileTap={{ scale: 0.94 }}
              className={`pf-companion ${mascot === id ? "on" : ""}`}
              onClick={() => { setMascot(id); forceUpdate((n) => n + 1); }}
              aria-label={`Choose ${id} mascot`}
              aria-pressed={mascot === id}
            >
              <MascotCharacter characterId={id} size={46} animated={false} />
              <i aria-hidden="true" />
            </Motion.button>
          ))}
        </div>
      </Motion.section>

      <Motion.section className="pf-bento" {...rise(4)}>
        <ReaderArenaEntry onOpen={nav.goReaderRanking} />
        <button type="button" className="pf-tile account" onClick={nav.goAccount}>
          <span className="pf-tile-ic"><Cloud size={21} /></span>
          <span className="pf-tile-text">
            <b>Account</b>
            <small>{nav.accountEmail} · {nav.accountSyncStatus === "syncing" ? "Syncing" : nav.accountSyncStatus === "error" ? "Sync needs attention" : "Cloud backup active"}</small>
          </span>
          <ChevronRight size={18} className="pf-tile-go" />
        </button>
        <button type="button" className="pf-tile settings" onClick={nav.goSettings}>
          <span className="pf-tile-ic"><SettingsIcon size={22} /></span>
          <span className="pf-tile-text"><b>Settings</b><small>Theme, voice, backup, privacy</small></span>
          {nav.badges?.settings > 0 && <span className="rc-badge" aria-label={`${nav.badges.settings} pending`}>{nav.badges.settings}</span>}
          <ChevronRight size={18} className="pf-tile-go" />
        </button>
        <button type="button" className="pf-tile report" onClick={nav.goReport}>
          <span className="pf-tile-ic"><Bug size={20} /></span>
          <span className="pf-tile-text"><b>Report an issue</b><small>Bugs and ideas</small></span>
        </button>
        <button type="button" className="pf-tile help" onClick={nav.goHelp}>
          <span className="pf-tile-ic"><MessageCircleMore size={21} /></span>
          <span className="pf-tile-text"><b>Help &amp; guide</b><small>Find your way around</small></span>
        </button>
        <button type="button" className="pf-tile about" onClick={nav.goAbout}>
          <span className="pf-tile-ic"><Info size={20} /></span>
          <span className="pf-tile-text"><b>About</b><small>Why this exists & Who has built this</small></span>
        </button>
        {docsUnlocked && <DocsAccessCard userId={nav.userId} readerName={nav.readerName} onOpen={nav.goDocs} onContact={nav.openDeveloperEmail} />}

      </Motion.section>

      <p className="pf-foot">Reading Companion · v{APP_VERSION}</p>
    </div>
  );
}

function SessionScreen({ bookId, onEnd, onRestart, onUsageSecond, onDailyLimit }) {
  const onUsageSecondRef = useRef(onUsageSecond);
  const onDailyLimitRef = useRef(onDailyLimit);
  const handleEndRef = useRef(null);
  onUsageSecondRef.current = onUsageSecond;
  onDailyLimitRef.current = onDailyLimit;
  const book = library.getBook(bookId);
  const [lookedUpCover, setLookedUpCover] = useState({ bookId: null, dataUrl: "" });
  const auraImageUrl = book?.coverImage || (lookedUpCover.bookId === bookId ? lookedUpCover.dataUrl : "") || book?.coverUrl || book?.authorPortrait || "";
  const auraColor = useBookAura(auraImageUrl);
  const { triggerLightTap, triggerSuccess } = useHaptic();
  const [status, setStatus] = useState("Connecting...");
  const [speaking, setSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const sessionAudioMuteRef = useRef(null);
  const muteStartedAtRef = useRef(null);
  const unmuteClassRef = useRef(null);
  const unmuteLatencySamplesRef = useRef({ warm: [], cold: [] });
  const [sessionInfoOpen, setSessionInfoOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [, setSleepState] = useState("active");
  const [chapterNumber, setChapterNumber] = useState(book?.currentChapterNumber || 1);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [, setMeterLevel] = useState(0);
  const [cameraExpanded, setCameraExpanded] = useState(false);
  const [orbVisual, setOrbVisual] = useState({ orbMode: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [sessionStats, setSessionStats] = useState({ words: 0, gems: 0 });
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [ghostToast, setGhostToast] = useState(false);
  const [activities, setActivities] = useState([]);
  const [liveActivity, setLiveActivity] = useState(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [snapExpanded, setSnapExpanded] = useState(false);
  const [snapBusy, setSnapBusy] = useState(false);
  const snapBusyRef = useRef(false);
  const [asking, setAsking] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [typedQuestion, setTypedQuestion] = useState("");
  const [pageNumberInput, setPageNumberInput] = useState("");
  const chapterPathRef = useRef(null);
  const [textBusy, setTextBusy] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [restorePrompt, setRestorePrompt] = useState(false);
  const [pendingShot, setPendingShot] = useState(null);
  const [rejectedShot, setRejectedShot] = useState(null);
  const snapFileRef = useRef(null);
  useEffect(() => {
    if (!("wakeLock" in navigator) || typeof navigator.wakeLock.request !== "function") return undefined;
    let sentinel = null;
    let disposed = false;
    const release = async () => {
      const current = sentinel;
      sentinel = null;
      if (current && !current.released) await current.release().catch((error) => console.warn("[WAKE_LOCK] release failed", error));
    };
    const request = async () => {
      if (disposed || document.visibilityState !== "visible" || sentinel) return;
      try {
        const current = await navigator.wakeLock.request("screen");
        if (disposed || document.visibilityState !== "visible") {
          await current.release();
          return;
        }
        sentinel = current;
        current.addEventListener("release", () => {
          if (sentinel === current) sentinel = null;
        }, { once: true });
      } catch (error) {
        console.info("[WAKE_LOCK] keeping screen awake is unavailable", error?.message || error);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void request();
      else void release();
    };
    void request();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      void release();
    };
  }, []);
  useBackLayer(transcriptOpen, () => setTranscriptOpen(false));
  useBackLayer(feedOpen, () => setFeedOpen(false));
  useBackLayer(Boolean(pendingShot), () => setPendingShot(null));
  useBackLayer(Boolean(rejectedShot), () => setRejectedShot(null));
  useBackLayer(sessionInfoOpen, () => setSessionInfoOpen(false));
  useEffect(() => {
    void fetch(apiUrl("/api/health"), { cache: "no-store" }).catch(() => {});
  }, []);
  const snapBase64Ref = useRef(null);
  const pageRef = useRef(null);
  const pageProviderRef = useRef(createPageContextProvider());
  const connectionPromiseRef = useRef(null);
  const micGateRef = useRef(null);
  const openingMicFallbackRef = useRef(null);
  const vadRef = useRef(null);
  const vadStartingRef = useRef(false);
  const vadGenerationRef = useRef(0);
  const readingModeRef = useRef(false);
  const classifyNoticeAtRef = useRef(0);
  const classifyAbortRef = useRef(null);
  const pageVerificationAbortRef = useRef(null);
  const lastSpecAtRef = useRef(0);
  const memorySavedTurnRef = useRef(false);
  const warmTimerRef = useRef(null);
  const askingRef = useRef(false);
  const followTimerRef = useRef(null);
  const quietModeTimerRef = useRef(null);
  useEffect(() => { askingRef.current = asking; }, [asking]);
  const ghostModeRef = useRef(false);
  const usageRef = useRef([]);
  const questionEndAtRef = useRef(0);
  const questionInFlightRef = useRef(false);
  const firstAudioLoggedRef = useRef(false);
  const snapTimerRef = useRef(null);
  const snapCountRef = useRef(0);
  const activitiesRef = useRef([]);
  const activityTimerRef = useRef(null);
  const sessionMascot = useMascotPreference();
  function clearOpeningMicFallback() {
    openingMicFallbackRef.current?.cancel();
    openingMicFallbackRef.current = null;
  }
  function startOpeningMicFallbackNow() {
    const fallback = openingMicFallbackRef.current;
    if (!fallback) return false;
    if (!fallback.start()) {
      openingMicFallbackRef.current = null;
      return false;
    }
    fallback.cancel();
    openingMicFallbackRef.current = null;
    return true;
  }
  useEffect(() => {
    if (LEGACY_STREAMING || !window.visualViewport) return undefined;
    const viewport = window.visualViewport;
    const update = () => setKeyboardInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  useEffect(() => {
    if (LEGACY_STREAMING) return undefined;
    let cancelled = false;
    loadPage(bookId).then((page) => {
      if (cancelled || !page || pageRef.current?.updatedAt >= page.updatedAt) return;
      pageRef.current = page;
      snapBase64Ref.current = page.base64;
      snapCountRef.current = page.page;
      setSnapshot(page);
      if (Date.now() - page.updatedAt > RESUME_WINDOW_MS) setRestorePrompt(true);
    }).catch((error) => notify(`Saved page could not be loaded: ${error.message}`, "error"));
    return () => { cancelled = true; };
  }, [bookId]);
  useEffect(() => {
    if (!book?.title || book.coverImage) return undefined;
    let cancelled = false;
    fetch(apiUrl("/api/book-cover"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: book.title, author: book.authorName || "" }),
    }).then(async (response) => {
      if (!response.ok) return null;
      return response.json();
    }).then((cover) => {
      if (cancelled || !cover?.dataUrl) return;
      setLookedUpCover({ bookId, dataUrl: cover.dataUrl });
      library.updateBookMeta(bookId, { coverImage: cover.dataUrl, coverUrl: cover.coverUrl || "" });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [bookId, book?.title, book?.authorName, book?.coverImage]);
  useEffect(() => {
    const t0 = Date.now();
    let countedSeconds = 0;
    const id = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - t0) / 1000);
      setElapsed(elapsedSeconds);
      const deltaSeconds = elapsedSeconds - countedSeconds;
      countedSeconds = elapsedSeconds;
      if (deltaSeconds > 0 && onUsageSecondRef.current?.(deltaSeconds) <= 0) {
        clearInterval(id);
        const stopping = handleEndRef.current?.();
        if (stopping) void stopping.finally(() => onDailyLimitRef.current?.());
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!ghostToast) return undefined;
    const id = setTimeout(() => setGhostToast(false), 3500);
    return () => clearTimeout(id);
  }, [ghostToast]);
  const micLevelRef = useRef(0);
  const speakingNowRef = useRef(false);
  const outputLevelRef = useRef(0);
  const openerSavedRef = useRef(false);
  const contRef = useRef(null);
  const orbLevelRef = useRef(0);
  const darkFramesRef = useRef(0);
  const lastDarkNoteRef = useRef(0);
  const clientRef = useRef(null);
  const audioCaptureRef = useRef(null);
  const audioPlaybackRef = useRef(null);
  const cameraRef = useRef(null);
  const userTurnBufRef = useRef("");
  const userTurnCountRef = useRef(0);
  const lastUserTurnRef = useRef("");
  const pendingVocabularyRef = useRef(null);
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const pendingDeletionRef = useRef(null);
    const pendingPracticeRef = useRef(null);
    const vocabSavedCountRef = useRef(0);
    const lastPracticePromptAtRef = useRef(0);
  const companionTurnBufRef = useRef("");
  const turnActedRef = useRef(false);
  const chapterNumberRef = useRef(book?.currentChapterNumber || 1);
  const videoEl = useRef(null);
  const canvasEl = useRef(null);

  const endingRef = useRef(false);
  const prevSpeakingRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const sleepStateRef = useRef("active");
  // useEffect(() => {
  //   if (!import.meta.env.DEV) return undefined;
  //   const id = setInterval(() => {
  //     const s = clientRef.current?.stats;
  //     if (s) setDbg(`sent ${s.sent} · got ${s.recv} · heard ${s.heard} · mic ${micLevelRef.current.toFixed(2)}${s.err ? " · ERR " + s.err : ""}`);
  //   }, 1000);
  //   return () => clearInterval(id);
  // }, []);
  useEffect(() => {
    library.endSession(bookId);
    void connectSession();
    library.touch(bookId);
    library.startSession(bookId);
    profileStore.markActiveToday();
    lastActivityRef.current = Date.now();

    const sleepInterval = setInterval(() => {
      if (endingRef.current) return;
      const idleMs = Date.now() - lastActivityRef.current;
      if (!LEGACY_STREAMING) return;
      if (sleepStateRef.current === "active" && idleMs > SILENCE_CHECK_MS) {
        sleepStateRef.current = "checking";
        setSleepState("checking");
        lastActivityRef.current = Date.now() - (SILENCE_CHECK_MS - SILENCE_SHUTDOWN_MS);
        setStatus("Checking in...");
        clientRef.current?.sendText("[SYSTEM NOTE] Kaafi der se reader ne kuch nahi bola - ho sakta hai so gaye hon. Ek chhota, dheema check-in karo Hinglish mein.");
      } else if (sleepStateRef.current === "checking" && idleMs > SILENCE_SHUTDOWN_MS) {
        quietShutdown();
      }
    }, 15000);

    return () => {
      clearInterval(sleepInterval);
      sessionAudioMuteRef.current?.dispose();
      sessionAudioMuteRef.current = null;
      clearTimeout(followTimerRef.current);
      clearTimeout(quietModeTimerRef.current);
      clearTimeout(activityTimerRef.current);
      clearInterval(snapTimerRef.current);
      clearTimeout(warmTimerRef.current);
      micGateRef.current?.reset();
      clientRef.current?.close();
      audioPlaybackRef.current?.close();
      audioCaptureRef.current?.stop();
      cameraRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (endingRef.current && prevSpeakingRef.current && !speaking) handleEnd();
    prevSpeakingRef.current = speaking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaking]);

  function scheduleWarmClose() {
    clearTimeout(warmTimerRef.current);
    setStatus("Listening for your question");
  }

  function ensureConnected({ silent = false } = {}) {
    if (mutedRef.current && !sessionAudioMuteRef.current?.isUnmuting()) return Promise.reject(new Error("Microphone is muted."));
    const client = clientRef.current;
    if (!client) return Promise.reject(new Error("Voice is still starting. Try again in a moment."));
    if (client.ready || client.session) return Promise.resolve();
    if (!connectionPromiseRef.current) {
      if (!LEGACY_STREAMING) {
        client.baseConfig.systemInstruction = { parts: [{ text: buildLiveContext() }] };
      }
      if (!silent) setStatus("Connecting for your question...");
      connectionPromiseRef.current = client.connect(client.resumptionHandle).catch((error) => {
        if (!silent) {
          setStatus("Voice unavailable");
          notify(friendlyErrorMessage(error, "Voice connect nahi hua. Dobara poochiye."), "error");
        }
        throw error;
      }).finally(() => { connectionPromiseRef.current = null; });
    }
    return connectionPromiseRef.current;
  }

  async function warmSessionAfterUnmute() {
    await ensureConnected({ silent: true });
    if (!mutedRef.current) setStatus("Listening for your question");
  }

  function armFollowUp() {
    if (mutedRef.current) return;
    clearTimeout(followTimerRef.current);
    clearTimeout(quietModeTimerRef.current);
    followTimerRef.current = setTimeout(() => {
      if (!askingRef.current) return;
      if (questionInFlightRef.current || audioPlaybackRef.current?.isActuallyPlaying?.() || clientRef.current?.pendingTool) {
        armFollowUp();
        return;
      }
      endAskNow();
    }, FOLLOWUP_MIC_MS);
  }

  function endAskNow() {
    askingRef.current = false;
    clearTimeout(followTimerRef.current);
    setAsking(false);
    enterQuietReadingMode();
  }

  function enterQuietReadingMode() {
    if (mutedRef.current) return;
    readingModeRef.current = true;
    setStatus("Quiet reading · still listening");
    void clientRef.current?.sendSilentContext("[SYSTEM NOTE] The reader has been quiet for the follow-up window or explicitly asked for quiet. Continue listening without speaking; answer only a new direct request, greeting, or companion-name address.")
      .catch((error) => console.warn("[VOICE] quiet-mode context update failed", error?.message || error));
  }

  function armQuietMode() {
    if (mutedRef.current) return;
    clearTimeout(quietModeTimerRef.current);
    quietModeTimerRef.current = setTimeout(() => {
      if (askingRef.current || audioPlaybackRef.current?.isActuallyPlaying?.() || clientRef.current?.pendingTool) {
        armQuietMode();
        return;
      }
      enterQuietReadingMode();
    }, 10_000);
  }

  function startAsk() {
    if (LEGACY_STREAMING || asking || mutedRef.current || muted || restorePrompt || snapBusy) return;
    if (!audioCaptureRef.current?.stream) {
      notify("Mic ready nahi hai. Permission allow karke dobara try kijiye.", "error");
      return;
    }
    clearTimeout(warmTimerRef.current);
    askingRef.current = true;
    setAsking(true);
    questionInFlightRef.current = true;
    markActive();
    audioPlaybackRef.current?.clear();
    micGateRef.current?.start();
    armFollowUp();
    void ensureConnected().catch(() => {
      askingRef.current = false;
      clearTimeout(followTimerRef.current);
      micGateRef.current?.reset();
      questionInFlightRef.current = false;
      setAsking(false);
    });
  }

  function stopAsk() {
    if (LEGACY_STREAMING) return;
    endAskNow();
    setStatus("Ready for the next question");
  }

  function toggleAsk() {
    triggerLightTap();
    if (muted) {
      notify("Voice abhi unavailable hai. Upar ke notice se Retry connection dabaiye.", "info");
      return;
    }
    if (asking) stopAsk(); else startAsk();
  }

  function stopAutoListen() {
    vadGenerationRef.current += 1;
    vadStartingRef.current = false;
    classifyAbortRef.current?.abort();
    classifyAbortRef.current = null;
    pageVerificationAbortRef.current?.abort();
    pageVerificationAbortRef.current = null;
    const vad = vadRef.current;
    vadRef.current = null;
    if (vad) void vad.destroy().catch((error) => console.warn("[VAD] cleanup failed", error));
    micGateRef.current?.reset();
    setHandsFree(false);
  }

  async function startAutoListen() {
    if (LEGACY_STREAMING || mutedRef.current || vadRef.current || vadStartingRef.current || !audioCaptureRef.current?.stream) return;
    const generation = vadGenerationRef.current;
    vadStartingRef.current = true;
    try {
      const { MicVAD } = await import("@ricky0123/vad-web");
      let startedOverPlayback = false;
      const vad = await MicVAD.new({
        model: "v5",
        baseAssetPath: "/vad/",
        onnxWASMBasePath: "/vad/",
        getStream: async () => audioCaptureRef.current.stream,
        pauseStream: async () => {},
        resumeStream: async () => audioCaptureRef.current.stream,
        onSpeechStart: () => { startedOverPlayback = Boolean(audioPlaybackRef.current?.isActuallyPlaying?.()); },
        onSpeechEnd: (samples) => {
          const overPlayback = startedOverPlayback;
          startedOverPlayback = false;
          void handleAutoSegment(samples, overPlayback);
        },
        onVADMisfire: () => { startedOverPlayback = false; },
      });
      if (mutedRef.current || generation !== vadGenerationRef.current) {
        await vad.destroy();
        return;
      }
      await vad.start();
      if (mutedRef.current || generation !== vadGenerationRef.current) {
        await vad.destroy();
        return;
      }
      vadRef.current = vad;
    } catch (error) {
      console.warn("[VAD] auto-listen unavailable", error);
      notify("Auto-listen start nahi hua. Mic icon dabakar sawaal pooch sakte hain.", "info");
    } finally {
      vadStartingRef.current = false;
    }
  }

  async function handleAutoSegment(samples, duringPlayback) {
    questionEndAtRef.current = performance.now();
    if (mutedRef.current || duringPlayback || askingRef.current || endingRef.current || snapBusyRef.current) return;
    if (audioCaptureRef.current?.muted || audioPlaybackRef.current?.isActuallyPlaying?.()) return;
    const seconds = samples.length / 16000;
    if (seconds < 0.7 || seconds > 15) return;
    // Start connecting early (at most once every 3 minutes) so a real question does not wait for the socket.
    if (Date.now() - lastSpecAtRef.current > 3 * 60 * 1000) {
      lastSpecAtRef.current = Date.now();
      void ensureConnected({ silent: true }).catch(() => {});
    }
    let classification;
    const classificationAbort = new AbortController();
    classifyAbortRef.current?.abort();
    classifyAbortRef.current = classificationAbort;
    try {
      classification = await classifyUtterance(samples, { companionName: profileStore.data.companionName || "", book: book?.title || "", signal: classificationAbort.signal });
    } catch (error) {
      if (error?.name === "AbortError" || mutedRef.current) return;
      console.warn("[AUTO] classify failed", error?.message || error);
      if (Date.now() - classifyNoticeAtRef.current > 30_000) {
        classifyNoticeAtRef.current = Date.now();
        notify("Voice check is temporarily unavailable. Say the companion's name again or tap the mic.", "info", 5000);
      }
      return;
    } finally {
      if (classifyAbortRef.current === classificationAbort) classifyAbortRef.current = null;
    }
    if (mutedRef.current || endingRef.current) return;
    if (classification.reading) {
      readingModeRef.current = true;
      if (askingRef.current) endAskNow();
      setStatus("Ready for the next question");
      return;
    }
    if (!classification.ask || askingRef.current || endingRef.current) return;
    readingModeRef.current = false;
    await openAskFromClip(samples);
  }

  async function openAskFromClip(samples) {
    if (mutedRef.current || askingRef.current) return;
    readingModeRef.current = false;
    clearTimeout(warmTimerRef.current);
    askingRef.current = true;
    setAsking(true);
    questionInFlightRef.current = true;
    firstAudioLoggedRef.current = false;
    markActive();
    audioPlaybackRef.current?.clear();
    try {
      await ensureConnected();
      if (mutedRef.current) {
        askingRef.current = false;
        questionInFlightRef.current = false;
        setAsking(false);
        return;
      }
      const client = clientRef.current;
      for (let i = 0; i < 50 && client && !client.contextReady; i += 1) await new Promise((resolve) => setTimeout(resolve, 100));
      if (!client?.contextReady) throw new Error("voice_not_ready");
      for (const chunk of float32ToPcmChunks(samples)) client.sendAudio(chunk);
      client.endAudio();
      micGateRef.current?.reset();
      micGateRef.current?.start();
      armFollowUp();
    } catch (error) {
      console.warn("[AUTO] could not open question", error?.message || error);
      askingRef.current = false;
      clearTimeout(followTimerRef.current);
      questionInFlightRef.current = false;
      setAsking(false);
      notify("Voice connect nahi hua. Mic icon dabakar dobara poochiye.", "error");
    }
  }
 // eslint-disable-next-line no-unused-vars
  async function toggleHandsFree() {
    if (handsFree) {
      try { await vadRef.current?.destroy(); } catch (error) { console.warn("[VAD] cleanup failed", error); }
      vadRef.current = null;
      micGateRef.current?.end();
      setAsking(false);
      setHandsFree(false);
      return;
    }
    if (mutedRef.current || muted || !audioCaptureRef.current?.stream) {
      notify("Mic ready nahi hai. Mic permission check kijiye.", "error");
      return;
    }
    try {
      const { MicVAD } = await import("@ricky0123/vad-web");
      const generation = vadGenerationRef.current;
      const vad = await MicVAD.new({
        model: "v5",
        baseAssetPath: "/vad/",
        onnxWASMBasePath: "/vad/",
        getStream: async () => audioCaptureRef.current.stream,
        pauseStream: async () => {},
        resumeStream: async () => audioCaptureRef.current.stream,
        onSpeechStart: () => {
          if (mutedRef.current || audioPlaybackRef.current?.isActuallyPlaying?.() || audioCaptureRef.current?.muted || snapBusyRef.current) return;
          clearTimeout(warmTimerRef.current);
          clientRef.current?.startAudio();
          micGateRef.current?.start();
          questionInFlightRef.current = true;
          setAsking(true);
          void ensureConnected().catch(() => { micGateRef.current?.reset(); questionInFlightRef.current = false; setAsking(false); });
        },
        onSpeechEnd: () => {
          if (!micGateRef.current?.active) return;
          micGateRef.current.end();
          setAsking(false);
          scheduleWarmClose();
        },
        onVADMisfire: () => { micGateRef.current?.end(); setAsking(false); },
      });
      if (mutedRef.current || generation !== vadGenerationRef.current) {
        await vad.destroy();
        return;
      }
      await vad.start();
      if (mutedRef.current || generation !== vadGenerationRef.current) {
        await vad.destroy();
        return;
      }
      vadRef.current = vad;
      setHandsFree(true);
      notify("Hands-free on. Reading aloud can trigger a question; switch back to Tap to ask whenever you like.", "info");
    } catch (error) {
      notify(`Hands-free unavailable: ${error.message}`, "error");
    }
  }
// eslint-disable-next-line no-unused-vars
  async function askByTyping(event) {
    event.preventDefault();
    const question = typedQuestion.trim();
    if (!question || textBusy || restorePrompt) return;
    setTextBusy(true);
    markActive();
    try {
      const response = await fetch(apiUrl("/api/reading/ask-text"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          context: `${buildLiveContext().slice(-12000)}\n${buildPageStatusNote(pageRef.current, ghostModeRef.current)}`,
          pageStatus: pageCanBeSentToLive(pageRef.current) ? "verified_book_page" : pageRef.current ? "unverified" : "none",
          verification: pageRef.current?.verification || null,
          transcription: pageRef.current?.verification?.text || "",
          image: pageCanBeSentToLive(pageRef.current) ? pageRef.current.base64 : "",
        }),
      });
      if (!response.ok) throw new Error(response.status === 429 ? "Too many questions right now. Please try later." : "Text answer unavailable. Please retry.");
      const { answer } = await response.json();
      if (!answer) throw new Error("No answer received. Please retry.");
      appendLine("reader", question);
      appendLine("companion", answer);
      setTypedQuestion("");
      setTranscriptOpen(true);
      notify("Text answer ready in Transcript. Saving and editing items needs the voice session.", "info");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setTextBusy(false);
    }
  }

  function appendLine(speaker, text) {
    const cleanText = String(text || "").trim();
    if (!cleanText) return;
    saveTurn(bookId, speaker, cleanText);
    library.beat(bookId);
    setTranscript((t) => [...t.slice(-30), { speaker, text: cleanText }]);
  }
  function markActive() { lastActivityRef.current = Date.now(); sleepStateRef.current = "active"; setSleepState("active"); }

  // the session mascot narrates everything the model quietly does in the background
  function pushActivity(icon, text) {
    const item = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, icon, text, createdAt: new Date().toISOString() };
    const next = [...activitiesRef.current.slice(-7), item];
    activitiesRef.current = next;
    setActivities(next);
    setLiveActivity(item);
    clearTimeout(activityTimerRef.current);
    activityTimerRef.current = setTimeout(() => setLiveActivity(null), 3400);
  }

  function beginGracefulEnd() {
    if (endingRef.current) return;
    endingRef.current = true;
    setStatus("Saying goodnight...");
    audioCaptureRef.current?.setMuted(true);
    clientRef.current?.sendText("[SYSTEM NOTE] Reader ne session khatam karne ko kaha hai - ek chhota warm goodnight Hinglish mein bolo, phir chup ho jao.");
    setTimeout(() => { if (endingRef.current) handleEnd(); }, 8000);
  }
  function quietShutdown() {
    if (endingRef.current) return;
    endingRef.current = true;
    setStatus("Session ending (silence)");
    handleEnd();
  }

  function resendSnapshot() {
    if (!LEGACY_STREAMING) return;
    const client = clientRef.current;
    if (pageCanBeSentToLive(pageRef.current) && client?.ready) void client.sendVideoFrame(pageRef.current.base64).catch((error) => client.recover(error));
  }
  function clearSnapshot() {
    clearInterval(snapTimerRef.current);
    snapTimerRef.current = null;
    snapBase64Ref.current = null;
    pageRef.current = null;
    setSnapshot(null);
    setSnapExpanded(false);
  }
  function openSnapshotPicker() {
    triggerLightTap();
    if (mutedRef.current) { notify("Unmute the microphone before sharing a page photo.", "info"); return; }
    if (snapBusy) return;
    if (!LEGACY_STREAMING && askingRef.current) endAskNow();
    if (LEGACY_STREAMING && !clientRef.current?.ready) {
      notify("Companion abhi connect ho raha hai. Ek pal ruk kar snapshot lijiye.", "info");
      return;
    }
    snapFileRef.current?.click();
  }
  async function handleSnapshotFile(file) {
    if (!file || snapBusyRef.current || mutedRef.current) return;
    try {
      const shot = await prepareSnapshot(file);
      if (mutedRef.current) return;
      if (shot.quality === "blurry") notify("Photo thodi dhundhli lag rahi hai. Zaroorat ho toh dobara le lijiye.", "info", 5200);
      try {
        pageVerificationAbortRef.current?.abort();
        const verificationAbort = new AbortController();
        pageVerificationAbortRef.current = verificationAbort;
        const response = await fetch(apiUrl("/api/reading/verify-page"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: shot.base64 }),
          signal: verificationAbort.signal,
        });
        if (!response.ok) throw new Error(`page_verification_${response.status}`);
        shot.verification = parsePageVerificationResponse(await response.json());
      } catch {
        if (mutedRef.current) return;
        shot.verification = { kind: "unverified", confidence: 0, printedPageNumber: null, language: "unknown", text: "", reason: "" };
      } finally {
        pageVerificationAbortRef.current = null;
      }
      if (mutedRef.current) return;
      if (pageVerificationDecision(shot.verification) === "reject") {
        setRejectedShot({ message: rejectedPageMessage(shot.verification) });
        return;
      }
      if (shot.verification.printedPageNumber && !pageNumberInput.trim()) {
        setPageNumberInput(String(shot.verification.printedPageNumber));
      }
      setPendingShot(shot);
    } catch (e) {
      notify(friendlyErrorMessage(e, "Photo padh nahi paya. Dobara snapshot lijiye."), "error");
    }
  }

  async function commitSnapshot(shot) {
    if (!shot || snapBusy || mutedRef.current) return;
    snapBusyRef.current = true;
    setSnapBusy(true);
    try {
      if (cameraRef.current) stopCameraNow();
      const isNext = Boolean(snapBase64Ref.current);
      const enteredPageNumber = /^\d{1,5}$/.test(pageNumberInput.trim()) ? Number(pageNumberInput.trim()) : null;
      const page = {
        dataUrl: shot.dataUrl,
        base64: shot.base64,
        page: snapCountRef.current + 1,
        pageNumber: enteredPageNumber || shot.verification?.printedPageNumber || null,
        verification: shot.verification,
        updatedAt: Math.max(Date.now(), (pageRef.current?.updatedAt || 0) + 1),
      };
      if (!LEGACY_STREAMING) {
        await savePage(bookId, page);
        setRestorePrompt(false);
      }
      pageRef.current = page;
      snapBase64Ref.current = shot.base64;
      snapCountRef.current = page.page;
      setSnapshot(page);
      if (page.pageNumber) writeLastPage(bookId, page.pageNumber);
      setPageNumberInput("");
      setPendingShot(null);
      const client = clientRef.current;
      if (LEGACY_STREAMING) {
        clearInterval(snapTimerRef.current);
        snapTimerRef.current = setInterval(resendSnapshot, 15000);
        if (pageCanBeSentToLive(page) && client?.ready) void client.sendVideoFrame(shot.base64).catch((error) => client.recover(error));
        setTimeout(() => {
          if (pageCanBeSentToLive(page) && client?.ready) void client.sendVideoFrame(shot.base64).catch((error) => client.recover(error));
        }, 1000);
        setTimeout(() => client?.sendText(buildPageStatusNote(page, ghostModeRef.current)), 500);
      } else if (client?.contextReady) {
        await client.updateContext(async () => {
          await pageProviderRef.current.send(client, page, client.connectionId);
          await client.sendSilentContext(`${buildPageStatusNote(page, ghostModeRef.current)} ${isNext ? "The reader replaced the previous photo; retain established story facts and saved summaries." : "This is the first stored page photo in this session."} Do not reply to this note.`);
        });
      }
      markActive();
    } catch (e) {
      notify(friendlyErrorMessage(e, "Photo padh nahi paya. Dobara snapshot lijiye."), "error");
    } finally {
      snapBusyRef.current = false;
      setSnapBusy(false);
    }
  }

  async function startCameraThenNotify() {
    if (!LEGACY_STREAMING || mutedRef.current) return;
    if (cameraOn || !videoEl.current) return;
    if (snapBase64Ref.current) {
      clearSnapshot();
      clientRef.current?.sendText(SNAPSHOT_OFF_NOTE);
    }
    setCameraOn(true);
    setCameraExpanded(false);
    cameraRef.current = new CameraCapture(
      videoEl.current, canvasEl.current,
      (base64Jpeg) => {
        const client = clientRef.current;
        if (client?.ready) void client.sendVideoFrame(base64Jpeg).catch((error) => client.recover(error));
      },
       (ok, reason) => {
        if (ok) { darkFramesRef.current = 0; return; }
        darkFramesRef.current += 1;
        const now = Date.now();
        if (darkFramesRef.current >= 6 && now - lastDarkNoteRef.current > 90000) {
          lastDarkNoteRef.current = now;
          clientRef.current?.sendText(reason === "blurry"
            ? "[SYSTEM NOTE] Camera ki picture dhundhli hai, focus nahi mil raha. Sirf EK chhoti, saral Hinglish line mein kaho ki phone ko thoda peeche karke ya book ko seedha karke do second ruk jaaye. Reader ka naam mat lo. Picture saaf hone tak dobara mat bolo."
            : "[SYSTEM NOTE] Camera abhi dark/black dikh raha hai. Sirf EK chhoti Hinglish line bolo ki camera dhaka hua ya galat jagah ho sakta hai. Reader ka naam mat lo. Jab tak camera theek na ho, dobara mat bolo.");
        }
      }
    );
    try {
      await cameraRef.current.start();
    } catch (e) {
      setStatus(`Camera error: ${e.message}`);
      setCameraOn(false);
    }
  }
  function stopCameraNow() { cameraRef.current?.stop(); cameraRef.current = null; setCameraOn(false); setCameraExpanded(false); }
  function toggleMute() {
    triggerLightTap();
    const controller = sessionAudioMuteRef.current;
    if (!controller) return;
    if (controller.isUnmuting()) { controller.mute(); return; }
    if (mutedRef.current) {
      const mutedFor = muteStartedAtRef.current == null ? 0 : Date.now() - muteStartedAtRef.current;
      unmuteClassRef.current = mutedFor >= 30_000 ? "cold" : "warm";
      void controller.unmute({ warm: warmSessionAfterUnmute });
    } else controller.mute();
  }
  const onMuteShortcut = useEffectEvent(() => toggleMute());
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key.toLowerCase() !== "m" || event.altKey || event.ctrlKey || event.metaKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable) return;
      event.preventDefault();
      onMuteShortcut();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  function toggleCamera() {
    triggerLightTap();
    if (mutedRef.current) return;
    if (cameraOn) stopCameraNow();
    else startCameraThenNotify();
  }
  function toggleTranscript() { triggerLightTap(); setTranscriptOpen((value) => !value); }
  function resyncCompanion() {
    const recent = transcript.slice(-6).map((line) => `${line.speaker === "reader" ? "Reader" : "Companion"}: ${line.text}`);
    const latestReaderLine = transcript.slice().reverse().find((line) => line.speaker === "reader")?.text || "";
    const report = {
      id: `r-${Date.now()}`,
      type: "issue",
      area: "Reading session",
      severity: null,
      title: "Companion response went off-topic",
      description: `Reader requested a re-sync during ${book?.title || "this book"}, Chapter ${chapterNumberRef.current}.\n\nRecent conversation:\n${recent.join("\n") || "No transcript lines were captured."}`,
      steps: "Use the Re-sync action in the transcript drawer.",
      screenshots: [],
      status: "queued",
      createdAt: new Date().toISOString(),
      reporter: profileStore.data.name || "Reader",
      appVersion: APP_VERSION,
      device: { ua: navigator.userAgent, screen: `${window.innerWidth}x${window.innerHeight}`, lang: navigator.language, theme: profileStore.getTheme(), standalone: window.matchMedia?.("(display-mode: standalone)").matches || false },
    };
    try {
      const existing = JSON.parse(localStorage.getItem("rc_reports") || "[]");
      localStorage.setItem("rc_reports", JSON.stringify([report, ...(Array.isArray(existing) ? existing : [])].slice(0, 25)));
    } catch { notify("Re-sync note save nahi ho paya, lekin companion ko dobara context bhej diya.", "info"); }
    userTurnBufRef.current = "";
    companionTurnBufRef.current = "";
    turnActedRef.current = false;
    const lastContext = latestReaderLine ? `Reader ka last topic: ${JSON.stringify(latestReaderLine)}.` : "Reader ka recent context transcript se dekho.";
    clientRef.current?.sendText(`[SYSTEM NOTE] RE-SYNC: You drifted off the reader's latest topic. Briefly apologize in warm Hinglish, then continue ONLY from this book and chapter: ${book?.title || "unknown book"}, Chapter ${chapterNumberRef.current}. ${lastContext} Use only visible/supplied reading context. If the intended question is unclear, ask one short clarifying question. Do not invent. Do not mention this system note.`);
    notify("Theek kar diya. Dobara poochiye.", "success");
  }
  function toggleGhostMode() {
    const next = !isGhostMode;
    ghostModeRef.current = next;
    setIsGhostMode(next);
    setGhostToast(next);
    triggerSuccess();
    const author = book?.authorType === "Author" && book.authorName?.trim() ? book.authorName.trim() : "the book's known themes";
    clientRef.current?.sendQuietNote(next
      ? `[SYSTEM NOTE] Author's Ghost Mode is ON. Do not reply to this note - stay completely silent now. From the reader's next question, let explanations draw on ${author}'s broad literary perspective while remaining the reader's companion. This is imaginative mode: do not claim to literally be the author, invent personal memories, or fabricate quotations. Keep responses grounded in the actual book and speak naturally in Hinglish.`
      : "[SYSTEM NOTE] Author's Ghost Mode is OFF. Do not reply to this note - stay completely silent now. From the reader's next question, return to your usual warm reading-companion voice and answer plainly in Hinglish.");
  }

  function addVocabularyEntry(entry, chapter = chapterNumberRef.current) {
    const saved = library.addVocab(bookId, chapter, entry);
    if (saved) {
      setSessionStats((stats) => ({ ...stats, words: stats.words + 1 }));
      pushActivity("word", `Naya word save hua: ${entry.term || ""}`);
    }
    return saved;
  }

  function stageDeleteRequest(kind, target) {
    const text = String(target || "").trim();
    const userRequest = lastUserTurnRef.current || "";
    if (/\b(?:delete|remove|erase|wipe)\s+(?:everything|all|all the|all my)|\bdelete all\b|\bsab\s+(?:kuch|delete)|\b(?:all|every)\s+(?:chapter|word|gem|memory|preference)s?\b/i.test(userRequest)) {
      return { status: "refused", message: "Bulk deletion voice se nahi hota. Settings > Delete all my data use kijiye." };
    }
    if (!/\b(?:delete|remove|erase|get rid of|hata|nikal|mitao|mita do)\b/i.test(userRequest)) {
      return { status: "refused", message: "Reader ne delete karne ko nahi kaha. Kuch delete nahi hua." };
    }
    if (pendingDeletionRef.current) return { status: "awaiting_confirmation" };

    function queueDeletion(request) {
      pendingDeletionRef.current = request;
      setPendingDeletion(request);
      return { status: "awaiting_confirmation" };
    }

    const book = library.getBook(bookId);
    let matches = [];
    const normalizedTarget = text.toLowerCase();
    if (kind === "chapter") {
      const chapterMatch = text.match(/(?:chapter|ch\.?|adhyay)\s*(\d+)/i);
      const number = chapterMatch ? Number(chapterMatch[1]) : Number(text);
      const realChapters = library.getChapters(bookId).filter((chapter) => !chapter.isPlaceholder);
      matches = realChapters.filter((chapter) => Number.isInteger(number) && number > 0
        ? chapter.number === number
        : String(chapter.title || "").trim().toLowerCase() === normalizedTarget);
      if (matches.length === 1) {
        const chapter = matches[0];
        const exact = `Chapter ${chapter.number}: ${chapter.title || `Chapter ${chapter.number}`}`;
        const vocabCount = chapter.vocabLog?.length || 0;
        const pages = formatPageRange(chapter) || "pages not set";
        return queueDeletion({
          kind, exact, identity: `${bookId}:chapter:${chapter.number}`,
          consequence: `${vocabCount} saved word(s), summary and ${pages} will be removed. The book and other chapters stay untouched.`,
          remove: () => {
            const outcome = library.deleteChapter(bookId, chapter.number);
            if (outcome.ok && chapterNumberRef.current === chapter.number) {
              chapterNumberRef.current = outcome.currentChapterNumber;
              setChapterNumber(outcome.currentChapterNumber);
            }
            return Boolean(outcome.ok);
          },
        });
      }
    } else if (kind === "vocabulary") {
      matches = Object.values(book?.chapters || {}).flatMap((chapter) => (chapter.vocabLog || [])
        .filter((entry) => String(entry.term || "").trim().toLowerCase() === normalizedTarget)
        .map((entry) => ({ chapterNumber: chapter.number, entry })));
      if (matches.length === 1) {
        const match = matches[0];
        return queueDeletion({ kind, exact: match.entry.term, identity: `${bookId}:vocabulary:${match.chapterNumber}:${match.entry.term}`, consequence: `This saved word will be removed from Chapter ${match.chapterNumber}.`, remove: () => library.deleteVocab(bookId, match.chapterNumber, match.entry.term) });
      }
    } else if (kind === "gem") {
      matches = gemsStore.list().filter((gem) => gem.bookId === bookId && gem.quote.toLowerCase().includes(normalizedTarget));
      if (matches.length === 1) {
        const match = matches[0];
        return queueDeletion({ kind, exact: match.quote, identity: `gem:${match.id}`, consequence: `This saved quote from ${match.bookTitle || "this book"} will be removed.`, remove: () => gemsStore.remove(match.id) });
      }
    } else if (kind === "memory") {
      matches = (memoryStore.memories || []).filter((memory) => memory.text.toLowerCase().includes(normalizedTarget));
      if (matches.length === 1) {
        const match = matches[0];
        return queueDeletion({ kind, exact: match.text, identity: `memory:${match.text}`, consequence: "This saved personal preference will be removed.", remove: () => memoryStore.remove(match.text) });
      }
    }
    if (!matches.length) return { status: "not_found", message: "Exact item nahi mila. Kuch delete nahi hua." };
    const candidates = matches.slice(0, 5).map((item) => kind === "chapter"
      ? `Chapter ${item.number}: ${item.title}`
      : kind === "vocabulary" ? `${item.entry.term} · Chapter ${item.chapterNumber}`
        : kind === "gem" ? item.quote : item.text);
    return { status: "ambiguous", candidates, message: "Ek se zyada match mile. Exact item poochhiye; kuch delete nahi hua." };
  }

  function finishDeleteRequest(confirmed) {
    const pending = pendingDeletionRef.current || pendingDeletion;
    if (!pending) return;
    pendingDeletionRef.current = null;
    setPendingDeletion(null);
    let deleted = false;
    try { deleted = Boolean(confirmed && pending.remove()); } catch (error) { console.warn("[DELETE] local removal failed:", String(error?.message || error).slice(0, 120)); }
    const statusText = deleted ? "deleted" : confirmed ? "not_found" : "cancelled";
    if (deleted) {
      pushActivity("delete", `${pending.kind} delete ho gaya`);
      triggerSuccess();
    }
    clientRef.current?.sendText(`[SYSTEM NOTE] Delete request for ${JSON.stringify(pending.exact)} completed with status ${statusText}. ${deleted ? "It is deleted." : confirmed ? "It was not found, so nothing was removed." : "The reader cancelled, so nothing was removed."} Do not claim any other item changed.`);
    if (deleted) notify("Delete ho gaya.", "success");
  }

  function handleUserTurnText(fullText) {
    fullText = fullText.trim();
    if (!fullText) return;
    appendLine("reader", fullText);
    const pendingVocabulary = pendingVocabularyRef.current;
    if (pendingVocabulary && pendingVocabulary.requestTurn < userTurnCountRef.current) {
      if (VOCAB_DECLINE_TRIGGER.test(fullText) || !VOCAB_CONFIRM_TRIGGER.test(fullText)) {
        pendingVocabularyRef.current = null;
      }
    }
    const pendingPractice = pendingPracticeRef.current;
    if (pendingPractice && pendingPractice.requestTurn < userTurnCountRef.current) {
      const phrase = String(pendingPractice.term || "").trim();
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const exact = phrase && new RegExp(`(^|[^\\p{L}\\p{N}])${escapedPhrase}($|[^\\p{L}\\p{N}])`, "iu").test(fullText);
      if (exact) {
        if (library.markVocabularyPracticed(bookId, pendingPractice.chapter, phrase)) pushActivity("word", `${phrase} ke saath sentence practice hui`);
      } else {
        const variant = findApproxSpokenVariant(phrase, fullText);
        if (variant) {
          library.markVocabularyPracticed(bookId, pendingPractice.chapter, phrase);
          library.recordVocabularyPronunciation(bookId, pendingPractice.chapter, phrase, variant);
          pushActivity("word", `${phrase} ke saath sentence practice hui`);
        }
      }
      pendingPracticeRef.current = null;
    }
    const explicitPersonalMemory = EXPLICIT_MEMORY_TRIGGER.test(fullText) &&
      !SAVE_GEM_TRIGGER.test(fullText) && !NON_MEMORY_CONTENT_TRIGGER.test(fullText);
        if (explicitPersonalMemory && !memorySavedTurnRef.current) {
      fetch(apiUrl("/api/rephrase-memory"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: fullText }) })
        .then((r) => r.json()).then(({ fact }) => fact && memoryStore.add(fact)).catch(() => {});
    }
    memorySavedTurnRef.current = false;
    lastUserTurnRef.current = fullText;
    userTurnCountRef.current += 1;
  }

  function isProbableNoiseGemQuote(quote) {
    if (!quote || typeof quote !== "string") return true;
    const clean = quote.trim();
    if (!clean) return true;
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length < 4) return true;
    const uniqueWords = new Set(words.map((word) => word.toLowerCase()));
    const repeatedRatio = (words.length - uniqueWords.size) / Math.max(words.length, 1);
    if (repeatedRatio > 0.45) return true;
    if (/^(?:hi|hello|hey|hii|yeah|yes|no|ok|okay|thanks|thank you|yaar|bro|bhai|hmm|um|uh)$/i.test(clean)) return true;
    return false;
  }

   async function finalizeSessionArtifacts() {
    const transcriptSnapshot = transcript;
    const currentMemories = memoryStore?.memories || [];
    try {
      const summaryRes = await fetch(apiUrl("/api/compact-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptSnapshot, existingMemories: currentMemories }),
      });
      const summaryJson = await summaryRes.json();
      if (Array.isArray(summaryJson?.facts)) {
        summaryJson.facts.forEach((fact) => memoryStore.add(fact));
      }
    } catch {
      // End-of-session summarization is best-effort and must never block the app.
    }
  }
  async function tryFetchAuthorPortraitInBackground(authorName) {
    if (!authorName || !authorName.trim()) return;
    const current = library.getBook(bookId);
    if (current?.authorPortraits?.some((p) => p.dataUrl)) return;
    try {
      const res = await fetch(apiUrl("/api/author-portrait"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName, bookTitle: book?.title || "" }),
      });
      const data = await res.json();
      if (res.ok && (data?.dataUrl || (data?.portraits || []).some((p) => p.dataUrl))) {
        const list = await Promise.all((data.portraits || []).map(async (p) => ({ name: p.name, dataUrl: p.dataUrl ? await shrinkDataUrl(p.dataUrl) : null })));
        library.updateBookMeta(bookId, { authorPortrait: list.find((p) => p.dataUrl)?.dataUrl || "", authorPortraits: list });
      }
    } catch {
      // silent - Library mein manual retry hai
    }
  }
  async function handleToolCall(toolCall) {
    const responses = [];
    let practicePrompt = null;
    for (const fc of toolCall.functionCalls || []) {
      let result = { status: "ignored" };
      if (fc.name === "log_vocabulary" || fc.name === "save_memory") {
        // The reader's words are transcribed a moment after the tool call arrives, so wait briefly for them.
        for (let i = 0; i < 8 && !userTurnBufRef.current.trim(); i += 1) await new Promise((resolve) => setTimeout(resolve, 150));
      }
      try {
      if (["request_delete", "delete_chapter", "delete_gem", "delete_vocabulary", "delete_memory"].includes(fc.name)) {
        const kind = fc.name === "request_delete" ? fc.args?.kind
          : fc.name === "delete_chapter" ? "chapter"
            : fc.name === "delete_gem" ? "gem"
              : fc.name === "delete_vocabulary" ? "vocabulary" : "memory";
        const target = fc.name === "request_delete" ? fc.args?.target
          : fc.name === "delete_chapter" ? String(fc.args?.chapterNumber || "")
            : fc.name === "delete_gem" ? fc.args?.quoteFragment
              : fc.name === "delete_vocabulary" ? fc.args?.term : fc.args?.factFragment;
        if (!pendingDeletion && !["chapter", "vocabulary", "gem", "memory"].includes(kind)) {
          result = { status: "invalid", message: "Choose one exact chapter, vocabulary word, gem or memory." };
        } else {
          result = stageDeleteRequest(kind, target);
        }
      } else if (fc.name === "save_memory") {
        const fact = fc.args?.fact;
        const currentUserText = userTurnBufRef.current.trim();
        const explicitPersonalMemory = EXPLICIT_MEMORY_TRIGGER.test(currentUserText) &&
          !SAVE_GEM_TRIGGER.test(currentUserText) && !NON_MEMORY_CONTENT_TRIGGER.test(currentUserText);
        result = explicitPersonalMemory && typeof fact === "string" && memoryStore.add(fact)
          ? { status: "saved" }
          : { status: "not_explicitly_requested", message: "Do not save this. Reader memory is only for personal facts they explicitly asked to remember; quotes, gems, book facts, and vocabulary belong elsewhere." };
      if (result.status === "saved") memorySavedTurnRef.current = true;
      } else if (fc.name === "log_vocabulary") {
        const { term, meaning, contextMeaning, example, grammar, pronunciation, usageRegister, synonyms, antonyms, hindiMeaning, odiaMeaning, hindiSentence, odiaSentence, sentence } = fc.args || {};
        const currentUserText = userTurnBufRef.current.trim();
        const currentTurn = userTurnCountRef.current;
        const entry = {
          term,
          meaning,
          contextMeaning,
          example,
          grammar,
          pronunciation,
          usageRegister,
          synonyms,
          antonyms,
          hindiMeaning,
          odiaMeaning,
          hindiSentence,
          odiaSentence,
          sentence,
        };
        const pendingVocabulary = pendingVocabularyRef.current;
        const confirmedPendingWord = pendingVocabulary &&
          pendingVocabulary.requestTurn < currentTurn &&
          String(pendingVocabulary.entry.term || "").toLowerCase() === String(term || "").toLowerCase();
        const directlyRequested = EXPLICIT_VOCAB_SAVE_TRIGGER.test(currentUserText);
        if (confirmedPendingWord && !VOCAB_DECLINE_TRIGGER.test(currentUserText) && VOCAB_CONFIRM_TRIGGER.test(currentUserText)) {
          pendingVocabularyRef.current = null;
          result = addVocabularyEntry(pendingVocabulary.entry, pendingVocabulary.chapter) ? { status: "saved" } : { status: "skipped" };
        } else if (directlyRequested && !VOCAB_DECLINE_TRIGGER.test(currentUserText)) {
          pendingVocabularyRef.current = null;
          result = addVocabularyEntry(entry) ? { status: "saved" } : { status: "skipped" };
          } else if (isShortYes(currentUserText) && !VOCAB_DECLINE_TRIGGER.test(currentUserText)) {
          pendingVocabularyRef.current = null;
          result = addVocabularyEntry(entry) ? { status: "saved" } : { status: "skipped" };
        } else if (confirmedPendingWord && VOCAB_DECLINE_TRIGGER.test(currentUserText)) {
          pendingVocabularyRef.current = null;
          result = { status: "declined" };
        } else {
          pendingVocabularyRef.current = { entry, chapter: chapterNumberRef.current, requestTurn: currentTurn };
          result = {
            status: "needs_confirmation",
                        message: "Not saved yet. Quietly ask the reader ONE short, natural question whether to save this word. Never mention a system, an app check or a confirmation. If they say yes in any language, call log_vocabulary again immediately.",
          };
        }
      } else if (fc.name === "update_chapter_summary") {
        const summary = fc.args?.summary;
        if (typeof summary === "string") { library.updateChapterSummary(bookId, chapterNumberRef.current, summary); result = { status: "saved" }; }
      } else if (fc.name === "set_current_chapter") {
        const num = Number(fc.args?.chapterNumber);
        const justification = fc.args?.justification;
        const title = fc.args?.title;
        if (!Number.isFinite(num) || num < 1) {
          result = { status: "invalid" };
        } else {
          const outcome = library.setCurrentChapter(bookId, num, justification, title);
          if (outcome.ok) { chapterNumberRef.current = num; setChapterNumber(num); result = { status: "saved" }; }
          else if (outcome.needsJustification) result = { status: "needs_justification", message: "This jumps ahead of the current chapter - ask the reader why, then call again with their reason as justification." };
          else result = { status: "skipped" };
        }
      } else if (fc.name === "rename_chapter") {
        const num = Number(fc.args?.chapterNumber);
        const title = fc.args?.title;
        if (Number.isFinite(num) && title) { library.renameChapter(bookId, num, title); result = { status: "saved" }; }
        else result = { status: "invalid" };
      } else if (fc.name === "set_book_author") {
        const authorName = fc.args?.authorName;
        const authorBio = fc.args?.authorBio;
        if (typeof authorName === "string" && authorName.trim()) {
          library.updateBookMeta(bookId, { authorName, authorBio: typeof authorBio === "string" ? authorBio : undefined });
          tryFetchAuthorPortraitInBackground(authorName);
          result = { status: "saved" };
        } else {
          result = { status: "invalid" };
        }
      } else if (fc.name === "set_chapter_pages") {
        const num = Number(fc.args?.chapterNumber);
        const startPage = Number(fc.args?.startPage);
        const endPage = Number(fc.args?.endPage);
        if (Number.isFinite(num)) {
          library.setChapterPages(bookId, num, Number.isFinite(startPage) ? startPage : undefined, Number.isFinite(endPage) ? endPage : undefined);
          result = { status: "saved" };
        } else {
          result = { status: "invalid" };
        }
      } else if (fc.name === "save_gem") {
        const { quote, takeawaySituation, takeawaySteps, takeawayExample, takeawayWhyItMatters, authorName, authorBio } = fc.args || {};
        const cleanQuote = typeof quote === "string" ? quote.trim() : "";
        const finalAuthorName = (typeof authorName === "string" && authorName.trim()) ? authorName.trim() : (book?.authorName || "");
        if (!cleanQuote || isProbableNoiseGemQuote(cleanQuote)) {
          result = { status: "needs_confirmation", message: "I need the exact quote or line from the book before saving it as a gem. Please confirm the exact text or repeat the line clearly." };
        } else {
          const saved = gemsStore.add({
            quote: cleanQuote,
            takeawaySituation,
            takeawaySteps,
            takeawayExample,
            takeawayWhyItMatters,
            bookTitle: book?.title,
            bookId: bookId,
            chapter: chapterNumberRef.current,
            chapterNumber: chapterNumberRef.current,
            authorName: finalAuthorName,
            attributedTo: finalAuthorName,
            quoteSource: (typeof authorBio === "string" && authorBio.trim()) ? authorBio.trim() : (book?.authorBio || ""),
          });
          if (saved) void ensureGemInsights([saved], (id, insight) => gemsStore.updateInsight(id, insight)).catch(() => {});
          result = saved ? { status: "saved" } : { status: "skipped" };
        }
      }else if (fc.name === "set_chapter_outline") {
        const saved = library.setChapterOutline(bookId, fc.args?.chapters);
        result = saved > 0 ? { status: "saved", chaptersSaved: saved } : { status: "invalid" };
      }else if (fc.name === "get_reading_status") {
        const b = library.getBook(bookId);
        const all = library.getChapters(bookId);
        const real = all.filter((c) => !c.isPlaceholder);
        const cur = b?.chapters?.[chapterNumberRef.current];
        result = {
          status: "ok",
          now: describeNow(),
          currentChapter: chapterNumberRef.current,
          totalKnownChapters: all.length,
          completedChapters: real.filter(isChapterClosed).length,
          currentChapterStatus: cur && isChapterClosed(cur) ? "completed" : "in_progress",
          currentChapterStartPage: cur?.startPage ?? null,
          currentChapterEndPage: cur?.endPage ?? null,
          wordsLoggedThisChapter: cur?.vocabLog?.length || 0,
          summaryCharacters: cur?.summary ? cur.summary.length : 0,
          chapters: real.slice(0, 60).map((c) => ({ number: c.number, title: c.title, status: isChapterClosed(c) ? "completed" : "open", startPage: c.startPage, endPage: c.endPage })),
        };
      } else if (fc.name === "get_session_activity") {
        result = {
          status: "ok",
          activities: activitiesRef.current.map(({ text, createdAt }) => ({ text, createdAt })),
        };
      } else if (fc.name === "complete_chapter") {
        const num = Number(fc.args?.chapterNumber) || chapterNumberRef.current;
        const endPage = Number(fc.args?.endPage);
        const why = typeof fc.args?.justification === "string" ? fc.args.justification.trim() : "";
        const outcome = library.completeChapter(bookId, num, why);
        if (outcome.ok) {
          if (Number.isFinite(endPage)) library.setChapterPages(bookId, num, undefined, endPage);
          result = { status: "completed", closedEarly: outcome.early };
        } else if (outcome.needsJustification) {
          result = { status: "needs_justification", message: "Little of this chapter has been covered. Gently ask the reader why they want to close it now, then call complete_chapter again with their reason as justification." };
        } else {
          result = { status: "invalid" };
        }
      }
      else if (fc.name === "list_saved_items") {
        const kind = fc.args?.kind;
        if (kind === "gems") {
          const all = fc.args?.scope === "all";
          const gems = gemsStore.list().filter((g) => all || g.bookId === bookId);
          result = { status: "ok", count: gems.length, items: gems.slice(0, 30).map((g) => ({ quote: g.quote.slice(0, 220), book: g.bookTitle, chapter: g.chapterNumber })) };
        } else if (kind === "vocabulary") {
          const items = [];
          Object.values(library.getBook(bookId)?.chapters || {}).forEach((ch) =>
            (ch.vocabLog || []).forEach((v) => items.push({ term: v.term, meaning: v.meaning, chapter: ch.number })));
          result = { status: "ok", count: items.length, items: items.slice(-40) };
        } else if (kind === "memory") {
          const items = (memoryStore.memories || []).map((m) => m.text);
          result = { status: "ok", count: items.length, items };
        } else {
          result = { status: "invalid" };
        }
      } else if (fc.name === "update_memory") {
        const frag = (fc.args?.oldFragment || "").trim().toLowerCase();
        const newText = (fc.args?.newText || "").trim();
        const match = frag ? (memoryStore.memories || []).find((m) => m.text.toLowerCase().includes(frag)) : null;
        result = match && newText && memoryStore.update(match.text, newText)
          ? { status: "saved" }
          : { status: "not_found", message: "No saved memory matched - tell the reader honestly." };
      }
      responses.push({ id: fc.id, name: fc.name, response: result });
          } catch (err) {
        console.warn("[TOOL] failed", fc.name, err);
        result = { status: "error", message: "That could not be saved. Tell the reader briefly and carry on." };
      } if (result.status === "saved") {
                if (fc.name === "log_vocabulary") {
                  vocabSavedCountRef.current += 1;
                  const now = Date.now();
                  if (vocabSavedCountRef.current % 3 === 0 && now - lastPracticePromptAtRef.current >= 10 * 60 * 1000) {
                    practicePrompt = String(fc.args?.term || "").trim();
                    if (practicePrompt) {
                      lastPracticePromptAtRef.current = now;
                      pendingPracticeRef.current = { term: practicePrompt, chapter: chapterNumberRef.current, requestTurn: userTurnCountRef.current };
                    }
                  }
        }
        if (fc.name === "save_gem") {
          setSessionStats((s) => ({ ...s, gems: s.gems + 1 }));
          triggerSuccess();
          pushActivity("gem", "Gem save ho gaya");
        } else if (fc.name === "save_memory") pushActivity("memory", "Preference yaad kar li");
        else if (fc.name === "set_book_author") pushActivity("author", `Author save ho gaya: ${fc.args?.authorName || ""}`);
        else if (fc.name === "set_current_chapter") pushActivity("chapter", `Chapter ${fc.args?.chapterNumber} shuru`);
        else if (fc.name === "rename_chapter") pushActivity("rename", `Chapter ${fc.args?.chapterNumber} ka naam mila`);
        else if (fc.name === "set_chapter_pages") pushActivity("pages", `Chapter ${fc.args?.chapterNumber} ke pages note kiye`);
        else if (fc.name === "update_chapter_summary") pushActivity("summary", "Chapter ki notes update hui");
        else if (fc.name === "set_chapter_outline") pushActivity("outline", "Poori chapter list save hui");
        else if (fc.name === "update_memory") pushActivity("memory", "Memory update hui");
      } else if (result.status === "completed") {
        pushActivity("done", `Chapter ${fc.args?.chapterNumber || chapterNumberRef.current} complete!`);
      } else if (result.status === "deleted") {
        if (fc.name === "delete_chapter") pushActivity("delete", `Chapter ${fc.args?.chapterNumber} delete ho gaya`);
        if (fc.name === "delete_gem") pushActivity("delete", "Gem delete ho gaya");
        else if (fc.name === "delete_vocabulary") pushActivity("delete", `Word hata diya: ${fc.args?.term || ""}`);
        else if (fc.name === "delete_memory") pushActivity("delete", "Ek memory delete hui");
      }
    }
    if (responses.length) await clientRef.current?.sendToolResponse(responses);
    if (practicePrompt) {
      clientRef.current?.sendText(`[SYSTEM NOTE] You just saved the word ${JSON.stringify(practicePrompt)} after explaining it. As a low-pressure optional next step, casually invite the reader to make one short sentence with that word in their own words. Do not make it a quiz, do not grade, and if they skip or change the topic, move on warmly.`);
    }
  }

   useEffect(() => {
    let rafId = 0;
    const tick = () => {
      audioPlaybackRef.current?.poke();
      const micLevel = micLevelRef.current;
      const outputLevel = outputLevelRef.current;
      const listening = !speaking && (LEGACY_STREAMING || micGateRef.current?.active) && micLevel > 0.04;
      const reconnecting = /reconnect|resum|connecting/i.test(status);
      const orbMode = reconnecting ? "reconnecting" : speaking ? "speaking" : listening ? "listening" : "idle";
      const live = speaking ? outputLevel : LEGACY_STREAMING || micGateRef.current?.active ? micLevel : 0;
      setOrbVisual((p) => (p.orbMode === orbMode ? p : { ...p, orbMode }));
      orbLevelRef.current = live;
      setMeterLevel((p) => (Math.abs(p - live) > 0.04 ? live : p));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [speaking, status]);

  function buildLiveContext() {
    const latestBook = library.getBook(bookId);
    const memoryContext = memoryStore.promptContext();
    const ctx = library.getModelContext(bookId);
    const currentChapter = latestBook?.chapters?.[ctx?.currentChapterNumber];
    const placeholderChapter = isPlaceholderChapter(currentChapter);
    const chapterKnowledge = placeholderChapter
      ? buildPlaceholderChapterKnowledgeBlock({ chapterNumber: ctx.currentChapterNumber, bookTitle: latestBook?.title, authorName: latestBook?.authorName })
      : ctx.recentChapters.length
        ? "Recent chapters: " + ctx.recentChapters.map((c) => `Ch.${c.number} "${c.title}": ${c.summary}`).join(" ")
        : "This is the first chapter - no recap needed.";
    const pageInfo = currentChapter?.startPage
      ? ` Currently known to start at page ${currentChapter.startPage}${currentChapter.endPage ? `, ended at page ${currentChapter.endPage}` : ""}.`
      : "";
    const knownChapters = library.getChapters(bookId).filter((chapter) => !chapter.isPlaceholder).length;
    const bookCreditName = latestBook?.authorName?.trim();
    const bookCreditType = latestBook?.authorType || "Author";
    const authorLine = bookCreditName && bookCreditType === "Author"
      ? ` Reader note: Author ${bookCreditName}. ${latestBook.authorBio ? `Brief context: ${latestBook.authorBio}` : "The author bio is not saved yet: do NOT ask the reader for it. If you are sure of it from your own knowledge, quietly call set_book_author with the full name and a short bio, otherwise say nothing."} This book was set up by the app, so NEVER ask the reader for the author's details${knownChapters > 1 ? " or for the table of contents (the chapter list is already saved)" : ""}.`
      : bookCreditName
        ? ` Reader note: The saved book credit is ${bookCreditType === "Multiple authors" ? "contributors" : bookCreditType.toLowerCase()} ${bookCreditName}. Do not relabel it as a single author or ask the reader to repeat the credit.`
        : " No book-level author credit was provided. Do not ask the reader to repeat onboarding; answer from the saved chapter and visible page context without inventing an author.";
    const timeGapText = latestBook && latestBook.sessionCount > 0 ? describeTimeGap(latestBook.lastReadAt) : null;
    const timingLine = timeGapText
      ? ` The reader last opened this book ${timeGapText}.`
      : " This is the reader's very first session with this book.";
    const bookContext = latestBook
      ? `\n\nBook: '${latestBook.title}'. Currently on Chapter ${ctx.currentChapterNumber}.${timingLine}${pageInfo}` +
        authorLine +
        (ctx.overview ? ` ${ctx.overview}` : "") +
        (ctx.recentChapters.length ? " Recent chapters: " + ctx.recentChapters.map((c) => `Ch.${c.number} "${c.title}": ${c.summary}`).join(" ") : " This is the first chapter - no recap needed.")
      : "";
    const groundedBookContext = groundPlaceholderBookContext(bookContext, placeholderChapter, chapterKnowledge);
    const chapterList = library.getChapters(bookId);
const closedCount = chapterList.filter((c) => !c.isPlaceholder && isChapterClosed(c)).length;
const curCh = latestBook?.chapters?.[ctx?.currentChapterNumber];
const progressLine = latestBook
  ? `\n\nReading progress: ${closedCount} of ${chapterList.length} known chapters are marked completed. Chapter ${ctx.currentChapterNumber} is ${curCh && isChapterClosed(curCh) ? "already completed" : "in progress"}; pages ${curCh?.startPage ?? "?"} to ${curCh?.endPage ?? "?"}; ${curCh?.vocabLog?.length || 0} words logged; summary is ${curCh?.summary ? curCh.summary.length : 0} characters long.`
  : "";
const pd = profileStore.data;
const profileLine = `\n\nReader profile: the reader's name is ${pd.name}.` +
  (pd.companionName ? ` The reader calls you "${pd.companionName}" - that is your name.` : "") +
  (pd.preferences?.length ? ` Favourite kinds of books: ${pd.preferences.join(", ")}.` : "") +
  (pd.dailyGoal ? ` Daily reading goal: ${pd.dailyGoal}.` : "") +
  " Use the reader's name very sparingly.";
const cont = library.getContinuity(bookId);
contRef.current = cont;
const contLine = cont
  ? `\n\nSESSION CONTINUITY: the reader's previous session on this book ended ${describeTimeGap(cont.endedAt)} (it lasted about ${cont.durationMin} min; they were on chapter ${cont.chapter}; ${cont.wordsLearned} new words were logged). ` +
    (cont.minutesAgo < 45
      ? "This is a QUICK RETURN in the same sitting: never greet like a fresh start, never ask what they will read today, just pick up naturally."
      : cont.minutesAgo < 720
        ? "Same day, later: welcome back and mention where they stopped."
        : "A new day: greet freshly but refer to where they last stopped.")
  : "\n\nSESSION CONTINUITY: this is the reader's very first session on this book.";
const recap = getRecap(bookId);
const recapLine = recap ? `\n\nRECENT CONVERSATION with this reader (earlier, for continuity only; do not repeat it, just carry on naturally):\n${recap}` : "";
    const trackedPage = pageRef.current?.pageNumber || readLastPage(bookId);
    const pageTrackLine = trackedPage ? `\n\nPAGE HISTORY: the reader last explicitly recorded printed page ${trackedPage}. This is not proof that the current photo is page ${trackedPage}, nor that every earlier page was read or later page unread. Use the latest photo and the reader's current statement as evidence; never infer page contents or reading progress from this number alone.` : "";
    const snapshotContinuityLine = "\n\nSTORY CONTINUITY: replacing a page photo removes only access to the old image and its visible text. Retain established plot facts, saved chapter summaries, and earlier page references from this context; clearly distinguish remembered summaries from text currently visible in the latest photo.";
    const voicePolicy = LEGACY_STREAMING ? "" : `\n\nVOICE LISTENING POLICY: The microphone stays open throughout this reading session. The reader may read aloud; that is not a request for a reply. Do not interrupt or respond to book text, pauses, or background speech. Give the brief opening once, then remain silent unless the reader clearly asks you a question/request, greets you, or addresses you by ${profileStore.data.companionName || "your companion name"}. If they say they are going to read, are reading, or ask you not to interrupt, enter quiet reading mode and stay silent while continuing to listen. Leave quiet mode only when they clearly address you or ask a direct question (including Hindi/Hinglish such as 'iska matlab kya hai', 'samjhao', or 'achha ye batao'). After answering, listen for follow-ups; never announce that listening has stopped. Current quiet-reading state: ${readingModeRef.current ? "ON" : "OFF"}.`;
    return (LEGACY_STREAMING ? READER_PROFILE : SNAPSHOT_READER_PROFILE) + "\n\n" + buildTimeLine() + profileLine + groundedBookContext + progressLine + pageTrackLine + snapshotContinuityLine + contLine + recapLine + (memoryContext ? `\n\n${memoryContext}` : "") + voicePolicy;
    }

  async function connectSession() {
    const systemInstructionText = buildLiveContext();
    const systemInstruction = { parts: [{ text: systemInstructionText }] };

    audioPlaybackRef.current = new AudioPlayback(
      (isPlaying) => { speakingNowRef.current = isPlaying; setSpeaking(isPlaying); },
      (level) => { outputLevelRef.current = Math.min(1, Number(level) || 0); }
    );

    clientRef.current = new GeminiLiveClient({
      modelName: MODEL_NAME,
      fallbackModelName: FALLBACK_MODEL_NAME,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: profileStore.data.voice || "Leda" } } },
        systemInstruction,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
            endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
            prefixPaddingMs: 300,
            silenceDurationMs: 900,
                    },
        },
        tools: [{ functionDeclarations: [SAVE_MEMORY_DECLARATION, LOG_VOCABULARY_DECLARATION, UPDATE_CHAPTER_SUMMARY_DECLARATION, SET_CURRENT_CHAPTER_DECLARATION, RENAME_CHAPTER_DECLARATION, SET_BOOK_AUTHOR_DECLARATION, SET_CHAPTER_PAGES_DECLARATION, SAVE_GEM_DECLARATION, REQUEST_DELETE_DECLARATION, DELETE_CHAPTER_DECLARATION, DELETE_GEM_DECLARATION, DELETE_VOCABULARY_DECLARATION, DELETE_MEMORY_DECLARATION, UPDATE_MEMORY_DECLARATION, LIST_SAVED_ITEMS_DECLARATION, GET_READING_STATUS_DECLARATION, GET_SESSION_ACTIVITY_DECLARATION, COMPLETE_CHAPTER_DECLARATION,SET_CHAPTER_OUTLINE_DECLARATION,] }],
      },
      handlers: {
        onStatus: (s) => {
          if (mutedRef.current) return;
          setStatus(!LEGACY_STREAMING && s === "connected" && !askingRef.current ? "Listening for your question" : s);
          if (!LEGACY_STREAMING && questionInFlightRef.current && (/^reconnecting/.test(s) || s === "switching to backup model")) {
            questionInFlightRef.current = false;
            micGateRef.current?.reset();
            setAsking(false);
            notify("Voice connection interrupted the question. Please ask again or type it below.", "error");
          }
          if (LEGACY_STREAMING && s === "connected" && snapBase64Ref.current) {
            setTimeout(() => { resendSnapshot(); clientRef.current?.sendText(buildPageStatusNote(pageRef.current, ghostModeRef.current)); }, 600);
          }
        },
        onReady: async (connectionId) => {
          if (LEGACY_STREAMING || mutedRef.current) return;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const page = pageRef.current;
            if (page) {
              await pageProviderRef.current.send(clientRef.current, page, connectionId);
              await clientRef.current.sendSilentContext(`${buildPageStatusNote(page, ghostModeRef.current)} The book, chapter, memories and reading history are in your instructions. Wait for the reader's question.`);
            } else {
              await clientRef.current.sendSilentContext(`${buildPageStatusNote(null, ghostModeRef.current)} You know only the book, chapter, memories and reading history in your instructions. Wait for the reader's question.`);
            }
            if (pageRef.current?.updatedAt === page?.updatedAt) {
              if (clientRef.current?.hasOpenedOnce && !micGateRef.current?.active) micGateRef.current?.start();
              return;
            }
          }
          throw new Error("Page changed while connecting. Please retry your question.");
        },
        onUsage: (usage) => {
          usageRef.current = [...usageRef.current.slice(-29), usage];
          console.info("[READING_USAGE]", usage);
        },
        onNotice: (notice) => {
          questionInFlightRef.current = false;
          if (sessionAudioMuteRef.current) sessionAudioMuteRef.current.mute();
          else {
            mutedRef.current = true;
            setMuted(true);
            audioCaptureRef.current?.setMuted(true);
            micGateRef.current?.reset();
            stopCameraNow();
            audioPlaybackRef.current?.clear();
          }
          notifyPersistent({
            ...notice,
            action: {
              label: "Retry connection",
              onClick: () => {
                endingRef.current = false;
                void sessionAudioMuteRef.current?.unmute({ warm: () => clientRef.current?.retry() });
              },
            },
          });
        },
        onAudio: (data) => {
          if (mutedRef.current) return;
          if (!LEGACY_STREAMING) clearOpeningMicFallback();
          if (!LEGACY_STREAMING && questionEndAtRef.current && !firstAudioLoggedRef.current) {
            firstAudioLoggedRef.current = true;
            const latencyMs = Math.round(performance.now() - questionEndAtRef.current);
            console.info("[READING_LATENCY] first audio after question", latencyMs, "ms");
            const kind = unmuteClassRef.current;
            if (kind) {
              const samples = [...unmuteLatencySamplesRef.current[kind], latencyMs].slice(-20);
              unmuteLatencySamplesRef.current[kind] = samples;
              const summary = summarizeLatencies(samples);
              console.info(`[READING_LATENCY] ${kind} unmute p50/p95`, { count: summary.count, p50Ms: summary.p50, p95Ms: summary.p95 });
              unmuteClassRef.current = null;
            }
          }
          audioPlaybackRef.current?.enqueue(data);
        },
        onText: (text) => {
          if (mutedRef.current) return;
          if (!LEGACY_STREAMING) clearOpeningMicFallback();
          companionTurnBufRef.current += text;
        },
        onUserText: (text) => {
          if (mutedRef.current) return;
          userTurnBufRef.current += text;
          const intent = classifyVoiceIntent(text, profileStore.data.companionName || "");
          if (intent === "quiet") {
            readingModeRef.current = true;
            clearTimeout(quietModeTimerRef.current);
            audioPlaybackRef.current?.clear();
            if (askingRef.current) endAskNow();
            void clientRef.current?.sendSilentContext("[SYSTEM NOTE] The reader explicitly said they are reading or asked for quiet. Stay silent, keep the microphone stream open, and wait for a direct question or companion-name address.")
              .catch((error) => console.warn("[VOICE] quiet-mode context update failed", error?.message || error));
            setStatus("Quiet reading · still listening");
          } else if (intent === "addressed") {
            readingModeRef.current = false;
            clearTimeout(quietModeTimerRef.current);
            askingRef.current = true;
            setAsking(true);
            questionInFlightRef.current = true;
            clearTimeout(warmTimerRef.current);
            armFollowUp();
          } else {
            if (askingRef.current) armFollowUp();
            else armQuietMode();
          }
          markActive();
          if (!turnActedRef.current) {
            if (END_SESSION_TRIGGER.test(userTurnBufRef.current)) { turnActedRef.current = true; beginGracefulEnd(); }
            else if (LEGACY_STREAMING && CLOSE_CAMERA_TRIGGER.test(userTurnBufRef.current)) { turnActedRef.current = true; stopCameraNow(); }
            else if (LEGACY_STREAMING && OPEN_CAMERA_TRIGGER.test(userTurnBufRef.current)) { turnActedRef.current = true; startCameraThenNotify(); }
          }
        },
        onFirstReady: () => {
          if (mutedRef.current) return;
          const opening = buildOpeningNote(contRef.current);
          if (LEGACY_STREAMING) {
            clientRef.current?.sendText(opening);
            return;
          }
          const pageAvailable = pageCanBeSentToLive(pageRef.current);
          const instructions = pageAvailable
            ? "A page photo is available. If its printed number is clearly visible, read it accurately; otherwise ask for the number only if needed. Do not pretend to see anything not in the photo."
            : pageRef.current
              ? "The last photo is unverified and was not shared with you. In your short opening, warmly ask the reader to share a clear page photo. Do not claim to see or know its contents."
              : "No page photo is available. In your short opening, warmly invite the reader to share a page photo. Do not claim to know what page or passage they are reading.";
          const client = clientRef.current;
          void client?.sendText(`${opening} ${instructions} Give this opening now, then listen.`);
          clearOpeningMicFallback();
          openingMicFallbackRef.current = createOpeningMicFallback({
            gate: micGateRef.current,
            isReady: () => Boolean(clientRef.current?.ready && !endingRef.current),
            onStarted: () => setStatus("Listening for your question"),
          });
        },
        onTurnComplete: () => {
        if (mutedRef.current) return;
        clearOpeningMicFallback();
          questionInFlightRef.current = false;
        if (!LEGACY_STREAMING && !micGateRef.current?.active) micGateRef.current?.start();
        const companionText = companionTurnBufRef.current.trim();
        if (companionText) {
          appendLine("companion", companionText);
          companionTurnBufRef.current = "";
          if (!openerSavedRef.current) { openerSavedRef.current = true; saveOpener(companionText); }
        }
        if (userTurnBufRef.current.trim()) { handleUserTurnText(userTurnBufRef.current.trim()); userTurnBufRef.current = ""; }
        turnActedRef.current = false;
                if (!LEGACY_STREAMING) {
          if (askingRef.current) armFollowUp(); else armQuietMode();
        }
      },
        onInterrupted: () => audioPlaybackRef.current?.clear(),
        onToolCall: (tc) => { if (!mutedRef.current) handleToolCall(tc); },
      },
    });

    micGateRef.current = new SessionMicGate(
      (chunk) => clientRef.current?.sendAudio(chunk),
      () => {
        questionEndAtRef.current = performance.now();
        firstAudioLoggedRef.current = false;
        clientRef.current?.endAudio();
      }
    );
    audioCaptureRef.current = new AudioCapture(
      (base64Pcm) => {
        if (mutedRef.current) return;
        if (LEGACY_STREAMING) {
          const playingNow = audioPlaybackRef.current?.isActuallyPlaying?.() ?? speakingNowRef.current;
          const quiet = playingNow && micLevelRef.current < 0.2;
          clientRef.current?.sendAudio(quiet ? silentChunk(base64Pcm.length) : base64Pcm);
        } else {
                    const playingNow = audioPlaybackRef.current?.isActuallyPlaying?.() ?? speakingNowRef.current;
          const quiet = playingNow && micLevelRef.current < 0.2;
          micGateRef.current?.accept(quiet ? silentChunk(base64Pcm.length) : base64Pcm);
        }
      },
      (level) => {
        micLevelRef.current = Math.min(1, Number(level) || 0);
        if (!LEGACY_STREAMING && micLevelRef.current > 0.22 && !audioCaptureRef.current?.muted) {
          startOpeningMicFallbackNow();
        }
        if (micLevelRef.current > 0.22 && !audioCaptureRef.current?.muted && (LEGACY_STREAMING || micGateRef.current?.active)) clientRef.current?.noteSpeech();
      },
      () => {
        stopAutoListen();
        askingRef.current = false;
        setAsking(false);
        if (!mutedRef.current) void startAutoListen();
      }
    );
    sessionAudioMuteRef.current = new SessionAudioMute({
      capture: audioCaptureRef.current,
      live: clientRef.current,
      micGate: micGateRef.current,
      playback: audioPlaybackRef.current,
      stopAutoListen,
      stopCamera: stopCameraNow,
      onMuted: (nextMuted) => {
        if (nextMuted && !mutedRef.current) muteStartedAtRef.current = Date.now();
        if (!nextMuted) muteStartedAtRef.current = null;
        mutedRef.current = nextMuted;
        setMuted(nextMuted);
        if (nextMuted) {
          askingRef.current = false;
          questionInFlightRef.current = false;
          clearTimeout(followTimerRef.current);
          clearTimeout(quietModeTimerRef.current);
          setAsking(false);
          setStatus("Mic muted");
        } else setStatus(clientRef.current?.ready ? "Listening for your question" : "Reconnecting…");
      },
      onStatus: (nextStatus, error) => {
        if (error) console.warn("[VOICE] muted-session warm failed", error?.message || error);
        setStatus(nextStatus === "reconnecting" ? "Reconnecting…" : nextStatus === "muted" ? "Mic muted" : nextStatus);
      },
      onError: (error) => notify(friendlyErrorMessage(error, "Microphone permission is needed to unmute."), "error"),
    });
    const [conn, mic] = await Promise.allSettled([
      LEGACY_STREAMING ? clientRef.current.connect() : Promise.resolve(),
      audioCaptureRef.current.start(),
    ]);
    if (mutedRef.current) setStatus("Mic muted");
    else if (mic.status === "rejected") setStatus(`Mic error: ${mic.reason?.message || mic.reason}`);
    else if (!LEGACY_STREAMING) {
      setStatus("Listening for your question");
      void ensureConnected({ silent: true }).catch(() => {});
    }
    else if (conn.status === "rejected" && !mutedRef.current) {
      console.warn("[LIVE] initial connection failed", String(conn.reason?.message || conn.reason).slice(0, 160));
      if (/all_keys_unavailable/.test(String(conn.reason?.message))) {
        setStatus("voice service busy - try again later");
        notify(friendlyErrorMessage(conn.reason), "error", 6000);
      } else {
        clientRef.current?.recover(conn.reason);
      }
    }
  }

  async function handleEnd({ restart = false } = {}) {
    clearTimeout(warmTimerRef.current);
    clearOpeningMicFallback();
    micGateRef.current?.reset();
    if (vadRef.current) {
      await vadRef.current.destroy().catch((error) => console.warn("[VAD] cleanup failed", error));
      vadRef.current = null;
    }
    library.endSession(bookId);
    audioCaptureRef.current?.stop();
    audioPlaybackRef.current?.close();
    stopCameraNow();
    await clientRef.current?.close();
    if (restart) {
      await finalizeSessionArtifacts();
      onRestart?.();
    } else {
      onEnd();
      void finalizeSessionArtifacts();
    }
  }
  handleEndRef.current = handleEnd;

    const totalChapters = book ? library.getChapters(bookId).length || 1 : 1;
  const doneCount = book ? library.getChapters(bookId).filter((c) => !c.isPlaceholder && isChapterClosed(c)).length : 0;
  const donePct = Math.round((doneCount / totalChapters) * 100);
  const pathChapters = (() => {
    const real = book ? library.getChapters(bookId).filter((c) => !c.isPlaceholder).map((c) => ({ number: c.number, done: isChapterClosed(c) })) : [];
    if (!real.some((c) => c.number === chapterNumber)) real.push({ number: chapterNumber, done: false });
    real.sort((a, b) => a.number - b.number);
    return { nodes: real };
  })();
  useEffect(() => {
    chapterPathRef.current?.querySelector(".hud-node.current")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [chapterNumber]);
  const statusMeta = sessionStatusView({ muted, speaking, asking, status, legacy: LEGACY_STREAMING, companionName: profileStore.data.companionName });
  statusMeta.dotClass = `status-dot ${statusMeta.key === "muted" || statusMeta.key === "offline" ? "lost" : statusMeta.key === "standby" ? "idle" : statusMeta.key === "listening" ? "connected" : "reconnecting"}`;
  const mode = orbVisual.orbMode;
  const liveNotice = describeLiveStatus(status);
  const fmt = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(sec).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  return (
    <div className="ghost-hud" style={{ "--book-aura-color": auraColor, "--keyboard-inset": `${keyboardInset}px` }}>
      <Motion.div className="book-aura" animate={{ opacity: [0.2, 0.42, 0.2], scale: [1, 1.12, 1] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} />
      <div className={`hud-aura ${mode}`} />

      <div className="hud-top">
        <div className="hud-journey" style={{ "--done": `${donePct}%` }}>
          <div className="hud-jr-head">
            <span className={`hud-jr-badge ${chapterNumber > 99 ? "wide" : ""}`} aria-hidden="true"><small>Ch</small><b>{chapterNumber}</b></span>
            <div className="hud-journey-text">
              <span className="hud-book-title">{book?.title || "Reading"}</span>
              <span className="hud-book-ch">Chapter {chapterNumber} of {totalChapters} · {donePct}% done</span>
            </div>
            <div className="hud-jr-meta">
              <span className="hud-time"><Clock size={11} />{fmt(elapsed)}</span>
              <span className="hud-live"><span className={statusMeta.dotClass} />{statusMeta.label}<button type="button" className="hud-status-info" aria-label="Explain listening status" onClick={() => setSessionInfoOpen(true)}><Info size={13} /></button></span>
            </div>
          </div>
          <div ref={chapterPathRef} className="hud-path" role="list" aria-label={`Chapter progress: ${chapterNumber} of ${totalChapters}, ${doneCount} done`}>
            {pathChapters.nodes.map((c, index) => (
              <Fragment key={c.number}>
                {index > 0 && <span aria-hidden="true" className={`hud-link ${pathChapters.nodes[index - 1]?.done ? "done" : ""}`} />}
                <span role="listitem" className={`hud-node ${c.done ? "done" : c.number === chapterNumber ? "current" : ""}`}>{c.number}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {liveNotice && (
          <Motion.div key={liveNotice.code} className="hud-notice" initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }} transition={INTERACTION_SPRING}>
            <ServiceNotice
              compact
              kind={liveNotice.kind}
              title={liveNotice.title}
              detail={liveNotice.detail}
              actions={liveNotice.code === "lost" ? [{ label: "End session", onClick: handleEnd, primary: true }] : []}
            />
          </Motion.div>
        )}
      </AnimatePresence>

      <div className="hud-stage">
        <div className="orb-wrap">
          <EmberOrb levelRef={orbLevelRef} mode={mode === "listening" ? "listening" : mode === "speaking" ? "speaking" : "idle"} ghostMode={isGhostMode} />
          <AnimatePresence>
            {isGhostMode && GHOST_DUST.map((particle) => (
              <Motion.span
                key={particle.id}
                className="ghost-stardust"
                style={{ width: particle.size, height: particle.size }}
                initial={{ opacity: 0, x: 0, y: 14, scale: 0.5 }}
                animate={{ opacity: [0, 0.9, 0], x: [0, particle.drift], y: -108, scale: [0.5, 1, 0.7] }}
                exit={{ opacity: 0 }}
                transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: "easeOut" }}
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="hud-chips">
          <span key={`w-${sessionStats.words}`}><BookOpen size={13} /> {sessionStats.words} words</span>
          <span key={`g-${sessionStats.gems}`}><Gem size={13} /> {sessionStats.gems} gems</span>
          {snapshot && <span key={`p-${snapshot.page}`}><ScanText size={13} /> {snapshot.pageNumber ? `Page ${snapshot.pageNumber}` : `Snapshot ${snapshot.page}`}</span>}
          {muted && <span className="muted-chip"><MicOff size={13} /> Muted</span>}
        </div>
      </div>

      {LEGACY_STREAMING && <div className={`camera-preview elevated ${cameraOn ? "" : "hidden"} ${cameraExpanded ? "expanded" : ""}`}>
        <video ref={videoEl} muted playsInline />
        <div className="camera-controls">
          <Motion.button type="button" className="camera-adjust-button" whileTap={{ scale: 0.97 }} transition={INTERACTION_SPRING} onClick={() => setCameraExpanded((v) => !v)}>
            {cameraExpanded ? "Restore compact" : "Adjust camera"}
          </Motion.button>
        </div>
      </div>}
      {LEGACY_STREAMING && <canvas ref={canvasEl} style={{ display: "none" }} />}

      {snapshot && (
        <div className={`camera-preview elevated snap-preview ${snapExpanded ? "expanded" : ""}`}>
          <img src={snapshot.dataUrl} alt="Shared page snapshot" onClick={() => setSnapExpanded((v) => !v)} />
          <div className="camera-controls">
            <Motion.button type="button" className="camera-adjust-button" whileTap={{ scale: 0.97 }} transition={INTERACTION_SPRING} onClick={openSnapshotPicker}>
              Next page
            </Motion.button>
          </div>
        </div>
      )}
      {!LEGACY_STREAMING && restorePrompt && (
        <div className="session-ask">
          <div className="session-restore">
            <span>Continue {snapshot?.pageNumber ? `page ${snapshot.pageNumber}` : "the saved page"}? Ye photo pichhle reading session ki hai.</span>
            <button type="button" onClick={() => setRestorePrompt(false)}>Continue</button>
            <button type="button" onClick={() => { setRestorePrompt(false); openSnapshotPicker(); }}>New page</button>
          </div>
        </div>
      )}
      <input ref={snapFileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { handleSnapshotFile(e.target.files?.[0]); e.target.value = ""; }} />

      <div className="glass-dock">
        {LEGACY_STREAMING ? (
          <Motion.button className={`hud-btn ${muted ? "active" : ""}`} whileTap={reduceMotion ? undefined : { scale: 0.94 }} transition={INTERACTION_SPRING} onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Unmute microphone" : "Mute microphone"} title={muted ? "Unmute microphone" : "Mute microphone"}>
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </Motion.button>
        ) : (
          <>
            <Motion.button className={`hud-btn ${asking ? "active" : ""}`} whileTap={reduceMotion ? undefined : { scale: 0.94 }} transition={INTERACTION_SPRING} onClick={toggleAsk} aria-label={asking ? "Stop asking" : "Ask a question"} title={asking ? "Stop asking" : "Ask a question"}><Mic size={22} /></Motion.button>
            <Motion.button className={`hud-btn mic-mute-btn ${muted ? "active" : ""}`} whileTap={reduceMotion ? undefined : { scale: 0.94 }} transition={INTERACTION_SPRING} onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Unmute microphone" : "Mute microphone"} title={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? <MicOff size={22} /> : <Mic size={22} />}</Motion.button>
          </>
        )}
        {LEGACY_STREAMING && <Motion.button className={`hud-btn ${cameraOn ? "active" : ""}`} whileTap={{ scale: 0.94 }} transition={INTERACTION_SPRING} onClick={toggleCamera} aria-label={cameraOn ? "Close camera" : "Open camera"}>
          {cameraOn ? <CameraIcon size={22} /> : <CameraOff size={22} />}
        </Motion.button>}
        <Motion.button className={`hud-btn ${snapshot ? "active" : ""}`} whileTap={{ scale: 0.94 }} transition={INTERACTION_SPRING} onClick={openSnapshotPicker} disabled={snapBusy} aria-label={snapshot ? "Share snapshot of the next page" : "Share a snapshot of the page"}>
          <CameraIcon size={22} />
        </Motion.button>
        <Motion.button className={`hud-btn ${transcriptOpen ? "active" : ""}`} whileTap={{ scale: 0.94 }} transition={INTERACTION_SPRING} onClick={toggleTranscript} aria-label="Toggle transcript">
          <MessageSquareText size={22} />
        </Motion.button>
        <Motion.button type="button" className={`hud-btn ghost-toggle ${isGhostMode ? "active on" : ""}`} role="switch" aria-checked={isGhostMode} onClick={toggleGhostMode} whileTap={{ scale: 0.94 }} transition={INTERACTION_SPRING} aria-label="Toggle Author's Ghost Mode">
          <span className="ghost-toggle-label">Ghost</span>
          <span className={`ghost-toggle-track ${isGhostMode ? "on" : ""}`}><Motion.span className="ghost-toggle-knob" layout transition={INTERACTION_SPRING} /></span>
        </Motion.button>
        <Motion.button className="hud-btn stop" whileTap={{ scale: 0.94 }} transition={INTERACTION_SPRING} onClick={handleEnd} aria-label="End session">
          <PhoneOff size={22} />
        </Motion.button>
      </div>

      <div className="sess-sidekick">
        <AnimatePresence>
          {liveActivity && !feedOpen && (
            <Motion.div key={liveActivity.id} className="sess-activity-bubble"
              initial={{ opacity: 0, y: 12, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.9 }} transition={INTERACTION_SPRING}>
              {liveActivity.text.length > 64 ? `${liveActivity.text.slice(0, 62)}…` : liveActivity.text}
            </Motion.div>
          )}
        </AnimatePresence>
        <div className={`sess-mascot-btn ${feedOpen ? "on" : ""}`}>
          <MascotCharacter characterId={sessionMascot} size={54} animated silent onTap={() => { triggerLightTap(); setFeedOpen(true); }} />
          {activities.length > 0 && <span className="sess-count">{activities.length}</span>}
        </div>
      </div>

      <AnimatePresence>
        {sessionInfoOpen && (
          <Motion.div className="session-info-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSessionInfoOpen(false)}>
            <Motion.section className="session-info-sheet" role="dialog" aria-modal="true" aria-labelledby="session-info-title" initial={reduceMotion ? false : { y: 30 }} animate={{ y: 0 }} exit={reduceMotion ? undefined : { y: 30 }} transition={INTERACTION_SPRING} onClick={(event) => event.stopPropagation()}>
              <span className="session-info-grip" aria-hidden="true" />
              <button type="button" className="session-info-close" aria-label="Close status details" onClick={() => setSessionInfoOpen(false)}><XIcon size={17} /></button>
              <h2 id="session-info-title">Listening status</h2>
              <dl>
                <div><dt>Standby</dt><dd>Speech is checked for a direct question. A short detected clip may go to the voice classifier; the continuous mic stream is not sent.</dd></div>
                <div><dt>Listening to you…</dt><dd>While Tap to ask is active, microphone audio goes to Gemini Live. A verified saved page may be sent as reading context.</dd></div>
                <div><dt>Answering…</dt><dd>Gemini Live is returning the answer audio and transcript to this device.</dd></div>
                <div><dt>Mic muted</dt><dd>Automatic microphone audio, camera frames, Live messages, and reconnects stop. An explicitly typed question still goes to the text-answer service with eligible saved page context; it never unmutes the mic.</dd></div>
                <div><dt>Reconnecting…</dt><dd>The voice connection is warming or recovering. Speech is buffered briefly so the start of a question can be sent after it is ready.</dd></div>
              </dl>
            </Motion.section>
          </Motion.div>
        )}
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
          {feedOpen && (
            <Motion.div key="sheet" className="sess-sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFeedOpen(false)}>
              <Motion.div className="sess-sheet" role="dialog" aria-modal="true" aria-label="Actions completed in this session"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}
                onClick={(e) => e.stopPropagation()}>
                <span className="sess-sheet-grip" aria-hidden="true" />
                <div className="sess-sheet-head">
                  <div><b>Done in this session</b><span>{activities.length} action{activities.length === 1 ? "" : "s"} completed</span></div>
                  <button type="button" onClick={() => setFeedOpen(false)} aria-label="Close"><XIcon size={16} /></button>
                </div>
                {activities.length === 0 ? (
                  <p className="sess-sheet-empty">Nothing yet. Saved words, gems and chapter updates will show up here.</p>
                ) : (
                  <ul className="sess-sheet-list">
                    {activities.slice().reverse().map((a) => {
                      const Ico = ACTIVITY_ICONS[a.icon] || Check;
                      return (
                        <li key={a.id}>
                          <span className="sess-sheet-ic"><Ico size={14} /></span>
                          <span className="sess-sheet-text">{a.text}</span>
                          <time>{new Date(a.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Motion.div>
            </Motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <AnimatePresence>
        {ghostToast && (
          <Motion.div className="ghost-toast" initial={{ opacity: 0, y: 20, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: 12, filter: "blur(4px)" }} transition={INTERACTION_SPRING}>
            Channeling the Author's Persona...
          </Motion.div>
        )}
      </AnimatePresence>

      {transcriptOpen && (
        <div className="transcript-drawer elevated">
          <div className="transcript-drawer-head"><b>Conversation</b><button type="button" onClick={resyncCompanion}><RefreshCw size={13} /> Reply off-topic? Re-sync</button></div>
          {transcript.map((line, i) => (
            <div className="transcript-line" key={i}><b>{line.speaker === "reader" ? "You" : "Companion"}:</b> {line.text}</div>
          ))}
        </div>
      )}
            {pendingShot && createPortal(
        <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={INTERACTION_SPRING}>
          <Motion.div className="modal-card elevated" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={INTERACTION_SPRING}>
            <h2>Use this page?</h2>
            <img src={pendingShot.dataUrl} alt="Page preview" style={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 12, marginBottom: 12 }} />
            <input
              className="title-input"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              value={pageNumberInput}
              onChange={(event) => setPageNumberInput(event.target.value.replace(/\D/g, ""))}
              placeholder={readLastPage(bookId) ? `Page number if not visible (e.g. ${readLastPage(bookId) + 1})` : "Page number if not visible"}
            />
            <p className="field-hint">Agar photo mein page number clearly nahi dikhta, yahan likh dein. Visible number companion khud read karega.</p>
            <div className="modal-actions">
              <button className="icon-button ghost" onClick={() => { setPendingShot(null); snapFileRef.current?.click(); }}>Retake</button>
              <button className="primary-button" disabled={snapBusy} onClick={() => commitSnapshot(pendingShot)}>{snapBusy ? "Saving…" : "Use this photo"}</button>
            </div>
          </Motion.div>
        </Motion.div>,
        document.body
      )}
      {rejectedShot && createPortal(
        <Motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={INTERACTION_SPRING}>
          <Motion.div className="modal-card elevated" role="alertdialog" aria-modal="true" aria-labelledby="rejected-page-title" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={INTERACTION_SPRING}>
            <h2 id="rejected-page-title">Photo check</h2>
            <p>{rejectedShot.message}</p>
            <div className="modal-actions">
              <button className="primary-button" onClick={() => { setRejectedShot(null); snapFileRef.current?.click(); }}>Retake</button>
            </div>
          </Motion.div>
        </Motion.div>,
        document.body
      )}
      {pendingDeletion && (
        <ConfirmModal
          title={`Delete ${pendingDeletion.kind}?`}
          message={`“${pendingDeletion.exact}”\n\n${pendingDeletion.consequence} This cannot be undone.`}
          onConfirm={() => finishDeleteRequest(true)}
          onCancel={() => finishDeleteRequest(false)}
        />
      )}
    </div>
  );
}
