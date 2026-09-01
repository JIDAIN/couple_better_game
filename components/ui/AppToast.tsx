import type { HTMLAttributes } from "react";

export type AppToastProps = HTMLAttributes<HTMLDivElement>;

export function AppToast({ className = "", ...props }: AppToastProps) {
  return (
    <div
      {...props}
      role={props.role ?? "status"}
      aria-live={props["aria-live"] ?? "polite"}
      className={`app-toast ${className}`.trim()}
    />
  );
}
