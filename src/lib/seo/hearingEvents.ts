import type { HearingDTO } from "@/lib/types";

// Best-effort classification of a hearing's free-text `location` string into
// schema.org's Event attendance-mode vocabulary. There's no structured
// venue-vs-virtual flag anywhere upstream (every ingest module just captures
// whatever the source publishes as one string — see schema.prisma's
// ProjectHearing.location comment) so this infers from the text itself
// rather than inventing structure that isn't there. Heuristic: a purely
// virtual notice ("Webex - see below.", "...via Zoom Conferencing") reads as
// a sentence with no numeric address token; a real venue almost always has
// one (a street number, suite/room number, or similar — every physical
// example seen in this dataset does). Wrong in some edge case is fine here —
// this only feeds optional structured data, never anything a user reads
// directly, and Google simply won't grant a rich result for a mis-tagged
// event rather than that being independently harmful.
// "teleconferenc" deliberately has no trailing \b of its own — real data
// says "teleconferencing", and \bteleconferenc\b would require a
// non-word character right after "c", which "i" isn't, silently failing
// to match the single most common virtual-attendance phrase in this
// dataset (confirmed live: a hearing reading "...and remote access via
// teleconferencing" was mis-classified as offline-only before this fix).
const VIRTUAL_KEYWORDS = /\b(webex|zoom|microsoft teams|teams meeting|virtual|teleconferenc\w*|online)\b/i;

interface HearingEventInput {
  projectName: string;
  projectUrl: string;
  hearingDetailsLink: string | null;
  hearings: HearingDTO[];
}

// Returns a ready-to-embed JSON-LD object (schema.org Event per hearing,
// grouped under one @graph) or null when there's nothing to say — callers
// should skip rendering the <script> tag entirely in that case rather than
// emit an empty graph.
export function buildHearingEventsJsonLd(params: HearingEventInput): Record<string, unknown> | null {
  const { projectName, projectUrl, hearingDetailsLink, hearings } = params;
  if (hearings.length === 0) return null;

  const url = hearingDetailsLink && /^https?:\/\//.test(hearingDetailsLink) ? hearingDetailsLink : projectUrl;

  const events = hearings.map((h) => {
    const event: Record<string, unknown> = {
      "@type": "Event",
      name: h.label ? `${projectName} — ${h.label}` : `${projectName} — Public Hearing`,
      startDate: h.date,
      eventStatus: "https://schema.org/EventScheduled",
      url,
    };
    if (h.endDate) event.endDate = h.endDate;

    if (h.location) {
      const hasDigit = /\d/.test(h.location);
      const mentionsVirtual = VIRTUAL_KEYWORDS.test(h.location);
      const virtualOnly = mentionsVirtual && !hasDigit;

      if (virtualOnly) {
        event.eventAttendanceMode = "https://schema.org/OnlineEventAttendanceMode";
        event.location = { "@type": "VirtualLocation", url };
      } else {
        event.eventAttendanceMode = mentionsVirtual
          ? "https://schema.org/MixedEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode";
        event.location = { "@type": "Place", name: h.location, address: h.location };
      }
    }
    // No location at all: omit both fields rather than guess — this event
    // just isn't eligible for Google's Event rich result (which requires a
    // location), but the rest of the markup is still valid and still useful
    // for general entity recognition.

    return event;
  });

  return { "@context": "https://schema.org", "@graph": events };
}
