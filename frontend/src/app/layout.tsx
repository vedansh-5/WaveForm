import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
    title: "WaveForm",
    description: "Record sound, decompose it into Fourier series harmonics, and visualize rotating epicycles in real-time.",
    keywords: ["fourier series", "audio visualization", "epicycles", "sound analysis", "waveform"],
    authors: [{ name: "Vedansh" }],
    icons: { icon: "/favicon.svg" },
    other: { "theme-color": "#111110" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body>
                <ThemeProvider>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
