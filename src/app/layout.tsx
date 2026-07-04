import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const SITE_URL = "https://everdesk.allensaji.dev";
const TITLE = "EverDesk - a support agent that never forgets a customer";
const DESCRIPTION =
  "Train a support agent on your docs in minutes, embed it with one line. It remembers every customer, learns from every resolution, takes action through your webhooks, and can provably forget. Memory by Cognee Cloud.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s - EverDesk",
  },
  description: DESCRIPTION,
  applicationName: "EverDesk",
  keywords: ["AI support agent", "customer support", "chat widget", "agent memory", "Cognee"],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "EverDesk",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@SajiBhai011",
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
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
