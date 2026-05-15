import type { ExchangeCategory } from "./types";

export const DEFAULT_EXCHANGE_CATEGORIES: ExchangeCategory[] = [
  {
    id: "snack",
    title: "零食",
    icon: "🍪",
    description: "轻轻松松来一点，小小满足一下",
    resourceKind: "gem",
    price: 5,
  },
  {
    id: "drink",
    title: "双份零食",
    icon: "🍿",
    description: "给认真努力的自己，再多一点奖励",
    resourceKind: "gem",
    price: 8,
  },
  {
    id: "double-drink",
    title: "双份饮料",
    icon: "🥤",
    description: "双人份的小快乐，备注里写清楚就好",
    resourceKind: "gem",
    price: 15,
  },
  {
    id: "dinner",
    title: "大餐",
    icon: "🍝",
    description: "热乎乎的一顿，适合记账",
    resourceKind: "coin",
    price: 4,
  },
  {
    id: "deluxe-dinner",
    title: "豪华大餐",
    icon: "🍰",
    description: "更丰盛一点，像周末的小奖励",
    resourceKind: "coin",
    price: 8,
  },
  {
    id: "family",
    title: "家庭放纵餐",
    icon: "🏠",
    description: "给特殊时刻留一笔温柔的奖励",
    resourceKind: "gem",
    price: 15,
  },
];
