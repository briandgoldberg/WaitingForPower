import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { IntentWidget } from "@/components/IntentWidget";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// This openGraph/twitter metadata isn't tied to a specific share button —
// it's what any link-preview reader (Facebook, Slack, iMessage, etc.) pulls
// when this site's URL is pasted anywhere, regardless of how someone got
// the link.
const TITLE = "WaitingForPower — Energy Project Tracker";
const DESCRIPTION =
  "Tracking proposed U.S. energy projects — generation, transmission, storage, LNG, and pipelines, every fuel type — and how long each has been waiting for approval, and why.";

export const metadata: Metadata = {
  metadataBase: new URL("https://waitingforpower.com"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://waitingforpower.com",
    siteName: "WaitingForPower",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    site: "@WaitingForPower",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} min-h-screen flex flex-col`}>
        <header className="border-b border-[var(--border)] bg-[var(--panel)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" width={28} height={28} className="rounded-full shrink-0" />
              <span className="flex items-baseline gap-2">
                <span className="text-lg font-bold tracking-tight">WaitingForPower</span>
                <span className="text-xs text-[var(--muted)] hidden sm:inline">
                  an Energy Project Tracker
                </span>
              </span>
            </Link>
            {/* flex-nowrap + overflow-x-auto: on a narrow viewport this
                keeps every link on one scrollable row instead of wrapping
                (previously "Contact Us" alone dropped to its own third
                header row on mobile). Scrollbar hidden since the row fits
                without scrolling on anything past a small phone anyway. */}
            <nav className="flex flex-nowrap items-center gap-1 text-sm overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link href="/" className="shrink-0 px-3 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10">
                Home
              </Link>
              <Link href="/projects" className="shrink-0 px-3 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10">
                Projects
              </Link>
              <Link href="/blog" className="shrink-0 px-3 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10">
                Blog
              </Link>
              <Link
                href="/policies"
                className="shrink-0 px-3 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
              >
                Advocacy
              </Link>
              <Link href="/contact" className="shrink-0 px-3 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10">
                Contact Us
              </Link>
            </nav>
          </div>
        </header>
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-1.5 text-xs text-center">
            🚧 Federal sources already track projects in all 50 states. We&rsquo;re layering in
            state-level permitting detail too, with 41 states live so far and more on the way.
          </div>
        </div>
        <main className="flex-1 flex flex-col">{children}</main>
        <IntentWidget />
        <footer className="border-t border-[var(--border)] bg-[var(--panel)] text-xs text-[var(--muted)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
            <p>
              WaitingForPower tracks U.S. energy projects of every fuel type — structural, sourced.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/WaitingForPower"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Follow on X
              </a>
              <a
                href="https://github.com/briandgoldberg/WaitingForPower"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Source on GitHub
              </a>
              <Link href="/methodology" className="underline">
                Methodology
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
