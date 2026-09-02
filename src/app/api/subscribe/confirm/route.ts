import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";

  const sub = await prisma.projectSubscription.findUnique({
    where: { confirmToken: token },
    include: { project: { select: { slug: true } } },
  });

  if (!sub) {
    return NextResponse.redirect(new URL("/?alert=invalid", req.url));
  }

  if (!sub.confirmed) {
    const now = new Date();
    await prisma.projectSubscription.update({
      where: { id: sub.id },
      // lastNotifiedAt starts at confirm time so the next digest run only
      // covers changes from here forward, not the project's full history.
      data: { confirmed: true, confirmedAt: now, lastNotifiedAt: now },
    });
  }

  return NextResponse.redirect(new URL(`/project/${sub.project.slug}?alert=confirmed`, req.url));
}
