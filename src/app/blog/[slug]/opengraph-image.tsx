import { ImageResponse } from "next/og";
import usStatePaths from "@/lib/data/usStatePaths.json";
import { STATE_NAMES } from "@/lib/data/usStates";
import { buildColorFor } from "@/components/blog/UsStateMap";
import { computeStateEfficiencyRanking } from "@/lib/stateEfficiency";
import { getBlogPostMeta } from "@/lib/data/blogPosts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CODE_BY_NAME = new Map(Object.entries(STATE_NAMES).map(([code, name]) => [name, code]));

// Satori (the renderer behind next/og's ImageResponse) has limited support
// for arbitrary multi-subpath SVG, but reliably embeds an <img> whose src is
// an SVG data URI — so the real map geometry is rendered to a plain SVG
// string here (not JSX) and passed through that way, rather than trying to
// inline the <path> elements directly into the ImageResponse tree.
async function mapSvgDataUri(): Promise<string> {
  const { ranked } = await computeStateEfficiencyRanking();
  const { colorFor, byCode } = buildColorFor(ranked);
  const paths = usStatePaths
    .filter((s) => s.d)
    .map((s) => {
      const code = CODE_BY_NAME.get(s.name);
      const fill = code && byCode.has(code) ? colorFor(code) : "#B4B2A9";
      return `<path d="${s.d}" fill="${fill}" stroke="#fcfcfb" stroke-width="1.5"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560">${paths}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = getBlogPostMeta(slug);
  const showMap = slug === "least-efficient-states-for-permitting";
  const mapUri = showMap ? await mapSvgDataUri() : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fcfcfb",
          padding: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: "#185fa5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            W
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0b0b0b" }}>WaitingForPower</div>
        </div>

        {mapUri && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapUri}
            alt=""
            width={1088}
            height={423}
            style={{ borderRadius: 12, border: "1px solid #e1e0d9", objectFit: "contain" }}
          />
        )}

        <div style={{ display: "flex", marginTop: 24, fontSize: 40, fontWeight: 700, color: "#0b0b0b", lineHeight: 1.2 }}>
          {meta?.title ?? "WaitingForPower blog"}
        </div>
      </div>
    ),
    { ...size },
  );
}
