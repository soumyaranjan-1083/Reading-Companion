// Catalogue of Help & Support chat animations. Pure data so the backend can
// reuse the ids and summaries when the AI picks which animations to show.
// `kind` selects a visual in HelpAnimations.jsx; `items` are the steps it cycles.

const item = (icon, label, text) => ({ icon, label, text });

export const HELP_ANIMATIONS = [
  // Home
  { id: "home-mascot", group: "Home", title: "Your mascot", kind: "avatar", accent: "#f2a65a",
    keywords: ["mascot", "companion character", "owl", "robot", "sprout", "fox", "home screen character", "mascot do"],
    items: [item("Sparkles", "Greets you", "The mascot welcomes you on Home with a friendly line."), item("Flame", "Reacts", "It cheers when your streak grows or a goal is met."), item("BookOpen", "Nudges", "Tap it for a gentle nudge to start or resume reading.")] },
  { id: "home-streak", group: "Home", title: "Streak", kind: "streak", accent: "#ff7a45",
    keywords: ["streak", "daily streak", "days in a row", "consecutive", "lost my streak", "streak chip"],
    items: [item("BookOpen", "Read today", "Any reading session today keeps your streak alive."), item("Flame", "It grows", "Each day in a row adds one to the flame."), item("Clock", "Miss a day", "Skipping a day resets it to zero.")] },
  { id: "home-cards", group: "Home", title: "Home stat cards", kind: "grid", accent: "#6aa9ff",
    keywords: ["books card", "words learned", "words this week", "gems saved", "four cards", "stat cards", "stats", "dashboard cards", "numbers on home"],
    items: [item("Library", "Books", "How many books are in your library."), item("Languages", "Words Learned", "All vocabulary words saved so far."), item("TrendingUp", "Words This Week", "New words added in the last seven days."), item("Gem", "Gems Saved", "Quotes you saved while reading.")] },
  { id: "home-growth", group: "Home", title: "Vocabulary Growth chart", kind: "bars", accent: "#42d897",
    keywords: ["vocabulary growth", "growth chart", "chart", "graph", "vocab chart", "words over time"],
    items: [item("TrendingUp", "Week by week", "Each bar is the words you learned in that period."), item("Languages", "Taller is better", "A taller bar means a busier vocabulary week."), item("Clock", "Updates itself", "New words appear in the chart automatically.")] },
  { id: "home-progress", group: "Home", title: "Overall Progress & Gems This Week", kind: "ring", accent: "#b48cff",
    keywords: ["overall progress", "gems this week", "progress ring", "overall", "weekly gems"],
    items: [item("TrendingUp", "Overall Progress", "Chapters finished across all your books."), item("Gem", "Gems This Week", "Quotes saved in the last seven days."), item("Flame", "Keep going", "Both numbers rise as you read.")] },
  { id: "home-book-progress", group: "Home", title: "Book Progress", kind: "rows", accent: "#4fd1c5",
    keywords: ["book progress", "progress of my book", "per book", "book completion", "how much have i read"],
    items: [item("BookOpen", "Each book", "Every book has its own progress bar."), item("Library", "Chapters done", "The bar fills as chapters are completed."), item("Play", "Tap to open", "Tap a book to jump into it.")] },
  { id: "home-continue", group: "Home", title: "Continue Reading", kind: "card", accent: "#ff8fab",
    keywords: ["continue reading", "resume", "pick up where", "last book", "continue card"],
    items: [item("BookOpen", "Last book", "Shows the book you read most recently."), item("Clock", "Where you stopped", "It remembers your chapter."), item("Play", "One tap", "Tap Continue to start a session right there.")] },

  // Library
  { id: "lib-add", group: "Library", title: "Adding a book", kind: "flow", accent: "#f2a65a",
    keywords: ["add book", "add a book", "new book", "add new book", "plus button", "create book", "upload book"],
    items: [item("Plus", "Tap +", "Tap the plus on the Library tab."), item("PenLine", "Fill details", "Enter the title and author."), item("Sparkles", "Chapters built", "The app prepares your chapters."), item("BookOpen", "Ready", "Your book appears in the Library.")] },
  { id: "lib-author", group: "Library", title: "Author chip", kind: "card", accent: "#6aa9ff",
    keywords: ["author chip", "author", "author bio", "author photo", "author name", "writer"],
    items: [item("User", "Author chip", "Each book tile shows its author as a small chip."), item("PenLine", "Tap to open", "See the author's bio and photo."), item("Save", "Edit", "You can fix the name, bio or picture.")] },
  { id: "lib-chapters", group: "Library", title: "Chapters & Journey", kind: "rows", accent: "#42d897",
    keywords: ["chapters", "journey", "journey timeline", "chapter list", "timeline in book", "book tile chapters"],
    items: [item("Library", "Chapters", "Open a tile to see all its chapters."), item("Route", "Journey", "A timeline shows finished, current and upcoming chapters."), item("Check", "Done ticks", "Finished chapters get a tick.")] },
  { id: "lib-summary-vocab", group: "Library", title: "Summary & Vocabulary", kind: "rows", accent: "#b48cff",
    keywords: ["summary", "chapter summary", "vocabulary", "difficult words", "chapter vocabulary", "word list", "chapter detail"],
    items: [item("ScanText", "Summary", "A short recap of the chapter."), item("Languages", "Vocabulary", "Difficult words for this chapter, scroll to see all."), item("Download", "Saved words", "Words you save in a session land here.")] },
  { id: "lib-play", group: "Library", title: "Play icon & options", kind: "card", accent: "#ff8fab",
    keywords: ["play icon", "play button", "start reading", "recap", "play on book", "options when play"],
    items: [item("Play", "Tap Play", "The Play icon on a book tile opens the recap."), item("ScanText", "Recap", "Refresh your memory of where you left off."), item("BookOpen", "Start Reading", "Begin the live session with your companion.")] },
  { id: "lib-trash", group: "Library", title: "Delete and restore books", kind: "flow", accent: "#b48cff",
    keywords: ["deleted books", "trash", "bin", "restore book", "permanently delete", "delete book"],
    items: [item("Trash2", "Move to Deleted books", "A confirmed delete takes the book out of the active library."), item("BookOpen", "Keep its story", "Chapters, linked gems and conversation recap stay archived together."), item("Check", "Restore", "Bring the book and its related reading data back."), item("Trash2", "Delete forever", "Permanently remove the archived book after confirmation.")] },

  // Gems
  { id: "gem-card", group: "Gems", title: "Gems card", kind: "grid", accent: "#ff8fab",
    keywords: ["gems card", "gem card", "gems", "saved quotes", "quotes", "save a quote", "gem tab", "save this line"],
    items: [item("MessageSquareText", "The quote", "Your saved line, with its book and chapter."), item("Search", "Find", "Search quotes or filter with book chips."), item("Gem", "Open", "Tap a gem to see it in full."), item("Trash2", "Delete", "The bin removes a gem.")] },
  { id: "gem-image", group: "Gems", title: "Image generation", kind: "flow", accent: "#b48cff",
    keywords: ["image generation", "generate image", "illustration", "gem image", "picture for gem", "ai image", "artwork"],
    items: [item("Gem", "Open a gem", "Open any gem."), item("Sparkles", "Generate", "Ask for an illustration of the quote."), item("Palette", "Painting", "The image is drawn from the quote's meaning."), item("Check", "Saved", "It stays with the gem.")] },
  { id: "gem-apply", group: "Gems", title: "Real-life application", kind: "flow", accent: "#42d897",
    keywords: ["real life application", "real-life application", "apply", "how to apply", "application suggestion", "use in real life"],
    items: [item("Gem", "A quote", "Inside each gem you can reveal an application."), item("Brain", "Think", "The AI connects the idea to daily life."), item("Check", "Try it", "You get a small practical action.")] },
  { id: "gem-download", group: "Gems", title: "Gem card studio", kind: "flow", accent: "#6aa9ff",
    keywords: ["download", "download gem", "share card", "export gem", "shareable card", "save as image", "gem card template", "quote card style", "aspect ratio", "story post square", "surprise me"],
    items: [item("Gem", "Choose a template", "Preview 14 layouts with your saved quote; Summit keeps the original photo style."), item("Square", "Set the shape", "Choose Story 9:16, Post 4:5 or Square 1:1."), item("Palette", "Pick an accent", "The existing color effects drive each template's accent; Neon Terminal keeps its fixed palette."), item("Download", "Export or share", "Fonts load before the 1080px-wide PNG is downloaded or shared.")] },

  // Memory
  { id: "mem-prefs", group: "Memory", title: "Memory preferences", kind: "toggles", accent: "#f2a65a",
    keywords: ["memory preferences", "preferences", "what the companion remembers", "memory tab", "remember about me", "saved preferences"],
    items: [item("Brain", "Learns you", "The companion remembers likes you mention."), item("PenLine", "Editable", "Review what it saved."), item("Trash2", "Clearable", "Clear them any time in Settings.")] },
  { id: "mem-mindmap", group: "Memory", title: "Mind Map", kind: "graph", accent: "#4fd1c5",
    keywords: ["mind map", "mindmap", "constellation", "connections", "linked books", "connect books", "full screen mind map", "shuffle", "nodes"],
    items: [item("Brain", "Nodes", "Each dot is a gem or idea."), item("Link2", "Connections", "Dotted lines link ideas across books."), item("Shuffle", "Shuffle", "Re-arranges the map."), item("Maximize2", "Full screen", "Expands the map to fill the screen.")] },

  // Profile
  { id: "prof-card", group: "Profile", title: "Profile card", kind: "rows", accent: "#ff8fab",
    keywords: ["profile card", "profile", "my photo", "change photo", "profile picture", "avatar", "my name", "uid", "user id", "copy id", "profile scroll", "reader profile pinned"],
    items: [item("User", "Photo", "Upload a photo or pick an icon."), item("PenLine", "Name", "Edit the name your companion uses."), item("Copy", "Copy UID", "Your Supabase account ID sits below your name; tap its copy button."), item("Gem", "Stays in view", "The reader card stays at the top while the profile options scroll below.")] },
  { id: "prof-companion", group: "Profile", title: "Your Companion", kind: "swatch", accent: "#f2a65a",
    keywords: ["your companion", "choose companion", "pick companion", "change mascot", "companion option", "owl robot sprout fox"],
    items: [item("Sparkles", "Owl", "A wise, calm reading mascot."), item("Bot", "Robot", "Precise and playful."), item("Sprout", "Sprout", "Gentle and growing."), item("Cat", "Fox", "Quick and curious.")] },
  { id: "prof-account", group: "Profile", title: "Account", kind: "rows", accent: "#6aa9ff",
    keywords: ["account", "sync", "sync now", "sign out", "google account", "cloud", "cloud sync", "log out"],
    items: [item("User", "Google email", "Shows who you are signed in as."), item("Cloud", "Sync status", "Up to date, Syncing or Needs attention."), item("RefreshCw", "Sync now", "Pushes your data to the cloud immediately."), item("LogOut", "Sign out", "Disconnects this device; your cloud copy stays.")] },
  { id: "set-you", group: "Settings", title: "Settings: You & your companion", kind: "swatch", accent: "#f2a65a",
    keywords: ["you & your companion", "daily goal", "companion name", "settings name", "reading goal"],
    items: [item("User", "Your name", "What the companion calls you."), item("Bot", "Companion name", "Rename your companion."), item("Clock", "Daily goal", "10 min, 20 min, 30 min or 1 hour.")] },
  { id: "set-appearance", group: "Settings", title: "Settings: Appearance", kind: "swatch", accent: "#b48cff",
    keywords: ["appearance", "theme", "colour theme", "color theme", "dark mode", "light mode", "dark theme", "light theme", "change theme", "change the color", "change colour"],
    items: [item("Sun", "Light", "A bright, paper-like look."), item("Moon", "Dark", "Easier on the eyes at night."), item("Palette", "Instant", "The whole app switches straight away.")] },
  { id: "set-voice", group: "Settings", title: "Settings: Voice", kind: "toggles", accent: "#4fd1c5",
    keywords: ["voice", "companion voice", "change voice", "preview voice", "leda", "aoede", "kore", "voices"],
    items: [item("Volume2", "Pick a voice", "Leda, Aoede, Kore, Despina and more."), item("Play", "Preview", "Hear the voice before choosing."), item("Clock", "Next session", "A new voice applies from your next session.")] },
  { id: "set-notifications", group: "Settings", title: "Settings: Notifications", kind: "toggles", accent: "#ff7a45",
    keywords: ["notifications", "push", "push notifications", "reminder", "study reminder", "alerts", "notify me"],
    items: [item("Bell", "Allow alerts", "Turn on notifications for this device."), item("Clock", "Study reminders", "A nudge near your usual reading time."), item("Sparkles", "Updates", "Hear about new versions and announcements.")] },
  { id: "set-privacy", group: "Settings", title: "Settings: Privacy & storage", kind: "toggles", accent: "#42d897",
    keywords: ["privacy", "storage", "clear history", "clear conversation", "clear preferences", "delete gems", "storage used"],
    items: [item("Lock", "Your data", "Stays on your device and in your account."), item("Trash2", "Clear history", "Removes saved recaps and chats."), item("Brain", "Clear preferences", "Empties Memory preferences.")] },
  { id: "set-backup", group: "Settings", title: "Settings: Backup", kind: "flow", accent: "#6aa9ff",
    keywords: ["backup", "export backup", "restore", "restore backup", "json file"],
    items: [item("Download", "Export backup", "Downloads everything as one JSON file."), item("Save", "Keep it safe", "Store the file anywhere."), item("RefreshCw", "Restore", "Load it later to bring your data back.")] },
  { id: "set-reading-limit", group: "Settings", title: "Daily reading limit", kind: "flow", accent: "#ffb454",
    keywords: ["30 minutes", "daily reading limit", "session cap", "reading allowance", "prototype limit"],
    items: [item("Clock", "A daily allowance", "Up to 30 minutes of active reading sessions are available each local day."), item("Library", "Across your books", "Time is counted across reading sessions, not reset for each book."), item("Send", "Need more time?", "Contact Developer opens a pre-filled request with your account ID.")] },
  { id: "set-app", group: "Settings", title: "Settings: App", kind: "rows", accent: "#ff8fab",
    keywords: ["check for updates", "app section", "version", "update now", "release notes", "what's new", "new version", "automatic push", "deployment notification", "main deployment"],
    items: [item("RefreshCw", "Check for updates", "Looks for a new version."), item("Sparkles", "What's new", "See the version and changelog, then choose Update now or Later."), item("Bell", "Release alerts", "App updates & announcements subscribers can get a push after production deploys."), item("ScanText", "Release notes", "The full history of versions.")] },
  { id: "set-releases", group: "Settings", title: "Version & release notes", kind: "rows", accent: "#ffb454",
    keywords: ["major update", "ui enhancement", "new chapter", "signature update", "release type", "release types", "types of updates", "update label", "label", "version history", "release history", "release card", "release notes", "version & release"],
    items: [item("Sparkles", "Major update", "A big release with many changes."), item("Palette", "UI enhancement", "A visual polish release."), item("BookOpen", "A new chapter", "A landmark 2.x release."), item("Zap", "Signature update", "A standout feature, shown on a special animated card."), item("ScanText", "Tap a card", "See exactly what changed in that version.")] },
  { id: "set-danger", group: "Settings", title: "Settings: Danger zone", kind: "rows", accent: "#f26a6a",
    keywords: ["danger zone", "delete all my data", "delete everything", "erase data", "delete account data", "reset app"],
    items: [item("AlertTriangle", "Careful", "These actions cannot be undone."), item("Trash2", "Delete all my data", "Erases books, gems, memory and profile."), item("Check", "Confirmation", "You are always asked to confirm first.")] },
  { id: "session-wake", group: "Reading session", title: "Always-on listening", kind: "flow", accent: "#42d897",
    keywords: ["wake word", "wake up", "auto listening", "auto-listening", "companion name", "quiet reading", "voice not responding", "microphone always on"],
    items: [item("Mic", "Keep listening", "The microphone stream stays open for the active reading session."), item("Moon", "Quiet reading", "Say that you are reading; the companion stays quiet but continues listening."), item("User", "Ask when ready", "Say the companion's name, hello, or a direct question to wake it."), item("Clock", "Follow-up", "It stays ready for follow-up questions after answering.")] },
  { id: "session-snapshot-flow", group: "Reading session", title: "Snapshot reading", kind: "flow", accent: "#6aa9ff",
    keywords: ["snapshot", "page snapshot", "next page", "page turn", "replace snapshot", "previous page context", "book snapshot"],
    items: [item("Camera", "Send a snapshot", "Share one still photo of the page you are reading."), item("BookOpen", "Ask about it", "The companion answers using the latest page photo."), item("ChevronRight", "Turn the page", "Send another snapshot when you move to a new page."), item("Brain", "Keep the story", "Saved summaries and story context carry across page photos.")] },
  { id: "profile-reader-arena", group: "Profile", title: "Reader Arena", kind: "ring", accent: "#f5c451",
    keywords: ["reader arena", "arena", "reader ranking", "reading leaderboard", "weekly reading rank", "all time ranking", "reading race"],
    items: [item("TrendingUp", "Your place", "See your real reading-time rank among readers."), item("Clock", "This week", "The weekly race resets Monday at midnight in India."), item("Sparkles", "All time", "Compare lifetime reading time across every genre.")] },

  // Support and info
  { id: "support-report", group: "Support", title: "Report an Issue", kind: "flow", accent: "#f2a65a",
    keywords: ["report an issue", "report issue", "report a bug", "found a bug", "bug", "feedback", "suggest a feature", "feature request"],
    items: [item("Bug", "Choose a type", "Bug, Issue, New feature or Improvement."), item("PenLine", "Describe it", "Title, details and optional screenshots."), item("Send", "Submit", "Only what you write is sent."), item("Check", "Track it", "Follow it in Your Reports.")] },
  { id: "support-raise", group: "Support", title: "Raise an Issue", kind: "rows", accent: "#ff8fab",
    keywords: ["raise an issue", "raise issue", "improve with ai", "severity", "steps to reproduce", "screenshots"],
    items: [item("Bug", "Category", "Pick what it is about."), item("PenLine", "Details", "Write the title and what happened."), item("Sparkles", "Improve with AI", "Preview a cleaner version, keep yours or use it."), item("Send", "Submit", "Send it to the developer.")] },
  { id: "support-reports", group: "Support", title: "Your Reports", kind: "timeline", accent: "#42d897",
    keywords: ["your reports", "my reports", "report status", "status timeline", "report tracking", "fixed in version", "release version", "stage", "stages", "status", "timeline", "queued", "seen", "approved", "testing", "rejected", "report ke", "issue raise", "different stage"],
    items: [item("Send", "Sent", "Your report reached the developer."), item("Eye", "Seen", "The developer opened it."), item("Search", "In review", "It is being checked."), item("ThumbsUp", "Approved", "Accepted to be worked on."), item("Wrench", "In progress", "A fix is being built."), item("FlaskConical", "Testing", "The fix is being verified."), item("Check", "Done", "Fixed, with the version it shipped in as a tappable link.")] },
  { id: "support-help", group: "Support", title: "Help & Guide", kind: "chatui", accent: "#6aa9ff",
    keywords: ["help & guide", "help and guide", "help section", "help chat", "app tour", "guide", "chat history", "new chat"],
    items: [item("MessageSquareText", "Ask anything", "Type a question about any feature."), item("History", "Chat history", "Past chats are saved to revisit."), item("Sparkles", "App tour", "A short walkthrough of the app.")] },
  { id: "support-about", group: "Support", title: "About", kind: "avatar", accent: "#b48cff",
    keywords: ["about", "about section", "about the app", "who made", "app info", "developer", "credits"],
    items: [item("BookOpen", "The app", "What Reading Companion is for."), item("Sparkles", "Version", "The version you are running."), item("User", "The maker", "Who built it and how to reach out.")] },
];

export const HELP_ANIMATION_IDS = HELP_ANIMATIONS.map((animation) => animation.id);

const byId = new Map(HELP_ANIMATIONS.map((animation) => [animation.id, animation]));
export const getHelpAnimation = (id) => byId.get(id) || null;

export function sanitizeAnimationIds(ids, max = 3) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id) => typeof id === "string" && byId.has(id)))].slice(0, max);
}

// Offline fallback: score animations by keyword hits in the question.
export function pickAnimationsByKeywords(text, max = 2) {
  const query = String(text || "").toLowerCase();
  if (!query.trim()) return [];
  const scored = HELP_ANIMATIONS.map((animation) => {
    let score = 0;
    for (const keyword of animation.keywords) {
      if (query.includes(keyword)) score += keyword.includes(" ") ? 3 : 2;
    }
    return { id: animation.id, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((entry) => entry.id);
}

export function describeAnimationsForPrompt() {
  return HELP_ANIMATIONS.map((animation) => `${animation.id}: ${animation.title}`).join("\n");
}
