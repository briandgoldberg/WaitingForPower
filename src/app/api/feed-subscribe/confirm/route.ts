import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";

  const sub = await prisma.feedSubscription.findUnique({ where: { confirmToken: token } });

  if (!sub) {
    return NextResponse.redirect(new URL("/?alert=invalid", req.url));
  }

  if (!sub.confirmed) {
    const now = new Date();
    await prisma.feedSubscription.update({
      where: { id: sub.id },
      // lastNotifiedAt starts at confirm time so the first weekly email only
      // covers changes from here forward, not the feed's full history.
      data: { confirmed: true, confirmedAt: now, lastNotifiedAt: now },
    });
  }

  const stateParam = sub.state ? `&state=${sub.state}` : "";
  return NextResponse.redirect(new URL(`/?alert=confirmed${stateParam}`, req.url));
}
