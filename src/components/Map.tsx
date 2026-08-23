"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MaplibreMap } from "maplibre-gl";
import type { ProjectDTO } from "@/lib/types";
import { formatCapacity, FUEL_TYPE_BY_VALUE } from "@/lib/data/taxonomies";
import { multiStateCentroid, stateCentroid } from "@/lib/data/usStates";

// Free, no-API-key vector basemap (CARTO's Positron style — light and
// minimal, so the colored fuel-type markers read clearly against it instead
// of competing with Voyager's busier roads/labels/land-use colors).
// Requires "© CARTO © OpenStreetMap contributors" attribution, which
// MapLibre renders automatically from the style's own metadata.
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// This site only tracks U.S. projects — keep the map locked to North
// America so there's never a reason to pan/zoom out to other continents.
const US_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-180, 15], // southwest — wide enough for the Aleutians and Hawaii
  [-60, 72], // northeast — wide enough for northern Alaska
];

// v2 of this component used a clustered GeoJSON source rendered as GL
// circle layers. In production, pins never appeared on first load — only
// sometimes, after a filter change forced a fresh source.setData() call —
// pointing at a timing issue in MapLibre's worker-built tile/cluster
// pipeline (geojson-vt/supercluster run off the main thread) rather than
// anything about the data itself. Rather than keep chasing that pipeline's
// internal timing, this version sidesteps it entirely: plain DOM markers
// (maplibregl.Marker), positioned with CSS transforms on every render tick,
// no worker, no tiling, no clustering. Simpler and much harder to get stuck
// in a "silently never rendered" state. Trade-off: no native clustering, so
// dense areas show overlapping pins rather than a merged bubble — acceptable
// at hundreds of points; revisit with client-side clustering (e.g.
// supercluster run on the main thread) if density becomes a real problem.

function capacityRadius(p: ProjectDTO): number {
  if (p.capacityUnit === "MW" && p.capacityValue != null) {
    // sqrt scale so area (not radius) is roughly proportional to capacity
    return Math.max(3.5, Math.min(12, Math.sqrt(p.capacityValue) * 0.4));
  }
  return 4;
}

type ApproxReason = "multi-state" | "state-only" | null;

const APPROX_MESSAGE: Record<Exclude<ApproxReason, null>, string> = {
  "multi-state": "Approximate location — this project spans multiple states; pin is centered between them.",
  "state-only": "Approximate location — no site-level location is published for this project; pin is centered on the state.",
};

function popupHtml(p: ProjectDTO, approx: ApproxReason): string {
  const capacityLabel = formatCapacity(p.capacityValue, p.capacityUnit);
  return `
    <div style="min-width:220px;font-family:inherit;">
      <div style="padding:12px 14px 10px;border-bottom:1px solid var(--border);">
        <div style="font-weight:600;font-size:14px;line-height:1.3;">${p.name}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">
          ${p.state ?? ""} · ${capacityLabel}${p.isAggregateExample ? " · aggregate" : ""}
        </div>
        ${approx ? `<div style="font-size:11px;color:var(--muted);margin-top:4px;">${APPROX_MESSAGE[approx]}</div>` : ""}
      </div>
      <div style="padding:10px 14px;font-size:12px;">
        <div><strong>Waiting:</strong> ${p.yearsWaiting != null ? p.yearsWaiting.toFixed(1) + " yrs" : "—"}</div>
        <a href="/project/${p.slug}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:var(--accent);text-decoration:underline;">
          View project →
        </a>
      </div>
    </div>
  `;
}

export function Map({ projects }: { projects: ProjectDTO[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-98, 39],
      zoom: 3.6,
      minZoom: 2.5,
      maxZoom: 14,
      maxBounds: US_MAX_BOUNDS,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // Required CARTO/OpenStreetMap attribution (see MAP_STYLE comment above)
    // — collapsed to a small icon instead of a full text bar across the
    // bottom of the map. Hardcoded rather than left to MapLibre's automatic
    // per-source collection: confirmed that path silently produces no real
    // attribution here (only a generic "MapLibre" credit), so leaving it
    // automatic would drop the CARTO/OSM credit those free tiles require.
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          '&copy; <a href="https://carto.com/about-carto/" target="_blank" rel="noopener">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      }),
      "bottom-right",
    );
    // MapLibre renders the compact attribution expanded (full text) the
    // moment it *becomes* compact, and only collapses to the small "i" icon
    // after the user drags the map — collapse it immediately instead so it
    // never shows as a text bar across the bottom on first load.
    const attribEl = containerRef.current?.querySelector(".maplibregl-ctrl-attrib");
    attribEl?.classList.remove("maplibregl-compact-show");
    attribEl?.removeAttribute("open");

    // MapLibre reads the container's size once, at creation, and never
    // re-measures it on its own — if the container's final size settles
    // after that (a filter-panel/stats-header layout shift, a font
    // finishing load, a later Tailwind height class resolving), the map's
    // internal canvas goes stale relative to the actual box, and it renders
    // as if the container were a different size than it visually is —
    // cropped/misaligned rather than an honest "wrong zoom level." A
    // ResizeObserver keeps the canvas synced to the real container size for
    // the map's whole lifetime, not just once on mount.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)build markers whenever the filtered project set changes. Simplest
  // correct approach: clear everything and re-add — cheap at hundreds of
  // markers, and avoids diffing bugs.
  useEffect(() => {
    const maybeMap = mapRef.current;
    if (!maybeMap) return;
    const map: MaplibreMap = maybeMap;

    function renderMarkers() {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      for (const p of projectsRef.current) {
        let lon = p.lon;
        let lat = p.lat;
        let approx: ApproxReason = null;

        if (lon == null || lat == null) {
          const multiState = multiStateCentroid(p.state);
          const centroid = multiState ?? stateCentroid(p.state);
          if (!centroid) continue;
          [lon, lat] = centroid;
          approx = multiState ? "multi-state" : "state-only";
        }

        const size = capacityRadius(p) * 2;
        const color = FUEL_TYPE_BY_VALUE[p.fuelType]?.color ?? "#6b7280";
        const el = document.createElement("div");
        el.style.cssText = `
          width:${size}px;height:${size}px;border-radius:50%;
          background:${color};opacity:0.9;
          border:1.5px ${approx ? "dashed" : "solid"} #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.4);
          cursor:pointer;
        `;
        const lonLat: [number, number] = [lon, lat];
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
            .setLngLat(lonLat)
            .setHTML(popupHtml(p, approx))
            .addTo(map);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(lonLat)
          .addTo(map);
        markersRef.current.push(marker);
      }
    }

    if (map.loaded() || map.isStyleLoaded()) {
      renderMarkers();
    } else {
      map.once("load", renderMarkers);
    }
    // Markers are plain DOM, so no readiness event is strictly required —
    // render immediately too in case neither flag/event ever fires (same
    // class of issue seen with the GL-layer approach this replaced).
    renderMarkers();
  }, [projects]);

  return <div ref={containerRef} className="h-full w-full rounded-lg" />;
}
