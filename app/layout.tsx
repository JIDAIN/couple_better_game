import type { Metadata, Viewport } from "next";
import { Cursor } from "animal-island-ui";
import "animal-island-ui/style";
import "./globals.css";
import "./island-life-tokens.css";

export const metadata: Metadata = {
  applicationName: "🐟和🐱变美变瘦大作战",
  title: "🐟和🐱变美变瘦大作战",
  description: "双人同行的温柔成长小页游：金币、宝石与五月成就地图。",
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
    title: "变美变瘦",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffb6cb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <Cursor className="app-cursor-root">{children}</Cursor>
      </body>
    </html>
  );
}
