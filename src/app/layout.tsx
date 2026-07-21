import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "chatWords — 像聊天一样背单词",
  description: "藏在聊天页面里的本地背单词工具。无需登录，没有后端。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
