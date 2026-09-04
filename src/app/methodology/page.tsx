import type { Metadata } from "next";
import { MethodologyPanel } from "@/components/about/MethodologyPanel";

export const metadata: Metadata = {
  title: "Methodology — WaitingForPower",
  description: "How the numbers on WaitingForPower are computed, what they assume, and where they're deliberately incomplete.",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6">
      <MethodologyPanel />
    </div>
  );
}
