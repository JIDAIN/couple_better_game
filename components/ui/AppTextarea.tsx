import { forwardRef, type TextareaHTMLAttributes } from "react";

export type AppTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const AppTextarea = forwardRef<HTMLTextAreaElement, AppTextareaProps>(
  ({ className = "", ...props }, ref) => (
    <textarea {...props} ref={ref} className={`app-textarea ${className}`.trim()} />
  ),
);

AppTextarea.displayName = "AppTextarea";
