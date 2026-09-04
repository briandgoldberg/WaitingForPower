import type { Metadata } from "next";
import { ContactPanel } from "@/components/about/ContactPanel";

export const metadata: Metadata = {
  title: "Contact — WaitingForPower",
  description:
    "Get in touch with WaitingForPower about data feeds, API access, custom datasets, partnerships, press, feedback, and bugs.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-6">
      <ContactPanel initialTopic={topic} />
    </div>
  );
}
