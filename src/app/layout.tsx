import type { Metadata, Viewport } from "next";
import { Goldman } from "next/font/google";
import "./globals.css";

const goldman = Goldman({
  weight: "700",
  variable: "--font-goldman",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Most",
  description: "Track your TV shows and get notified when seasons are binge-ready",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${goldman.variable} antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
