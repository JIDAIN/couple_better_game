import { Suspense } from "react";
import { LifeAppShell } from "@/components/life/LifeAppShell";
import { LifeMealEditorPage } from "@/components/life/LifeMealEditorPage";

export default function FoodEditPage() {
  return (
    <LifeAppShell>
      <Suspense fallback={<div className="island-life-v2 min-h-screen bg-[var(--life-bg)]" />}>
        <LifeMealEditorPage />
      </Suspense>
    </LifeAppShell>
  );
}
