"use client";

import { useEffect } from "react";

export function LifeServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/life-sw.js", { scope: "/", updateViaCache: "none" });
      } catch {
        // Offline support is progressive enhancement; never block the app if registration is unavailable.
      }
    };
    void register();
  }, []);

  return null;
}
