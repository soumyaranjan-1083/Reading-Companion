import releaseNotes from "../public/release-notes.json" with { type: "json" };

const BANNED_HELP_TERMS = [
  "docsaccesscard",
  "docs owner access",
  "docs_owner_user_ids",
  "developer-only docs",
  "hidden developer docs",
  "in-app docs",
  "seven-tap unlock",
  "7-tap unlock",
];

function sanitizeReleaseText(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  const normalized = value.toLowerCase();
  return BANNED_HELP_TERMS.some((term) => normalized.includes(term)) ? "" : value;
}

function buildReleaseGuideEntries() {
  const releases = Array.isArray(releaseNotes?.releases) ? releaseNotes.releases : [];
  const sorted = releases.slice().sort((left, right) => compareVersions(right.version, left.version));
  const overview = sorted.map((release) => {
    const items = (release.items || [])
      .map((item) => sanitizeReleaseText(item?.text))
      .filter(Boolean)
      .slice(0, 3)
      .join("; ");
    return `v${release.version} (${release.date}, ${release.title}): ${items}`;
  }).join(" ");

  const entries = sorted.map((release) => {
    const cleanItems = (release.items || []).map((item) => sanitizeReleaseText(item?.text)).filter(Boolean);
    const itemSummary = cleanItems.map((item, index) => `${index + 1}. ${item}`).join(" ");
    return {
      id: `release-${release.version.replace(/\./g, "-")}`,
      kind: "release",
      title: `Release ${release.version} · ${release.title}`,
      keywords: [
        "release notes", "release history", "version history", "what's new", "whats new", "which update",
        "which version", "introduced", "added", "shipped", "update", "version", "release", `v${release.version}`,
        release.version, release.title,
      ],
      screen: "settings",
      actionScreens: ["settings"],
      content: `Version ${release.version}, released on ${release.date}, is titled ${release.title}. ${itemSummary || "This release is listed in Version & release notes in Settings."} If you want to verify another feature, open **Settings** → **Version & release notes**.`,
    };
  });

  entries.unshift({
    id: "release-history",
    kind: "release",
    title: "Release history and version lookup",
    keywords: [
      "release history", "version history", "when was this added", "which update", "which version", "introduced",
      "added", "shipped", "whats new", "what's new", "release notes", "app update",
    ],
    screen: "settings",
    actionScreens: ["settings"],
    content: `Open **Settings** → **Version & release notes** to see every update. The current condensed history is: ${overview} If a feature is not mentioned there, the guide should say it cannot find which update introduced it instead of guessing.`,
  });

  return entries;
}

