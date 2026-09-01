import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { AppButtonVariant } from "./AppButton";

export type AppButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    variant?: Extract<AppButtonVariant, "primary" | "secondary" | "ghost" | "nav">;
  };

const variantClass: Record<NonNullable<AppButtonLinkProps["variant"]>, string> = {
  primary: "app-button app-button-link app-button--primary",
  secondary: "app-button app-button-link app-button--secondary",
  ghost: "app-button app-button-link app-button--ghost",
  nav: "app-button app-button-link app-button--nav",
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
