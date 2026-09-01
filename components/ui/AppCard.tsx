import { forwardRef, useImperativeHandle, useRef } from "react";
import { Card as AnimalCard, type CardProps as AnimalCardProps } from "animal-island-ui";

export type AppCardVariant =
  | "default"
  | "soft"
  | "hero"
  | "main"
  | "compact"
  | "item"
  | "panel";

export type AppCardProps = Omit<AnimalCardProps, "type"> & {
  variant?: AppCardVariant;
  type?: AnimalCardProps["type"];
};

const legacyCardClasses = [
  "app-card",
];

function stripLegacyCardClasses(className: string) {
  return className
    .split(/\s+/)
    .filter((item) => item && !legacyCardClasses.includes(item))
    .join(" ");
}

const layoutVariantClass: Record<AppCardVariant, string> = {
  default: "layout-card-default",
  soft: "layout-card-soft",
  hero: "layout-card-hero",
  main: "layout-card-main",
  compact: "layout-card-compact",
  item: "layout-card-item",
  panel: "layout-card-panel",
};

export const AppCard = forwardRef<HTMLDivElement, AppCardProps>(
  ({ variant = "default", className = "", type, color, ...props }, ref) => {
    const hostRef = useRef<HTMLSpanElement>(null);
    useImperativeHandle(
      ref,
      () => hostRef.current?.querySelector("div") as HTMLDivElement,
      [],
    );

    const officialType = type ?? "default";

    return (
      <span ref={hostRef} className="app-ref-host">
        <AnimalCard
          {...props}
          type={officialType}
          color={color}
          className={`${layoutVariantClass[variant]} ${stripLegacyCardClasses(className)}`.trim()}
          data-app-card-variant={variant}
        />
      </span>
    );
  },
);

AppCard.displayName = "AppCard";

