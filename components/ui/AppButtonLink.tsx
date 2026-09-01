import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { AppButtonVariant } from "./AppButton";

export type AppButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    variant?: Extract<AppButtonVariant, "primary" | "secondary" | "ghost" | "nav">;
  };

const variantClass: Record<NonNullable<AppButtonLinkProps["variant"]>, string> = {
  primary: "app-button-link is-primary",
  secondary: "app-button-link is-secondary",
  ghost: "app-button-link is-ghost",
  nav: "app-button-link is-nav",
};

export function AppButtonLink({
  variant = "secondary",
  className = "",
  children,
  ...props
}: AppButtonLinkProps) {
  return (
    <a {...props} className={`${variantClass[variant]} ${className}`.trim()}>
      {children}
    </a>
  );
}

