import type { Metadata } from "next";
import { RestoreProfile } from "@/components/RestoreProfile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — WaitingForPower",
  robots: { index: false, follow: false },
};

export default async function RestorePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-md w-full px-4 sm:px-6 py-10 flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <RestoreProfile token={token ?? ""} />
    </div>
  );
}
