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

const variantClass: Record<AppButtonVariant, string> = {
  primary: "app-button app-button--primary",
  secondary: "app-button app-button--secondary",
  ghost: "app-button app-button--ghost",
  danger: "app-button app-button--danger",
  nav: "app-button app-button--nav",
  tab: "app-button app-button--tab",
  plain: "app-button app-button--plain",
};

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ variant = "secondary", className = "", type = "button", ...props }, ref) => {
    const hostRef = useRef<HTMLSpanElement>(null);
    useImperativeHandle(
      ref,
      () => hostRef.current?.querySelector("button") as HTMLButtonElement,
      [],
    );
    const classVariant =
      className.includes("app-button--primary")
        ? "primary"
        : className.includes("app-button--danger")
          ? "danger"
          : className.includes("app-button--ghost")
            ? "ghost"
            : className.includes("app-button--nav")
              ? "nav"
              : className.includes("app-button--tab")
                ? "tab"
                : className.includes("app-button--plain")
                  ? "plain"
                  : className.includes("app-button--secondary")
                    ? "secondary"
                    : variant;
    const animalType =
      classVariant === "primary" || classVariant === "danger"
        ? "primary"
        : classVariant === "ghost" || classVariant === "plain"
          ? "text"
          : "default";

    return (
      <span ref={hostRef} className="app-ref-host">
        <AnimalButton
          {...props}
          htmlType={type}
          type={animalType}
          danger={classVariant === "danger"}
          className={`${variantClass[classVariant]} ${className}`.trim()}
        />
      </span>
    );
  },
);

AppButton.displayName = "AppButton";
