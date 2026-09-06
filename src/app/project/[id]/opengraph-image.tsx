import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { serializeProject } from "@/lib/serialize";
import { FUEL_TYPE_BY_VALUE, formatCapacity, PROJECT_STAGE_BY_VALUE } from "@/lib/data/taxonomies";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { slug: id }, include: { causes: true, sources: true, milestones: true } });
  const p = project ? serializeProject(project) : null;

  const fuel = p ? FUEL_TYPE_BY_VALUE[p.fuelType] : null;
  const stageLabel = p ? (PROJECT_STAGE_BY_VALUE[p.currentStage] ?? p.currentStage.replace(/_/g, " ")) : null;

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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
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

        {fuel && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: fuel.color }} />
            <div style={{ display: "flex", fontSize: 22, textTransform: "uppercase", letterSpacing: 1, color: "#6b7280" }}>
              {`${p!.projectType} · ${fuel.label}`}
            </div>
          </div>
        )}

        <div style={{ display: "flex", fontSize: 52, fontWeight: 700, color: "#0b0b0b", lineHeight: 1.15 }}>
          {p?.name ?? "Energy project"}
        </div>

        {p && (
          <div style={{ display: "flex", gap: 40, marginTop: 40 }}>
            <Stat label="Waiting" value={p.yearsWaiting != null ? `${p.yearsWaiting.toFixed(1)} yrs` : "—"} />
            <Stat label="Stage" value={stageLabel ?? "—"} />
            <Stat label="Capacity" value={formatCapacity(p.capacityValue, p.capacityUnit)} />
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 18, textTransform: "uppercase", letterSpacing: 1, color: "#185fa5", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 30, color: "#0b0b0b", marginTop: 4 }}>{value}</div>
    </div>
  );
}
