export type LifeGameStatus = "available" | "coming_soon";

export type LifeGameRegistryItem = {
  gameKey: string;
  title: string;
  description: string;
  icon: string;
  status: LifeGameStatus;
  route: string | null;
};

export const lifeGameRegistry: readonly LifeGameRegistryItem[] = [
  {
    gameKey: "beauty-slim-game",
    title: "变美变瘦大作战",
    description: "原有宝石、金币、兑换与结算玩法完整保留。",
    icon: "💎",
    status: "available",
    route: "/game",
  },
  {
    gameKey: "future-game-slot",
    title: "下一台小游戏",
    description: "以后新的小游戏从这里加入，不和生活记录混在一起。",
    icon: "🕹️",
    status: "coming_soon",
    route: null,
  },
] as const;

export function availableLifeGames() {
  return lifeGameRegistry.filter((game) => game.status === "available" && game.route);
}
