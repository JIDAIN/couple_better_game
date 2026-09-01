import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Modal as AnimalModal, type ModalProps as AnimalModalProps } from "animal-island-ui";

export type AppModalProps = AnimalModalProps;

export function AppModal({
  className = "",
  typewriter = false,
  ...props
}: AppModalProps) {
  return (
    <AnimalModal
      {...props}
      className={`app-stable-modal ${className}`.trim()}
      typewriter={typewriter}
    />
  );
}

export function AppDialogShell({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`app-dialog-shell ${className}`.trim()}>
      {children}
    </div>
  );
}

export function AppDialogHeader({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`app-dialog-header ${className}`.trim()}>
      {children}
    </div>
  );
}

export function AppDialogBody({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`app-dialog-body ${className}`.trim()}>
      {children}
    </div>
  );
}

export function AppDialogFooter({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`app-dialog-footer ${className}`.trim()}>
      {children}
    </div>
  );
}

export type AppDialogBackdropProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

export function AppDialogBackdrop({
  className = "",
  children,
  ...props
}: AppDialogBackdropProps) {
  return (
    <button {...props} className={`app-dialog-backdrop ${className}`.trim()}>
      {children}
    </button>
  );
}
