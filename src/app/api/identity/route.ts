import { NextRequest, NextResponse } from "next/server";
import { getIdentityStatus } from "@/lib/community";

export const dynamic = "force-dynamic";

// "Who am I on this site" for a UGC surface that isn't scoped to one
// project — see src/components/advocacy/AdvocacyContactForm.tsx. Returns
// null when this browser key has never actually posted anything, same as
// Discussion.me on a project a first-time visitor hasn't commented on yet.
export async function GET(req: NextRequest) {
  const anonymousKey = req.nextUrl.searchParams.get("anonymousKey") ?? "";
  if (!anonymousKey) return NextResponse.json({ error: "Missing anonymousKey." }, { status: 400 });
  const me = await getIdentityStatus(anonymousKey);
  return NextResponse.json({ me });
}
