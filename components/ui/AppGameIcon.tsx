import { Icon, type IconName } from "animal-island-ui";

/**
 * All semantic icon names used in the game UI.
 * Every visible emoji/icon in the app must map to one of these keys.
 */
export type GameIconName =
  | "fish"
  | "cat"
  | "gem"
  | "coin"
  | "fire"
  | "run"
  | "sparkle"
  | "flower"
  | "calendar"
  | "map"
  | "shop"
  | "nest"
  | "log"
  | "data"
  | "rules"
  | "notebook"
  | "gift"
  | "recovery"
  | "info";

export type AppGameIconProps = {
  name: GameIconName;
  size?: number;
  className?: string;
};

/**
 * Priority-1: Public user-provided game / animal-crossing assets.
 *
 * When a file matching the path below is placed in public/,
 * it will be used automatically. No code change required.
 *
 * Expected paths (all under public/assets/icons/):
 *   fish.png / fish.svg, cat.png / cat.svg,
 *   gem.png, coin.png, fire.png, run.png,
 *   calendar.png, nest.png, etc.
 *
 * Current state: all empty — falls through to official Icon or emoji.
 */
/* Phase 7 — Public asset path registry (uncomment to activate):
 * const PUBLIC_ASSET_PATH: Partial<Record<GameIconName, string>> = {
 *   fish: "/assets/icons/fish.svg",
 *   cat: "/assets/icons/cat.svg",
 *   gem: "/assets/icons/gem.svg",
 *   coin: "/assets/icons/coin.svg",
 *   fire: "/assets/icons/fire.svg",
 *   run: "/assets/icons/run.svg",
 *   sparkle: "/assets/icons/sparkle.svg",
 *   flower: "/assets/icons/flower.svg",
 *   calendar: "/assets/icons/calendar.svg",
 *   nest: "/assets/icons/nest.svg",
 * }; */

/**
 * Priority-2: animal-island-ui official Icon.
 * Only keys with a matching official Icon are listed.
 */
const OFFICIAL_ICON_MAP: Partial<Record<GameIconName, IconName>> = {
  map: "icon-map",
  shop: "icon-shopping",
  gift: "icon-shopping",
  log: "icon-design",
  notebook: "icon-design",
  data: "icon-diy",
  rules: "icon-critterpedia",
};

/**
 * Priority-3: Emoji fallback — wrapper-internal only, never exposed to page JSX.
 */
const EMOJI_FALLBACK: Record<GameIconName, string> = {
  fish: "\u{1F41F}",
  cat: "\u{1F431}",
  gem: "\u{1F48E}",
  coin: "\u{1FA99}",
  fire: "\u{1F525}",
  run: "\u{1F3C3}",
  sparkle: "✨",
  flower: "\u{1F337}",
  calendar: "\u{1F4C5}",
  nest: "\u{1F3E0}",
  map: "\u{1F5FA}️",
  shop: "\u{1F381}",
  gift: "\u{1F381}",
  log: "\u{1F4D2}",
  notebook: "\u{1F4D2}",
  data: "\u{1F4E4}",
  rules: "\u{1F4CB}",
  recovery: "\u{1F504}",
  info: "\u{1F4A1}",
};

/**
 * Unified game icon component.
 *
 * Priority chain (first match wins):
 * 1. Public user-provided asset image (when path is configured and file exists)
 * 2. animal-island-ui official Icon
 * 3. Emoji fallback (wrapper-internal)
 */
export function AppGameIcon({ name, size = 20, className }: AppGameIconProps) {
  // TODO Phase 7: when public asset exists, uncomment PUBLIC_ASSET_PATH entry
  // and add an <img> branch here (first in priority chain).

  const official = OFFICIAL_ICON_MAP[name];
  if (official) {
    return (
      <Icon
        name={official}
        size={size}
        className={className}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden="true"
    >
      {EMOJI_FALLBACK[name]}
    </span>
  );
}
