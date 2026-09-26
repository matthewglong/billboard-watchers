import type { SpotterResult } from "@/lib/types";

// Rotating lines for the Observing screen. Once the Spotter has read the
// billboard, the lines start quoting what it actually saw.

const OPENING = [
  "The researcher approaches the billboard slowly, so as not to startle it…",
  "Adjusting the binoculars for the glare off Market Street…",
  "Consulting the literature…",
];

const CLOSING = [
  "Patience. The finest sightings reward those who keep very still…",
  "Cross-referencing its markings with the field guide…",
  "Our naturalist is taking notes in a very small, very neat hand…",
];

export function narratorLines(spotter: SpotterResult | null): string[] {
  const lines = [...OPENING];
  if (spotter?.company_name) {
    lines.push(`There, on its plumage: “${spotter.company_name}.” A promising start…`);
  }
  for (const term of spotter?.jargon_terms.slice(0, 3) ?? []) {
    lines.push(`A distinctive call. We have heard this word “${term.toLowerCase()}” before…`);
  }
  return [...lines, ...CLOSING];
}
