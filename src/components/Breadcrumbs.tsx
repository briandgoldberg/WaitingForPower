import Link from "next/link";

// A visible trail at the top of a page ("All projects › Maryland ›
// Opposition"). The last item is the current page and isn't a link. Pages
// keep their own BreadcrumbList JSON-LD (src/lib/seo/breadcrumbs.ts) for
// search engines.
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-x-1.5">
            {i > 0 && <span aria-hidden>›</span>}
            {item.href ? (
              <Link href={item.href} className="underline hover:text-[var(--accent)]">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
