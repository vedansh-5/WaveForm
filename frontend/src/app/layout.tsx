import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WaveForm — Acoustic Fourier Series Laboratory",
  description:
    "Record sound, decompose it into Fourier series harmonics, and visualize rotating epicycles in real-time. Built with Next.js, Go, and D3.js.",
  keywords: ["fourier series", "audio visualization", "epicycles", "sound analysis", "waveform"],
  authors: [{ name: "Vedansh" }],
  other: {
    "theme-color": "#050507",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
