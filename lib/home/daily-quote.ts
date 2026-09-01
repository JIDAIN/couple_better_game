export const DAILY_QUOTES = [
  "坚持不是惩罚，而是一起成长 ❤️",
  "今天也慢慢来，已经很棒啦 🌷",
  "不用完美，愿意记录就很厉害 ✨",
  "小小一步，也是在靠近更好的自己 🫧",
  "今天的认真，都会变成明天的轻松 🍃",
  "一起把今天过得软软亮亮一点 ☁️",
  "没有白走的路，每一步都算数 🌱",
  "今天先照顾好自己，也是一种胜利 🫶",
  "慢一点也没关系，我们是在往前走 🌙",
  "把小努力放进口袋，明天会看见光 ✨",
];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function hashDateKey(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getDailyQuote(dateKey = formatLocalDateKey()) {
  return DAILY_QUOTES[hashDateKey(dateKey) % DAILY_QUOTES.length];
}
