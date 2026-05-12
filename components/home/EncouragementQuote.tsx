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
      className="ui-card-soft bg-gradient-to-r from-rose-50/80 via-white/65 to-amber-50/75 px-4 py-4 text-center"
      aria-label="今日鼓励"
    >
      <p className="text-[10px] font-semibold tracking-[0.16em] text-rose-400/90">
        今日小纸条
      </p>
      <p className="mt-2 text-[14px] font-semibold leading-relaxed text-stone-700">
        {text}
      </p>
    </section>
  );
}
