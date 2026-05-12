"use client";

import { useEffect, useState } from "react";

const quotes = [
  "今天也是一起发光的一天 ✨",
  "坚持不是惩罚，而是一起成长 ❤️",
  "小小进步，也值得获得宝石 💎",
  "慢慢来，你们在并肩走得很稳 🌙",
  "没有满分也没关系，有彼此就很加分 🫧",
  "把今天轻轻放进回忆里，明天继续冒险 🎀",
];

export function EncouragementQuote() {
  const [text, setText] = useState(quotes[0]);

  useEffect(() => {
    setText(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  return (
    <section
      className="rounded-2xl border border-rose-100/70 bg-gradient-to-r from-rose-50/90 via-white/70 to-amber-50/80 px-4 py-4 text-center shadow-sm shadow-rose-100/40"
      aria-label="今日鼓励"
    >
      <p className="text-[11px] font-semibold tracking-wide text-rose-400/90">
        今日小纸条
      </p>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-stone-700">
        {text}
      </p>
    </section>
  );
}
