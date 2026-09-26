import type {
  DecodeEvent,
  ExplainerResult,
  NotABird,
  PhotographerResult,
  ResearcherResult,
  SectionError,
  SpotterResult,
} from "@/lib/types";

export type SightingSource = "live" | "sample" | "lifelist";
export type ErrorKey = SectionError["section"] | "request";

export interface Sighting {
  id: string;
  source: SightingSource;
  photoUrl: string;
  thumb: string | null;
  status: "observing" | "done";
  seenAt: string;
  spotter: SpotterResult | null;
  explainer: ExplainerResult | null;
  researcher: ResearcherResult | null;
  photographer: PhotographerResult | null;
  notABird: NotABird | null;
  errors: Partial<Record<ErrorKey, string>>;
}

export function newSighting(source: SightingSource, photoUrl: string, thumb: string | null = null): Sighting {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    source,
    photoUrl,
    thumb,
    status: "observing",
    seenAt: new Date().toISOString(),
    spotter: null,
    explainer: null,
    researcher: null,
    photographer: null,
    notABird: null,
    errors: {},
  };
}

export function applyEvent(s: Sighting, e: DecodeEvent): Sighting {
  switch (e.event) {
    case "spotter":
      return { ...s, spotter: e.data };
    case "explainer":
      return { ...s, explainer: e.data };
    case "researcher":
      // Never let the early verdict-only event overwrite the full entry.
      if (e.data.partial && s.researcher && !s.researcher.partial) return s;
      return { ...s, researcher: e.data };
    case "photographer":
      return { ...s, photographer: e.data };
    case "not_a_bird":
      return { ...s, notABird: e.data };
    case "error":
      return { ...s, errors: { ...s.errors, [e.data.section]: e.data.message } };
    case "done":
      return { ...s, status: "done" };
  }
}

const UNKNOWN = /^unknown\b/i;

/** Best display name for the company, and whether the researcher confirmed it. */
export function commonName(s: Sighting): { name: string | null; confirmed: boolean } {
  const researched = s.researcher?.company_name;
  if (researched && !UNKNOWN.test(researched)) return { name: researched, confirmed: true };
  return { name: s.spotter?.company_name ?? null, confirmed: false };
}

export function isUnknown(value: string | null | undefined): boolean {
  return !value || UNKNOWN.test(value);
}
