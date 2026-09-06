export interface BreadcrumbItem {
  name: string;
  // Omit on the final/current-page item — Google's own guidance says the
  // last crumb doesn't need one since it's implicitly the page you're on.
  url?: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}
