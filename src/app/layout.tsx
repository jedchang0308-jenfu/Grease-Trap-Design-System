import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "油脂截留器計算系統", template: "%s｜油脂截留器計算系統" },
  description: "鉦富機械內部使用的油脂截留器雙軌計算與工程覆核系統",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <a className="skip-link" href="#main-content">
          跳至主要內容
        </a>
        <header className="app-header">
          <Link className="brand" href="/cases">
            油脂截留器計算系統
          </Link>
          <nav className="app-nav" aria-label="主要導覽">
            <Link href="/cases">案件</Link>
            <Link href="/rules">規則</Link>
          </nav>
        </header>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
