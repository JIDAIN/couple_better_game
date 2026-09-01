export type RoleKind = "fish" | "cat";

export type AppRoleAvatarProps = {
  role: RoleKind;
  size?: number;
  className?: string;
};

const ROLE_LABEL: Record<RoleKind, string> = {
  fish: "鱼鱼",
  cat: "猫猫",
};

/**
 * Priority-1: Public user-provided avatar images.
 *
 * Expected paths:
 *   /assets/avatars/fish.png (or .svg)
 *   /assets/avatars/cat.png (or .svg)
 *
 * Phase 7 will add user-uploadable custom avatars.
 * When a file is placed at the expected path, it renders automatically.
 */
/* Phase 7 — Public avatar path registry (uncomment to activate):
 * const PUBLIC_AVATAR_PATH: Partial<Record<RoleKind, string>> = {
 *   fish: "/assets/avatars/fish.svg",
 *   cat: "/assets/avatars/cat.svg",
 * }; */

/**
 * Priority-2: Emoji fallback.
 */
const ROLE_EMOJI: Record<RoleKind, string> = {
  fish: "\u{1F41F}",
  cat: "\u{1F431}",
};

/**
 * Player character avatar component.
 *
 * Priority chain:
 * 1. Public user-provided avatar image (when path is configured)
 * 2. Emoji fallback
 *
 * Phase 7: user-uploadable custom avatar images, similar to WeChat profile photo.
 * All call sites go through this wrapper so the migration is a single-point change.
 */
export function AppRoleAvatar({
  role,
  size = 24,
  className,
}: AppRoleAvatarProps) {
  // TODO Phase 7: when user avatar image exists, uncomment PUBLIC_AVATAR_PATH
  // entry and add an <img> branch here (first in priority chain).

  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1 }}
      role="img"
      aria-label={ROLE_LABEL[role]}
    >
      {ROLE_EMOJI[role]}
    </span>
  );
}
