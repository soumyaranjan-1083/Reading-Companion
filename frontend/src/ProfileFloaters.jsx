import { BookOpen, Bookmark, Feather, Gem, Quote, Sparkles } from "lucide-react";

// Faint, slowly drifting reading symbols that fill the empty space beside the avatar.
const ITEMS = [
  { Icon: BookOpen, x: 8, y: 12, s: 24, d: 0, t: "var(--pc-a)" },
  { Icon: Feather, x: 24, y: 70, s: 20, d: -2, t: "var(--pc-b)" },
  { Icon: Sparkles, x: 20, y: 30, s: 13, d: -4, t: "var(--pc-c)" },
  { Icon: Bookmark, x: 90, y: 14, s: 22, d: -1, t: "var(--pc-c)" },
  { Icon: Gem, x: 76, y: 66, s: 20, d: -3, t: "var(--pc-b)" },
  { Icon: Quote, x: 92, y: 52, s: 18, d: -5, t: "var(--pc-a)" },
  { Icon: Sparkles, x: 78, y: 28, s: 11, d: -2.5, t: "var(--pc-a)" },
  { Icon: "Aa", x: 6, y: 52, s: 15, d: -3.5, t: "var(--pc-c)" },
  { Icon: BookOpen, x: 9, y: 88, s: 17, d: -1.5, t: "var(--pc-b)" },
  { Icon: Sparkles, x: 91, y: 88, s: 12, d: -4.5, t: "var(--pc-a)" },
];

export default function ProfileFloaters() {
  return (
    <span className="pc-float" aria-hidden="true">
      {ITEMS.map(({ Icon, x, y, s, d, t }, i) => (
        <i key={i} style={{ left: `${x}%`, top: `${y}%`, color: t, animationDelay: `${d}s`, animationDuration: `${7 + (i % 3) * 1.6}s` }}>
          {typeof Icon === "string" ? <b style={{ fontSize: s }}>{Icon}</b> : <Icon size={s} strokeWidth={1.8} />}
        </i>
      ))}
    </span>
  );
}
