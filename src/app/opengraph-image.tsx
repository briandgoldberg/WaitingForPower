import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Static content (no DB read) — cache indefinitely rather than regenerate
// per share. See project/[id]/opengraph-image.tsx for why this matters for
// Fluid Active CPU usage.
export const revalidate = false;

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#1e3a5f",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="96" height="96" viewBox="0 0 800 800">
            <circle cx="400" cy="400" r="400" fill="#16304d" />
            <polygon points="400,170 200,410 380,410 360,570 560,330 380,330" fill="#e8a04a" />
          </svg>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "#ffffff", letterSpacing: -1 }}>
            WaitingForPower
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 38, color: "#e8a04a", marginTop: 36, fontWeight: 600, lineHeight: 1.3, maxWidth: 980 }}>
          America&rsquo;s energy projects are stuck in permitting.
        </div>
        <div style={{ display: "flex", fontSize: 38, color: "#f4f4f2", marginTop: 6, fontWeight: 500, lineHeight: 1.3, maxWidth: 980 }}>
          Track every one and advocate for a faster decision.
        </div>
      </div>
    ),
    { ...size },
  );
}
