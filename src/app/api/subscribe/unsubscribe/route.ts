import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";

  const sub = await prisma.projectSubscription.findUnique({
    where: { unsubscribeToken: token },
    include: { project: { select: { slug: true } } },
  });

  if (!sub) {
    return NextResponse.redirect(new URL("/?alert=invalid", req.url));
  }

  const slug = sub.project.slug;
  await prisma.projectSubscription.delete({ where: { id: sub.id } });

  return NextResponse.redirect(new URL(`/project/${slug}?alert=unsubscribed`, req.url));
}
