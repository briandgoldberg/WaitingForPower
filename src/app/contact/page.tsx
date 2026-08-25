import type { Metadata } from "next";
import { ContactPanel } from "@/components/about/ContactPanel";

export const metadata: Metadata = {
  title: "Contact — WaitingForPower",
  description:
    "Get in touch with WaitingForPower — data feeds, API access, custom datasets, partnerships, press, feedback, and bugs.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6">
      <ContactPanel />
    </div>
  );
}
