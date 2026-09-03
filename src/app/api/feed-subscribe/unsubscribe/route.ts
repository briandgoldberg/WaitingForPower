import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";

  const sub = await prisma.feedSubscription.findUnique({ where: { unsubscribeToken: token } });

  if (!sub) {
    return NextResponse.redirect(new URL("/?alert=invalid", req.url));
  }

  const stateParam = sub.state ? `&state=${sub.state}` : "";
  await prisma.feedSubscription.delete({ where: { id: sub.id } });

  return NextResponse.redirect(new URL(`/?alert=unsubscribed${stateParam}`, req.url));
}
