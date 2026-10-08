import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const roundedChinese = localFont({
  src: "./fonts/ZCOOLKuaiLe-Regular.ttf",
  variable: "--font-goalio-chinese",
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
});

const roundedLatin = localFont({
  src: "./fonts/Nunito-Variable.ttf",
  variable: "--font-goalio-latin",
  weight: "200 1000",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Goalio — 把今天的余额，变成更安心的决定",
  description: "照看每天的生活开销，慢慢靠近想要的目标。",
  applicationName: "Goalio",
  appleWebApp: { capable: true, title: "Goalio", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${roundedChinese.variable} ${roundedLatin.variable}`}>
      <body>{children}</body>
    </html>
  );
}
