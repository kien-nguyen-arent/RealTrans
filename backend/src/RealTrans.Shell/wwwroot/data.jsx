/* data.jsx — scenarios, translations, OCR regions
   Each scenario is a "scene" that fills the desktop window.
   Each declares its translatable regions in scene-local % coords.
*/

const SCENARIOS = {
  browser: {
    id: "browser",
    label: "Browser",
    sub: "Foreign-language article",
    icon: "browser",
    mode: "Document",
    hint: "Long-form text. Translate paragraph-by-paragraph or full-page.",
  },
  anime: {
    id: "anime",
    label: "Anime",
    sub: "Hardcoded subtitles",
    icon: "play",
    mode: "Subtitles",
    hint: "Bottom-third subtitle band. Auto-track, smooth, replace in-place.",
  },
  game: {
    id: "game",
    label: "Game",
    sub: "JRPG dialogue + menus",
    icon: "joystick",
    mode: "Gaming",
    hint: "Persistent dialogue box. Pinned region follows the game window.",
  },
  manga: {
    id: "manga",
    label: "Manga",
    sub: "Speech bubbles",
    icon: "manga",
    mode: "Manga",
    hint: "Auto-detect each bubble. Match original lettering style.",
  },
  meeting: {
    id: "meeting",
    label: "Meeting",
    sub: "Live captions",
    icon: "video",
    mode: "Live",
    hint: "Streamed audio. Speaker-aware. Lower-thirds caption strip.",
  },
};

/* ──────────────────────────────────────────────────────────────
   Browser scene — a Japanese tech article (mocked, original text)
   Each paragraph is a translatable region.
   ────────────────────────────────────────────────────────────── */
const BROWSER_ARTICLE = {
  url: "https://www.itmedia.co.jp/news/articles/realtrans-feature",
  site: "ITmedia NEWS",
  date: "2026年5月12日 09:14",
  author: "森田 健司",
  title: "翻訳の未来は「画面の上」にある",
  subtitle: "RealTrans が変える、リアルタイム翻訳の体験",
  paragraphs: [
    {
      jp: "従来の翻訳ツールは、原文をコピーして別ウィンドウで結果を表示するという、いわば「往復」の操作を強いてきた。",
      en: "Traditional translation tools have forced what amounts to a round-trip: copy the source, paste it elsewhere, then read the result in a separate window.",
    },
    {
      jp: "しかし、ユーザーが本当に欲しいのは結果ではなく、原文の意味そのものだ。意味は、原文があった場所にこそ宿る。",
      en: "But what users actually want isn't the result — it's the meaning of the source itself. And meaning belongs in the place the source occupied.",
    },
    {
      jp: "RealTrans はその発想を逆転させる。翻訳結果を別の場所に持ち出すのではなく、原文の上にそっと重ねる。読む流れを一切止めない。",
      en: "RealTrans inverts that idea. Instead of moving the translation somewhere else, it lays it gently over the source. The reading flow is never broken.",
    },
  ],
};

/* ──────────────────────────────────────────────────────────────
   Anime — subtitle lines that "play"
   ────────────────────────────────────────────────────────────── */
const ANIME_TIMELINE = [
  { t: 0, jp: "今夜、君に伝えたいことがある。", en: "There's something I want to tell you tonight." },
  { t: 4200, jp: "ずっと、ずっと前から。", en: "I've felt this way for a long, long time." },
  { t: 7800, jp: "返事は急がなくていい。", en: "You don't have to answer right away." },
  { t: 11400, jp: "ただ、聞いてほしかったんだ。", en: "I just wanted you to hear it." },
];

/* ──────────────────────────────────────────────────────────────
   Game — JRPG dialogue box
   ────────────────────────────────────────────────────────────── */
const GAME_SCENE = {
  speaker: { jp: "アイリス", en: "Iris" },
  lines: [
    { jp: "ここから先は、君ひとりで進むしかない。", en: "Beyond this point, you have to go alone." },
    { jp: "わたしの加護は、もう届かない場所だ。", en: "My blessing cannot reach where you're going." },
  ],
  menu: [
    { jp: "話す", en: "Talk" },
    { jp: "調べる", en: "Examine" },
    { jp: "アイテム", en: "Items" },
    { jp: "去る", en: "Leave" },
  ],
};

/* ──────────────────────────────────────────────────────────────
   Manga — bubbles with positions
   ────────────────────────────────────────────────────────────── */
const MANGA_BUBBLES = [
  // each bubble: position (% of page), size, original JP, EN, style hint
  { id: "b1", x: 18, y: 14, w: 22, h: 10, jp: "また、お前か。", en: "You again.", style: "normal", shape: "oval" },
  { id: "b2", x: 60, y: 22, w: 26, h: 12, jp: "懲りないやつだな。", en: "You never learn, do you.", style: "normal", shape: "oval" },
  { id: "b3", x: 28, y: 60, w: 30, h: 16, jp: "今度は\n本気でいく。", en: "This time\nI'm serious.", style: "bold", shape: "spike" },
  { id: "b4", x: 66, y: 70, w: 24, h: 10, jp: "ふん。", en: "Hmph.", style: "normal", shape: "oval" },
];

/* ──────────────────────────────────────────────────────────────
   Meeting — speakers + caption stream
   ────────────────────────────────────────────────────────────── */
const MEETING_PARTICIPANTS = [
  { id: "yuki", name: "Yuki Tanaka", role: "Tokyo · Design", color: "#f5b75e", initials: "YT" },
  { id: "jordan", name: "Jordan Park", role: "NY · PM", color: "#8b7cff", initials: "JP" },
  { id: "mei", name: "Mei Saito", role: "Osaka · Eng", color: "#5eead4", initials: "MS" },
];

const MEETING_TIMELINE = [
  { speaker: "yuki", t: 0, jp: "プロトタイプ、思ったよりも反応が良かったです。", en: "The prototype got a much better reception than I expected." },
  { speaker: "mei", t: 3500, jp: "OCRの精度はどのくらいまで来てる？", en: "How far has OCR accuracy come along?" },
  { speaker: "yuki", t: 7000, jp: "日本語の縦書きでも九割超えてます。", en: "We're past 90% even on vertical Japanese." },
];

/* expose */
Object.assign(window, {
  SCENARIOS,
  BROWSER_ARTICLE,
  ANIME_TIMELINE,
  GAME_SCENE,
  MANGA_BUBBLES,
  MEETING_PARTICIPANTS,
  MEETING_TIMELINE,
});
