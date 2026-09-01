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

const variantClass: Record<AppCardVariant, string> = {
  default: "app-card app-card--default",
  soft: "app-card app-card--soft",
  hero: "app-card app-card--hero",
  main: "app-card app-card--main",
  compact: "app-card app-card--compact",
  item: "app-card app-card--item",
  panel: "app-card app-card--panel",
};

export const AppCard = forwardRef<HTMLDivElement, AppCardProps>(
  ({ variant = "default", className = "", type, color, ...props }, ref) => {
    const hostRef = useRef<HTMLSpanElement>(null);
    useImperativeHandle(
      ref,
      () => hostRef.current?.querySelector("div") as HTMLDivElement,
      [],
    );

    const officialType = type ?? (variant === "hero" ? "title" : "default");

    return (
      <span ref={hostRef} className="app-ref-host">
        <AnimalCard
          {...props}
          type={officialType}
          color={color}
          className={`${variantClass[variant]} ${className}`.trim()}
        />
      </span>
    );
  },
);

AppCard.displayName = "AppCard";
