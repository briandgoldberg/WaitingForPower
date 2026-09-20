"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/policies", label: "Advocacy" },
  { href: "/blog", label: "Blog" },
];

// "/" only matches the homepage itself; every other link also matches its
// own subpages (e.g. /blog/some-post) so the parent tab still reads as
// active while reading an individual post.
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="relative order-1 sm:order-2">
      {/* Desktop / wide viewport: the original horizontal tab row. Hidden
          below sm — at narrow widths the full label set doesn't fit without
          horizontal scroll, which was clipping "Blog" off the right edge. */}
      <div className="hidden sm:flex flex-nowrap items-center gap-1 text-sm">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 px-3 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 ${
                active ? "bg-[var(--border)] font-medium" : ""
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile: a hamburger button opening a vertical dropdown instead. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="sm:hidden flex items-center justify-center h-9 w-9 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
      >
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <line x1="3" y1="5.5" x2="17" y2="5.5" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="14.5" x2="17" y2="14.5" />
        </svg>
      </button>

      {open && (
        <div className="sm:hidden absolute left-0 top-full mt-1 w-48 rounded-md border border-[var(--border)] bg-[var(--panel)] shadow-lg py-1 z-20 flex flex-col">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 ${active ? "font-medium" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
