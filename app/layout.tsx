import type { Metadata, Viewport } from "next";
import { Cursor } from "animal-island-ui";
import { LifeIdentityProvider } from "@/components/life/LifeIdentityContext";
import { PersistentLifeChrome } from "@/components/life/PersistentLifeChrome";
import { LifeServiceWorker } from "@/components/life/LifeServiceWorker";
import "animal-island-ui/style";
import "./globals.css";
import "./island-life-tokens.css";
import "./island-life-refactor.css";
import "./r8-ui-closeout.css";
import "./r8-2-ui-calibration.css";
import "./r8-2-mailbox.css";
import "./r8-3-visual-polish.css";
import "./r8-3-hotfix.css";
import "./mailbox-visual-closeout.css";

export const metadata: Metadata = {
  applicationName: "岛屿生活",
  title: "岛屿生活",
  description: "属于两个人的轻量生活记录：心情、睡眠、活动、饮食与小窝。",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "岛屿生活",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#aedcc8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <LifeIdentityProvider>
          <Cursor className="app-cursor-root">
            <PersistentLifeChrome>{children}</PersistentLifeChrome>
          </Cursor>
          <LifeServiceWorker />
        </LifeIdentityProvider>
      </body>
    </html>
  );
}
