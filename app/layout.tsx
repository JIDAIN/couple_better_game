import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🐟和🐱变美变瘦大作战",
  description: "双人同行的温柔成长小页游：宝石、金币与五月成就地图。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
