import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function tally(projectId: string): Promise<{ green: number; red: number }> {
  const rows = await prisma.projectVerdict.groupBy({
    by: ["vote"],
    where: { projectId },
    _count: true,
  });
  const green = rows.find((r) => r.vote === "green")?._count ?? 0;
  const red = rows.find((r) => r.vote === "red")?._count ?? 0;
  return { green, red };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const voterKey = String(body.voterKey ?? "").trim();
  const vote = body.vote === "green" || body.vote === "red" ? body.vote : null;
  if (!voterKey || voterKey.length > 200) {
    return NextResponse.json({ error: "Missing or invalid voterKey." }, { status: 400 });
  }
  if (!vote) {
    return NextResponse.json({ error: "vote must be \"green\" or \"red\"." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  await prisma.projectVerdict.upsert({
    where: { projectId_voterKey: { projectId: project.id, voterKey } },
    create: { projectId: project.id, voterKey, vote },
    update: { vote },
  });

  return NextResponse.json({ ok: true, ...(await tally(project.id)) });
}
