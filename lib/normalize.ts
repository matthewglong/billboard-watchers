// Defensive shape validation for model output. Nothing here throws: bad or
// missing fields become null (or an empty list) so one sloppy agent can never
// crash the card.

import type {
  Confidence,
  ExplainerResult,
  JargonEntry,
  PhotographerResult,
  Rarity,
  ResearcherResult,
  Source,
  SpotterResult,
} from "./types";

type Obj = Record<string, unknown>;

function asObj(v: unknown): Obj {
  if (typeof v === "string") {
    try {
      return asObj(JSON.parse(v));
    } catch {
      return {};
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
}

export function str(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || /^(null|none|n\/a)$/i.test(s)) return null;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function strList(v: unknown, maxItems: number, maxLen = 120): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    const s = str(item, maxLen);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

/** Accepts "motherduck.com" or "https://…"; returns a clean https URL or null. */
export function cleanUrl(v: unknown): string | null {
  const s = str(v, 500);
  if (!s || /^unknown$/i.test(s)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Models sometimes double-escape line breaks, leaving a literal "\n" behind. */
function lines(v: string | null): string | null {
  return v?.replace(/\\n/g, "\n").replace(/\n{3,}/g, "\n\n") ?? null;
}

export function normalizeSpotter(input: unknown): SpotterResult {
  const o = asObj(input);
  return {
    is_tech_billboard: bool(o.is_tech_billboard, false),
    readable: bool(o.readable, false),
    billboard_text: lines(str(o.billboard_text, 600)),
    company_name: str(o.company_name, 80),
    company_url_guess: cleanUrl(o.company_url_guess),
    visual_read: str(o.visual_read, 800),
    jargon_terms: strList(o.jargon_terms, 8, 60),
    confidence: oneOf<Confidence>(o.confidence, ["high", "medium", "low"]),
    subject_if_not_tech: str(o.subject_if_not_tech, 120),
  };
}

function sources(v: unknown): Source[] {
  if (!Array.isArray(v)) return [];
  const out: Source[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const o = asObj(item);
    const url = cleanUrl(o.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: str(o.title, 140) ?? new URL(url).hostname });
  }
  return out;
}

export function normalizeResearcher(input: unknown, found: Source[] = []): ResearcherResult {
  const o = asObj(input);
  return {
    company_name: str(o.company_name, 80),
    url: cleanUrl(o.url),
    verdict: str(o.verdict, 160),
    behavior: str(o.behavior, 700),
    diet: str(o.diet, 400),
    habitat: str(o.habitat, 120),
    natural_predators: strList(o.natural_predators, 4, 60).filter((p) => !/^unknown$/i.test(p)),
    stage: str(o.stage, 160),
    rarity: oneOf<Rarity>(o.rarity, ["common", "uncommon", "rare", "mythical"]),
    rarity_reason: str(o.rarity_reason, 200),
    bigger_picture: str(o.bigger_picture, 900),
    sources: sources(found).slice(0, 4),
  };
}

function jargonList(v: unknown): JargonEntry[] {
  if (!Array.isArray(v)) return [];
  const out: JargonEntry[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const o = asObj(item);
    const term = str(o.term, 60);
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    out.push({ term, plain_english: str(o.plain_english, 500), joke: str(o.joke, 300) });
    if (out.length >= 10) break;
  }
  return out;
}

export function normalizeExplainer(input: unknown): ExplainerResult {
  const o = asObj(input);
  const d = typeof o.jargon_density === "number" ? o.jargon_density : Number(o.jargon_density);
  return {
    species_name: str(o.species_name, 80),
    field_notes: str(o.field_notes, 900),
    jargon: jargonList(o.jargon),
    jargon_density: Number.isFinite(d) ? Math.max(0, Math.min(10, Math.round(d))) : null,
    jargon_density_note: str(o.jargon_density_note, 240),
  };
}

export const EMPTY_PHOTOS: PhotographerResult = {
  hero_image_url: null,
  logo_url: null,
  screenshot_url: null,
  page_url: null,
};