const BASE_HELP_GUIDE = [
  {
    id: "app-overview",
    title: "App overview",
    keywords: ["overview", "navigation", "tabs", "bottom bar", "bottom dock", "screens", "sections", "what can this app do", "home"],
    screen: "dashboard",
    demo: "tabs",
    content: "The bottom bar has **Home**, **Library**, **Gems**, **Memory** and **Profile**. **Home** shows streaks, charts and Continue reading. **Library** holds your books, chapter views and reading entry points. **Gems** stores saved quotes and their visuals. **Memory** stores preferences and the **Cognitive Constellation** mind map. **Profile** gives you your avatar card, companion picker, **Account**, **Settings**, **Help & guide**, **Report an issue** and **About**.",
  },
  {
    id: "start-reading",
    title: "Start a reading session",
    keywords: ["start reading", "reading session", "resume reading", "continue reading", "play button", "reading screen", "recap"],
    screen: "library",
    content: "To start reading from **Library**, tap the **Play** icon on a book tile. That opens the recap card with **Skip**, **Hear the story** and **Start Reading**. **Start Reading** opens the live voice session. On **Home**, the **Continue reading** cards also reopen the recap for your recent books. A 30-minute daily session allowance is shared across your books; when it is used, the app explains the prototype limit and offers a contact link.",
  },
  {
    id: "add-book",
    title: "Add a book manually",
    keywords: ["add book", "new book", "add manually", "start a new book", "manual book", "first book", "title only"],
    screen: "library",
    content: "In **Library**, tap **Add book**. Choose **Add manually** to open **Start a new book**, type the title, then tap **Start** or press Enter. **Back** returns to the choice card and **Cancel** closes it. Manual add creates the book first, then you can fill chapter details as you read.",
  },
  {
    id: "search-book",
    title: "Search a book",
    keywords: ["search a book", "find a book", "catalogue", "catalog", "edition", "book search", "book lookup", "multiple editions", "contents page", "read contents", "author details"],
    screen: "library",
    content: "In **Library**, tap **Add book** → **Search a book**. Type the title, pick the right edition, then the app works through **Finding the book**, **Getting author details**, **Fetching chapters**, and **Adding to your library**. If chapters are found, you can review, rename, remove or add chapters before **Add to library**. If chapters are missing, upload clear photos of the contents page and tap **Read contents**. If the public catalogue cannot find the book, or the book is already in your library, the flow tells you plainly and lets you switch to **Add manually**.",
  },
  {
    id: "delete-restore-books",
    title: "Delete and restore a book",
    keywords: ["delete book", "remove book", "deleted books", "trash", "bin", "restore book", "permanently delete book"],
    screen: "library",
    content: "Tap the bin on a book tile and confirm to move the book to **Profile → Settings → Deleted books**. Open the separate **Deleted books** bin card to see the list. Its chapters, saved gems and conversation recap are kept with it. Choose **Restore** to bring them back, or permanently delete the archived book and related data after confirmation.",
  },
  {
    id: "library",
    title: "Library and book tiles",
    keywords: ["library", "book tile", "shelf", "author button", "delete book", "remove book", "progress ring", "last read", "book cover"],
    screen: "library",
    demo: "library",
    content: "Each **Library** tile shows a unique colour palette, the title you entered, a chapter progress ring, and the last read time. Tap anywhere on the tile to open that book’s chapter view; **Author**, **Play** and the bin remain separate controls. The bin asks for confirmation and moves the book to **Profile → Settings → Deleted books**, where you can restore it with its chapters, gems and conversation recap or permanently delete it.",
  },
  {
    id: "author",
    title: "Author details and photo",
    keywords: ["author", "writer", "author details", "author bio", "author photo", "find photo online", "look up again", "edit author"],
    screen: "library",
    content: "Tap **Author** on a book tile to see the author sheet. In view mode you can see the author name, bio and any saved portrait, then use **Find photo online** or **Look up again**. **Edit** switches to fields for the author name and bio, with **Save** and **Cancel**. The companion can also set the book’s author by voice during reading.",
  },
  {
    id: "chapters",
    title: "Chapters and Journey Timeline",
    keywords: ["chapters", "journey timeline", "chapter grid", "chapter status", "completed", "current", "in progress", "not started", "locked"],
    screen: "library",
    content: "Opening a book shows two tabs: **Chapters** and **Journey Timeline**. **Chapters** lists every chapter card with its chapter number, page range, status pill, saved gem count and saved word count. Future chapters stay locked until you reach them. **Journey Timeline** turns read or current chapters into an animated vertical recap of the story so far.",
  },
  {
    id: "chapter-detail",
    title: "Chapter detail, summary and vocabulary",
    keywords: ["chapter detail", "summary tab", "vocabulary tab", "rename chapter", "pencil", "word details", "context", "analysis", "hindi", "odia", "pronunciation"],
    screen: "library",
    content: "A chapter detail screen has **Summary** and **Vocabulary** tabs. Use the pencil beside the chapter title to rename it. The **Summary** tab shows the saved recap for that chapter. The **Vocabulary** tab lists saved words, usage labels like **Everyday** or **Formal / literary**, **Practiced** tags, meanings, translations, synonyms, antonyms, book sentences and examples. Tap a word to open its detailed **Context** and **Analysis** views, with Hindi and Odia translation options and pronunciation audio.",
  },
  {
    id: "story-recap",
    title: "Hear the story and Story theatre",
    keywords: ["hear the story", "story theatre", "animated story", "narrated recap", "story controls", "captions", "mute story", "replay story"],
    screen: "library",
    content: "The clearest **Hear the story** entry point is from **Library**: tap the **Play** icon on a book tile and use **Hear the story** on the recap card beside **Start Reading**. For the current chapter, the **Summary** tab can also show **Hear the story** when a story source exists. Story theatre plays a narrated visual retelling with **Pause/Resume**, **Captions**, **Mute**, **Replay**, **Close**, and a final **Padhna shuru karo** button to jump into reading.",
  },
  {
    id: "session-overview",
    title: "Reading screen overview",
    keywords: ["reading screen", "session screen", "voice screen", "orb", "reading layout", "session overview", "dock overview"],
    screen: "library",
    demo: "dock",
    content: "The reading screen keeps your book, chapter, recent conversation and saved preferences in context. **Snap page** shares one still photo; when you turn the page, send a new snapshot. The previous image is replaced, but saved summaries and established story context remain available. The microphone stays open during the session: the companion gives its opening, then listens without interrupting ordinary reading aloud. Say **I’m going to read**, **I’m reading**, **mein padhne ja raha hoon**, or **don’t interrupt** for quiet reading; it keeps listening and answers when you say its name, greet it, or ask a clear question such as **iska matlab kya hai?** Follow-ups remain available after a reply. At the top is the chapter progress card with the timer; the centre orb responds while you ask or the companion speaks. Your mascot button opens **Done in this session**. Listening needs microphone permission, an active network connection and an available voice service.",
  },
  {
    id: "session-buttons",
    title: "Reading screen buttons",
    keywords: ["reading buttons", "dock buttons", "session buttons", "mic button", "camera button", "snapshot button", "transcript button", "ghost button", "end session", "tap to ask", "hands-free", "ask by typing"],
    screen: "library",
    demo: "dock",
    content: "The bottom dock has the mic button (**Ask a question** / **Stop asking**), **Page snapshot**, **Transcript**, **Ghost**, and **End session**. **Snap page** and **Next page** share or replace the current photo. **Transcript** shows the conversation and **Re-sync**. **Ghost** toggles Author’s Ghost Mode.",
  },
  {
    id: "session-mic",
    title: "Microphone and talking",
    keywords: ["mic", "microphone", "mute", "unmute", "muted", "voice permission", "hear me", "automatic listening", "auto-listening", "wake word", "wake-up", "companion name"],
    screen: "library",
    demo: "dock",
    content: "The microphone stays open during the active reading session, rather than relying on a browser’s on-device wake-word feature or a separate clip-classification request. After the short welcome, the companion listens continuously but should not interrupt ordinary reading aloud. Say **I’m going to read**, **mein padhne ja raha hoon**, or **don’t interrupt** to enter quiet-reading mode. It keeps listening; say your companion’s name, **hello**, or ask a clear question (for example, **explain this** or **achha iska matlab kya hai**) to get a response. The mic button can still be used to mute or directly open a question. Voice depends on microphone permission, internet access, browser foreground/background behavior and Gemini availability; always-on streaming may use more battery and cannot guarantee lock-screen operation.",
  },
  {
    id: "camera-options",
    title: "Snap a page",
    keywords: ["camera", "live camera", "page snapshot", "snapshot", "adjust camera", "restore compact", "next page", "page turn", "story context", "previous page context", "dark photo", "blurry photo"],
    screen: "library",
    demo: "camera",
    content: "Optionally enter the printed page number, then use **Snap page** or the **Page snapshot** button to photograph the current page. Only the latest photo is kept locally on this phone; when you turn the page, send a new snapshot to replace it. The companion receives the current photo as context for your question. Earlier photos are not retained, but saved chapter summaries, conversation context and established story facts remain available so the discussion can continue across pages. There is no live camera video. If you mention an ambiguous word, say the word or read the line aloud. Dark photos are rejected and blurry photos trigger warnings.",
  },
  {
    id: "session-transcript",
    title: "Transcript and Re-sync",
    keywords: ["transcript", "re-sync", "resync", "reply off-topic", "off-topic", "chat transcript", "conversation drawer"],
    screen: "library",
    demo: "dock",
    content: "Tap **Transcript** to open the session conversation drawer. If the reply drifted away from your book, use **Reply off-topic? Re-sync** to pull the conversation back to the current book and chapter. Tapping **Transcript** again closes the drawer.",
  },
  {
    id: "ghost-mode",
    title: "Author's Ghost Mode",
    keywords: ["ghost mode", "ghost", "author's ghost mode", "author persona", "channeling the author's persona"],
    screen: "library",
    demo: "ghost",
    content: "Turn on **Ghost** in the reading dock to hear ideas explained through the author’s known themes and broad perspective. The switch becomes active, the orb styling changes, and a toast says **Channeling the Author’s Persona...**. It still stays your reading companion and does not invent direct author quotes. Set the author in **Library** first for the best results.",
  },
  {
    id: "session-progress",
    title: "Chapter progress card",
    keywords: ["chapter progress", "progress card", "chapter path", "timer", "live", "getting ready", "reconnecting", "offline"],
    screen: "library",
    demo: "progress",
    content: "The card at the top of the reading screen shows the book title, current chapter, percent done, session timer and status such as **Live**, **Getting ready**, **Reconnecting** or **Offline**. The chapter path below fills earlier chapters, highlights the current one and keeps upcoming ones hollow.",
  },
  {
    id: "session-activity",
    title: "Done in this session",
    keywords: ["done in this session", "mascot button", "session activity", "saved actions", "activity feed"],
    screen: "library",
    content: "Your mascot sits at the lower left of the reading screen. Small activity bubbles appear when the app saves a word, gem, chapter update or memory. Tap the mascot to open **Done in this session**, a bottom sheet listing every saved action with its time. The badge on the mascot shows how many actions were recorded.",
  },
  {
    id: "session-end",
    title: "End a reading session",
    keywords: ["end session", "stop reading", "finish reading", "good night", "red phone", "auto end", "inactive"],
    screen: "library",
    demo: "dock",
    content: "Tap the red phone button to end the session. You can also say **end session** or **good night**. The companion gives a short goodbye, then the session closes and saves recap data in the background. After long silence, the app checks in and can end the session automatically.",
  },
  {
    id: "voice-commands",
    title: "What the companion can do",
    keywords: ["voice commands", "what can i say", "companion commands", "save this line", "remember this", "rename chapter", "set author", "delete by voice"],
    screen: "library",
    content: "During voice reading, you can ask the companion to explain words or lines, save a word, **save this line**, remember a preference, move chapters, rename a chapter, set chapter pages or outlines, mark a chapter complete, set the book’s author, list saved items, or delete a gem, memory, word or chapter with confirmation. Share a new snapshot if you turn the page.",
  },
  {
    id: "vocabulary",
    title: "Save and review vocabulary",
    keywords: ["vocabulary", "save word", "word meaning", "practiced", "everyday", "formal literary", "sentence practice", "pronunciation observations"],
    screen: "dashboard",
    demo: "vocab",
    content: "Ask about a word while reading, then say yes when the companion asks whether to save it. Saved words stay attached to the book and chapter with meanings, translations, synonyms, antonyms, usage register, optional practice counts and pronunciation observations. Chapter **Vocabulary** shows them in detail, while **Home** and **Profile** count your saved words.",
  },
  {
    id: "dashboard",
    title: "Home dashboard",
    keywords: ["home", "dashboard", "books card", "words learned", "words this week", "gems saved", "continue reading"],
    screen: "dashboard",
    demo: "home",
    content: "The **Home** screen greets you by name, shows your streak, and gives four main stat cards: **Books**, **Words learned**, **Words this week**, and **Gems saved**. It also shows **Revisit these** when words are due, a vocabulary growth chart, **Overall progress**, **Gems this week**, **Words by book**, **Book progress**, and **Continue reading** cards for recent books.",
  },
  {
    id: "dashboard-charts",
    title: "Home charts and Continue reading",
    keywords: ["vocabulary growth", "overall progress", "gems this week", "words by book", "book progress", "continue reading cards", "7d", "14d", "30d", "90d"],
    screen: "dashboard",
    content: "The vocabulary growth chart supports **7D**, **14D**, **30D** and **90D**, and you can tap it for an exact day. **Overall progress** is the percent of chapters completed across your library. **Gems this week** shows seven daily bars. **Words by book** lets you tap a legend to focus one ring. **Book progress** lists recent books, and **Continue reading** reopens the recap for books you were reading recently.",
  },
  {
    id: "recall-card",
    title: "Weekly recall card",
    keywords: ["revisit these", "weekly recall", "yaad tha", "hint dekhein", "agli baar", "review words"],
    screen: "dashboard",
    content: "The **Revisit these** card appears on **Home** when saved words are due for a gentle reminder. It offers **Yaad tha**, **Hint dekhein**, and **Agli baar**, plus an **X** to dismiss the card. It is meant as a light revisit, not a scored test.",
  },
  {
    id: "streak",
    title: "Streak",
    keywords: ["streak", "flame", "days in a row", "weekly goal", "consecutive days"],
    screen: "dashboard",
    content: "Your streak counts how many days in a row you were active in a reading session. **Home** shows it with the flame ring and weekly bar, and **Profile** repeats it as a stat chip. Read at least a little each day to keep it going.",
  },
  {
    id: "gems",
    title: "Gems",
    keywords: ["gems", "saved quotes", "save quote", "save this line", "search gems", "filter gems", "delete gem"],
    screen: "gems",
    demo: "gems",
    content: "Say **save this line** in a reading session to store a quote in **Gems**. The **Gems** screen lets you search saved quotes, filter them by book, tap any gem for details, or delete one with the bin. Each card keeps the quote tied to its book and chapter.",
  },
  {
    id: "gem-detail",
    title: "Gem detail, illustrations and downloads",
    keywords: ["gem detail", "illustration", "generate illustration", "regenerate", "retry", "real-life application", "download gem", "share gem", "gem card template", "quote card style", "card aspect ratio", "surprise me", "editorial paper", "polaroid card", "cosmic card"],
    screen: "gems",
    content: "A gem detail page shows the quote, book, author and chapter. **Generate illustration** lets you choose styles such as **Lo-fi Ghibli**, **Charcoal Sketch**, **Cinematic Silhouette** and **White Ink Sketch**. **Regenerate** or **Retry** appear when needed. The detail page also shows the **Real-life application**. Use **Download** or **Share** to open the quote-card studio. Pick one of 14 layouts in the horizontal template strip, previewed with your quote; choose **Story** (9:16), **Post** (4:5) or **Square** (1:1), and select a color effect to set its accent. **Surprise me** picks a template and effect. Your last template, effect and ratio are saved on this device. Export creates a 1080-pixel-wide PNG; photo layouts use a generated-color fallback if an image is missing or unavailable.",
  },
  {
    id: "memory",
    title: "Memory",
    keywords: ["memory", "preferences", "saved preferences", "mind map", "cognitive constellation"],
    screen: "memory",
    demo: "mindmap",
    content: "The **Memory** screen has two tabs. **Preferences** stores things you asked the companion to remember, with edit and delete controls. **Mind Map** opens **Cognitive Constellation**, which connects saved gems across books.",
  },
  {
    id: "mind-map",
    title: "Mind Map (Cognitive Constellation)",
    keywords: ["mind map", "cognitive constellation", "echoes", "surprise me", "shuffle", "recenter", "rebuild connections", "full screen", "book chip", "real-life application"],
    screen: "memory",
    demo: "mindmap",
    content: "In **Memory**, open **Mind Map** to see **Cognitive Constellation**. The header shows counts for books, gems and echoes, and **Rebuild connections** refreshes links. **Book cover** nodes are books, crystals are saved gems orbiting their own book in chapter order, and **Echoes** are dotted links between similar ideas across books. Tap a book chip to jump to it, tap a book to see its saved gems, and tap a gem to open its quote, **Real-life application**, and **Echoes in other books**. Use **Surprise me**, **Echoes**, and full-screen controls to explore.",
  },
  {
    id: "profile",
    title: "Profile, avatar and companion",
    keywords: ["profile", "reader profile", "avatar", "change avatar", "upload photo", "remove photo", "companion", "mascot", "owl", "robot", "sprout", "fox", "book", "uid", "user id", "copy my id", "profile scroll", "sticky profile", "arena photo", "show photo in arena", "hide my arena photo"],
    screen: "profile",
    content: "The **Profile** reader card lets you change your photo, edit your name, open the avatar picker, and choose your reading companion. Your signed-in Supabase **UID** appears beneath your name; tap its copy icon to copy it and see **Copied** feedback. While you scroll, this reader card stays at the top and the companion, Reader Arena, Account, Settings and other options scroll below it. Tap the main photo or camera button to upload and crop an image. Tap **Change avatar** to open presets; **Remove photo** appears for a custom image. In **Profile → Settings → Privacy & storage**, **Show my photo in the Arena** controls whether other signed-in readers see your cropped photo; it is on by default, and off shows initials instead. The photo is uploaded to private storage and delivered to signed-in Arena readers through short-lived links.",
  },
  {
    id: "reader-arena",
    title: "Reader Arena",
    keywords: ["reader arena", "arena", "reader ranking", "reading leaderboard", "weekly reading rank", "all time ranking", "rank readers", "reading race", "ranking calculation", "ranking data", "rank ties", "dense rank", "arena data flow", "refresh leaderboard", "active reading seconds", "weekly migration"],
    screen: "profile",
    content: "Open **Profile** → **Reader Arena** to compare accepted active-reading time. The app normally batches usage after 10 seconds, sends up to 60 seconds per request, and flushes sooner when the daily allowance runs out. Each request includes the reader’s profile name and signed-in Supabase session. The server validates the account, then a service-role RPC stores the name plus lifetime and weekly seconds in `reading_companion_session_limits`. Book titles, page content, email and account IDs are not shown in the Arena; the server uses the account ID only to associate usage and mark your row as **You**. **This week** totals seconds recorded since Monday 00:00 in Asia/Kolkata; **All time** uses lifetime seconds. Readers with no recorded time are excluded. Equal totals share a rank; tied readers are displayed in a stable order by their private Supabase account ID. Weekly totals start when the Arena migration is applied; earlier time cannot be backfilled. Zero readers see an empty state, one reader gets a hero card, two readers get a two-step podium, and larger races get a three-person podium with the remaining ranks in a scrollable list. For 1–2 readers, use **Invite a friend to race**. When the screen opens or you change period, the app requests rankings from the server; use the refresh button to fetch again. It does not poll while open, though the weekly countdown updates every minute. The refresh button retries errors, and reconnecting retries an offline request. Your place stays pinned above the bottom navigation; the podium shows your photo only if **Show my photo in the Arena** is enabled.",
  },
  {
    id: "account-sync",
    title: "Account and Google sign-in",
    keywords: ["account", "google sign in", "continue with google", "sync now", "cloud backup", "sign out", "use account copy", "keep this device copy"],
    screen: "account",
    content: "Open **Profile** → **Account** for cloud backup. If you are signed out, the screen explains the account benefits and shows **Continue with Google**. If cloud data and device data differ, the app asks whether to **Use account copy** or **Keep this device’s copy**. When signed in, **Account** shows your Google email, sync status such as **Up to date**, **Syncing now** or **Needs attention**, and a **Sync now** action. **Sign out** disconnects this device from the account.",
  },
  {
    id: "settings",
    title: "Settings",
    keywords: ["settings", "your name", "companion name", "daily reading goal", "appearance", "theme", "voice", "preview this voice", "notifications", "reading limit", "30 minutes"],
    screen: "settings",
    demo: "settings",
    content: "Open **Profile** → **Settings**. **You & your companion** lets you edit your name, your companion’s name, and the **Daily reading goal**. **Appearance** switches between **Light** and **Dark**. **Voice** lets you pick a companion voice and use **Preview this voice**. **Notifications** contains **App updates & announcements** and **Smart study reminders**. **Reading limit** shows your account’s configured daily allowance and a contact link for increase requests; limit values are managed directly in Supabase.",
  },
  {
    id: "daily-reading-limit",
    title: "Daily reading allowance",
    keywords: ["30 minutes", "30 minute limit", "daily reading limit", "session cap", "reading allowance", "prototype limit", "extend the limit", "request more reading time", "increase reading limit", "reading limit request", "limit increase request", "limit email", "email to increase my limit"],
    screen: "settings",
    content: "Each signed-in account has a server-tracked daily reading allowance, set to **30 minutes by default** and shared across the account’s devices. The current limit and remaining time appear in **Profile → Settings → Reading limit**. When it runs out, the session ends and a notice offers **Contact Developer**. That action opens a pre-filled Gmail request with your Supabase UID and limit-increase context. The developer changes limit values directly in Supabase; there are no in-app admin controls.",
  },
  {
    id: "settings-data",
    title: "Privacy, storage, backup and delete data",
    keywords: ["privacy", "storage used", "clear conversation history", "clear saved preferences", "delete all gems", "export backup", "restore", "delete all my data", "deleted books", "trash bin", "restore a book"],
    screen: "settings",
    content: "In **Settings**, **Privacy & storage** shows what stays on your device and what is sent to Google Gemini during reading, plus a **Storage used** meter. It also includes **Show my photo in the Arena**. Enabled photos live in a private storage bucket and are served to signed-in Arena readers through short-lived links; turn the switch off to show initials instead. You can use **Clear conversation history**, **Clear saved preferences**, and **Delete all gems**. Open the **Deleted books** card to visit the separate bin page; archived books keep their chapters, linked gems and conversation recaps until restored or permanently deleted. **Reading limit** shows your account’s configured daily allowance. **Backup** offers **Export backup** and **Restore**. In **Danger zone**, **Delete all my data** erases books, gems, memory and profile after confirmation.",
  },
  {
    id: "notifications",
    title: "Notifications and reminders",
    keywords: ["notifications", "push notifications", "app updates announcements", "study reminders", "blocked notifications", "turn on notifications"],
    screen: "settings",
    content: "Turn notifications on in **Settings** → **Notifications**. **App updates & announcements** sends version news and important app notices, including a release announcement after a successful production deployment. **Smart study reminders** learns when you usually read and nudges you shortly before that time. OS push announcements require notification permission and the app-updates toggle; if notifications are blocked, the app can show device-specific steps for turning them back on.",
  },
  {
    id: "updates",
    title: "App updates and release notes",
    keywords: ["check for updates", "update available", "release notes", "version and release notes", "major update", "ui enhancement", "a new chapter", "signature update", "production deployment", "production deploy push", "deployment announcement", "automatic release push", "push after deploy"],
    screen: "settings",
    content: "Use **Settings** → **Check for updates** to look for a newer app version. The update card shows its version and changelog, with **Update now** and **Later** actions; **Version & release notes** opens the full history. Readers who enabled **App updates & announcements** can also receive an OS notification after a successful production deployment from `main`. Release cards can carry labels like **Major update**, **UI enhancement**, **A new chapter**, or **Signature update**.",
  },
  {
    id: "report-issue",
    title: "Report an issue",
    keywords: ["report an issue", "bug", "issue", "new feature", "improvement", "improve with ai", "use suggestion", "keep mine", "undo", "redo", "screenshots", "your reports", "status timeline"],
    screen: "report",
    demo: "report",
    content: "Open **Profile** → **Report an issue**. In **Raise an issue**, choose a **Category**, the screen or area where it happened, an optional seriousness level for faults, a title, details, optional reproduction steps, and up to four screenshots. **Improve with AI** can suggest cleaner wording; **Use suggestion**, **Keep mine**, **Undo** and **Redo** keep you in control. **Your reports** lists only your own reports, supports filtering and refresh, and shows the timeline stages **Queued**, **Sent**, **Seen**, **In review**, **Approved**, **In progress**, **Testing**, **Done**, or **Rejected**. A completed report can link straight to the version that fixed it.",
  },
  {
    id: "help-privacy",
    title: "Help chat and privacy",
    keywords: ["help privacy", "what does help send", "help chat ai", "help support privacy", "question history"],
    screen: "profile",
    content: "For a Help chat answer, the app sends only your question, up to four recent help messages, and a small matching excerpt from this guide. It never sends your books, saved words, gems, account details, or reading history. If the AI is unavailable, the screen falls back to guide-based answers and suggested topics.",
  },
  {
    id: "onboarding",
    title: "Welcome tour and first setup",
    keywords: ["welcome tour", "onboarding", "skip tour", "first setup", "genres", "daily goal", "captions"],
    screen: "profile",
    content: "On first launch, the welcome tour introduces the app with narration and animated scenes, then asks for your name, what you want to call your companion, your preferred genres, and your daily reading goal. **Skip** jumps straight to the setup form. If voice is unavailable, the tour can continue with captions and service notices.",
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting reading, mic, camera and connection problems",
    keywords: ["offline", "reconnecting", "getting ready", "mic not working", "camera not working", "permission", "service notice", "retry connection"],
    screen: "report",
    content: "Voice reading needs internet and mic permission. If the connection fails, use **Ask by typing**; text replies cannot save or edit items. For mic or snapshot trouble, allow permission in device settings and try a new page photo. If a response went off-topic, use **Re-sync** in **Transcript**. If the problem keeps happening, report it from **Profile** → **Report an issue**.",
  },
  {
    id: "about",
    title: "About",
    keywords: ["about", "why this app exists", "who built this", "developer", "contact"],
    screen: "profile",
    content: "Open **Profile** → **About** to read why Reading Companion exists, who it is for, its guiding ideas, the tools behind it, and the developer’s contact links.",
  },
];

