"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Input as AnimalInput, type InputProps as AnimalInputProps } from "animal-island-ui";

export type AppInputProps = AnimalInputProps & {
  inputSize?: AnimalInputProps["size"];
};

export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(
  ({ className = "", inputSize, size, ...props }, ref) => {
    const hostRef = useRef<HTMLSpanElement>(null);
    useImperativeHandle(
      ref,
      () => hostRef.current?.querySelector("input") as HTMLInputElement,
      [],
    );

    return (
      <span ref={hostRef} className="app-ref-host">
        <AnimalInput
          {...props}
          size={inputSize ?? size}
          className={`app-input ${className}`.trim()}
        />
      </span>
    );
  },
);

AppInput.displayName = "AppInput";
