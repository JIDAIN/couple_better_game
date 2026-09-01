import { Icon, type IconName } from "animal-island-ui";
import type { CSSProperties } from "react";

export type AppIconProps = {
  name: IconName;
  size?: number;
  bounce?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function AppIcon({
  name,
  size = 20,
  bounce = false,
  className,
  style,
}: AppIconProps) {
  return (
    <Icon
      name={name}
      size={size}
      bounce={bounce}
      className={className}
      style={style}
    />
  );
}
