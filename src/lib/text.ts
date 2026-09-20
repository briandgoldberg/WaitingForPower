// Source text uses long dashes for asides ("... from X — Docket No. 123").
// The site shows them as plain commas.
export function withoutDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ");
}
