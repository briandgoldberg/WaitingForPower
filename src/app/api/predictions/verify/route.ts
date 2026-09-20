import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";

  const verification = await prisma.predictorEmailVerification.findUnique({ where: { token } });
  if (!verification) {
    return NextResponse.redirect(new URL("/?alert=invalid", req.url));
  }

  if (!verification.confirmedAt) {
    // Two different browsers/anonymousKeys could race to claim the same
    // email between send and click — re-check uniqueness at confirm time,
    // not just at send time, rather than letting a stale request silently
    // reassign an already-claimed email.
    const existingOwner = await prisma.predictor.findUnique({ where: { email: verification.email } });
    if (existingOwner && existingOwner.id !== verification.predictorId) {
      return NextResponse.redirect(new URL("/?alert=email-taken", req.url));
    }

    const owner = await prisma.predictor.findUnique({ where: { id: verification.predictorId }, select: { identityDecidedAt: true } });
    await prisma.$transaction([
      prisma.predictor.update({
        where: { id: verification.predictorId },
        data: { email: verification.email, identityDecidedAt: owner?.identityDecidedAt ?? new Date() },
      }),
      prisma.predictorEmailVerification.update({ where: { id: verification.id }, data: { confirmedAt: new Date() } }),
    ]);
  }

  return NextResponse.redirect(new URL("/?alert=profile-saved", req.url));
}
