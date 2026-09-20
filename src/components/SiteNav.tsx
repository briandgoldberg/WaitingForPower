"use client";

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

  return (
    <nav className="w-full sm:w-auto">
      <div className="flex items-center justify-between sm:justify-start gap-1 text-sm">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 ${
                active ? "bg-[var(--border)] font-medium" : ""
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
