"use client";

import { useState } from "react";

const TOPICS = [
  { value: "data-access", label: "Data feeds, API access, or custom data" },
  { value: "partnership", label: "Partnership, press, or media" },
  { value: "data", label: "Add a project or data source" },
  { value: "feedback", label: "Feedback or a technical issue" },
  { value: "other", label: "Something else" },
] as const;

type TopicValue = (typeof TOPICS)[number]["value"];

function isTopicValue(value: string | undefined): value is TopicValue {
  return TOPICS.some((t) => t.value === value);
}

// `initialTopic` comes from /contact's own `?topic=` query param (see
// src/app/contact/page.tsx) — used by the homepage changes feed's "Get a
// custom feed" link to land directly on the data-access radio pre-selected,
// rather than making someone re-select it. Falls back to the first topic
// in the list for any missing/unrecognized value rather than trusting
// arbitrary query-string input.
export function ContactPanel({ initialTopic }: { initialTopic?: string } = {}) {
  const [topic, setTopic] = useState<TopicValue>(isTopicValue(initialTopic) ? initialTopic : TOPICS[0].value);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, name, email, organization, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong sending your message.");
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong sending your message.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2">Thanks, got it.</h2>
        <p className="text-sm text-[var(--muted)]">We&rsquo;ll get back to you soon.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contact Us</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Interested in a data feed, API access, or a custom dataset? That&rsquo;s exactly what
          we&rsquo;re building toward, so tell us what you need. Also happy to hear feedback, bug
          reports, or partnership ideas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5 flex flex-col gap-4">
        <fieldset>
          <legend className="text-sm font-medium mb-2">Why are you reaching out?</legend>
          <div className="flex flex-col gap-2">
            {TOPICS.map((t) => (
              <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="topic"
                  value={t.value}
                  checked={topic === t.value}
                  onChange={() => setTopic(t.value)}
                  className="accent-[var(--accent)]"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-[var(--border)] bg-transparent px-2.5 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-[var(--border)] bg-transparent px-2.5 py-1.5"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Organization <span className="text-[var(--muted)]">(optional)</span>
          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            className="rounded border border-[var(--border)] bg-transparent px-2.5 py-1.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Message
          <textarea
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="rounded border border-[var(--border)] bg-transparent px-2.5 py-1.5"
          />
        </label>

        {status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="self-start px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-60"
        >
          {status === "submitting" ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}