export const HELP_GUIDE = [...BASE_HELP_GUIDE, ...buildReleaseGuideEntries()];

const STOP_WORDS = new Set([
  "about", "after", "all", "and", "any", "are", "can", "does", "for", "from", "have", "how", "into", "its",
  "need", "not", "the", "this", "that", "what", "when", "where", "which", "with", "you", "your", "please",
  "tell", "show", "work", "works", "just", "then", "there", "them",
]);

const RELEASE_QUERY_RE = /\b(which|when|show|list)\b.*\b(update|version|release|introduced|added|shipped|history|notes)\b|\b(release notes|release history|version history|what'?s new|whats new)\b/i;

function compareVersions(left, right) {
  const a = String(left || "").split(".").map(Number);
  const b = String(right || "").split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

function stem(word) {
  return word.length > 4 ? word.replace(/(ing|ed|es|s)$/, "") : word;
}

function tokens(text) {
  return (String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map(stem);
}

const RELEASE_FEATURE_NOISE = new Set(["update", "version", "release", "introduced", "added", "shipped", "which", "when", "new", "feature", "app", "history", "show", "list", "all", "past", "previous", "changelog", "notes", "note"]);
const RELEASE_ITEM_TOKENS = new Map(
  (Array.isArray(releaseNotes?.releases) ? releaseNotes.releases : []).map((release) => [
    `release-${release.version.replace(/\./g, "-")}`,
    (release.items || []).map((item) => new Set(tokens(sanitizeReleaseText(item?.text)))),
  ]),
);

// For "which update added X?", reward the release whose single item mentions all of X.
function releaseFeatureBonus(entryId, queryTokens) {
  const items = RELEASE_ITEM_TOKENS.get(entryId);
  const feature = [...queryTokens].filter((word) => !RELEASE_FEATURE_NOISE.has(word));
  if (!items || !feature.length) return 0;
  let best = 0;
  for (const itemTokens of items) {
    const hits = feature.filter((word) => itemTokens.has(word)).length;
    best = Math.max(best, hits === feature.length ? 14 : (hits / feature.length) * 4);
  }
  return best;
}

const INDEX = HELP_GUIDE.map((entry) => ({
  entry,
  keywordTokens: new Set(tokens(entry.keywords.join(" "))),
  titleTokens: new Set(tokens(entry.title)),
  contentTokens: new Set(tokens(entry.content)),
}));

export function findRelevantHelp(query, limit = 3) {
  const queryTokens = new Set(tokens(query));
  const normalizedQuery = String(query || "").toLowerCase();
  const asksForRelease = RELEASE_QUERY_RE.test(normalizedQuery);
  return INDEX.map(({ entry, keywordTokens, titleTokens, contentTokens }) => {
    let score = 0;
    if (queryTokens.has("ghost") && entry.id === "ghost-mode") score += 10;
    if (entry.id === "session-buttons" && !queryTokens.has("ghost") && /\b(button|buttons|control|controls|dock)\b/.test(normalizedQuery)) score += 6;
    if (entry.id === "story-recap" && /\bhear the story\b/.test(normalizedQuery)) score += 7;
    if (entry.id === "dashboard" && /\b(home|dashboard|continue reading|streak)\b/.test(normalizedQuery)) score += 6;
    if (entry.id === "dashboard-charts" && /\b(chart|charts|overall progress|gems this week|words by book|book progress|continue reading)\b/.test(normalizedQuery)) score += 7;
    if (entry.id === "streak" && /\bstreak\b/.test(normalizedQuery)) score += 7;
    if (entry.id === "recall-card" && /\b(revisit these|yaad tha|hint dekhein|agli baar|recall)\b/.test(normalizedQuery)) score += 7;
    if (entry.id === "updates" && /\b(check for updates|update available|release notes|version and release notes)\b/.test(normalizedQuery)) score += 8;
    if (entry.id === "updates" && /\b(production deploy|production deployment|deployment push|automatic release push)\b/.test(normalizedQuery)) score += 12;
    if (entry.id === "about" && /\babout\b/.test(normalizedQuery)) score += 7;
    if (entry.id === "settings" && /\b(setting|settings|theme|dark|light|voice|goal|notification|appearance)\b/.test(normalizedQuery)) score += 6;
    if (entry.id === "voice-commands" && /\b(voice|command|commands|say|companion can do|can i ask)\b/.test(normalizedQuery)) score += 7;
    if (entry.id === "session-progress" && /\b(progress|top|timer|chapter path|chapter progress)\b/.test(normalizedQuery)) score += 7;
    if (entry.kind === "release" && asksForRelease) score += 6;
    if (entry.kind === "release" && asksForRelease) score += releaseFeatureBonus(entry.id, queryTokens);
    if (entry.kind !== "release" && asksForRelease) score -= 1;
    for (const word of queryTokens) {
      if (keywordTokens.has(word)) score += 3;
      if (titleTokens.has(word)) score += 2;
      if (contentTokens.has(word)) score += 0.5;
    }
    for (const keyword of entry.keywords) {
      const lower = keyword.toLowerCase();
      if (lower.includes(" ") && normalizedQuery.includes(lower)) score += 4;
    }
    return { ...entry, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function getRelevantHelp(query) {
  return findRelevantHelp(query, 1)[0] || null;
}

const HELP_GUIDE_TAGLINE = "If you want, you can always ask **Help & guide** about the next step too.";

const SHORT_ANSWERS = {
  "camera-options": "1. **Snap page** or **Page snapshot** sends one still photo. The app checks whether it shows book text; an unreadable photo asks you to retake it.\n2. When verification is unavailable, the companion will not read lines from that photo. Share a clear page and enter its printed number if needed. **Next page** replaces the previous photo. Snapshot mode has no live camera video.\n\nIf you want, you can always ask **Help & guide** about the next step too.",
  "session-buttons": "1. Use **Snap page**, **Tap to ask** / **Done speaking**, optional **Hands-free**, or **Ask by typing** above the reading dock.\n2. The dock has **Mic**, **Page snapshot**, **Transcript**, **Ghost** and **End session**; Transcript includes **Re-sync**.\n\nIf you want, you can always ask **Help & guide** about the next step too.",
  "ghost-mode": "1. Turn on **Ghost** in the reading dock to hear ideas through the author’s themes and perspective.\n2. It works best after you have set the author for that book in **Library**.\n\nIf you want, you can always ask **Help & guide** about the next step too.",
  "story-recap": "1. Tap the **Play** icon on a **Library** book tile to open the recap card, then use **Hear the story** beside **Start Reading**.\n2. Story theatre gives you **Pause**, **Captions**, **Mute**, **Replay**, and a final **Padhna shuru karo** button.\n\nIf you want, you can always ask **Help & guide** about the next step too.",
};

export function buildShortHelpAnswer(topic) {
  if (!topic) return "I couldn't find a reliable answer in the guide. Try **Browse topics** or **Report an issue**.";
  if (topic.id === "save-items") {
    return "1. Ask what a word means, then say yes to save it in the chapter’s **Vocabulary**.\n2. Say **save this line** for a quote; saved quotes appear in **Gems**.\n\nIf you want, you can always ask **Help & guide** about the next step too.";
  }
  if (SHORT_ANSWERS[topic.id]) return SHORT_ANSWERS[topic.id];
  const sentences = topic.content.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean) || [topic.content];
  const core = sentences.slice(0, 2).map((sentence, index) => `${index + 1}. ${sentence}`).join("\n");
  return `${core}\n\n${HELP_GUIDE_TAGLINE}`;
}
