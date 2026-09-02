import { Suspense } from "react";
import { LifeLoginPage } from "@/components/auth/LifeLoginPage";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="island-life-v2 min-h-screen bg-[var(--life-bg)]" />}>
      <LifeLoginPage />
    </Suspense>
  );
}
