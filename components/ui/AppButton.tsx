"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Button as AnimalButton, type ButtonProps as AnimalButtonProps } from "animal-island-ui";

export type AppButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "nav"
  | "tab"
  | "plain";

export type AppButtonProps = Omit<AnimalButtonProps, "type" | "danger" | "htmlType"> & {
  variant?: AppButtonVariant;
  type?: "button" | "submit" | "reset";
};

const legacyVariantClasses = [
  "app-button",
  "is-primary",
  "is-secondary",
  "is-ghost",
  "is-danger",
  "is-nav",
  "is-tab",
  "is-plain",
];

function stripLegacyButtonClasses(className: string) {
  return className
    .split(/\s+/)
    .filter((item) => item && !legacyVariantClasses.includes(item))
    .join(" ");
}

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ variant = "secondary", className = "", type = "button", ...props }, ref) => {
    const hostRef = useRef<HTMLSpanElement>(null);
    useImperativeHandle(
      ref,
      () => hostRef.current?.querySelector("button") as HTMLButtonElement,
      [],
    );
    const classVariant =
      className.includes("is-primary")
        ? "primary"
        : className.includes("is-danger")
          ? "danger"
          : className.includes("is-ghost")
            ? "ghost"
            : className.includes("is-nav")
              ? "nav"
              : className.includes("is-tab")
                ? "tab"
                : className.includes("is-plain")
                  ? "plain"
                  : className.includes("is-secondary")
                    ? "secondary"
                    : variant;
    const animalType =
      classVariant === "primary" || classVariant === "danger"
        ? "primary"
        : classVariant === "ghost" || classVariant === "plain"
          ? "text"
          : "default";

    const layoutClassName = stripLegacyButtonClasses(className);

    return (
      <span ref={hostRef} className="app-ref-host">
        <AnimalButton
          {...props}
          htmlType={type}
          type={animalType}
          danger={classVariant === "danger"}
          ghost={classVariant === "ghost"}
          className={layoutClassName}
          data-app-button-variant={classVariant}
        />
      </span>
    );
  },
);

AppButton.displayName = "AppButton";

