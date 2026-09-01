"use client";

import { Select as AnimalSelect, type SelectProps as AnimalSelectProps } from "animal-island-ui";

export type AppSelectProps = AnimalSelectProps;

export function AppSelect(props: AppSelectProps) {
  return <AnimalSelect {...props} />;
}
