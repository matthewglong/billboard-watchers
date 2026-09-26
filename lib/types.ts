// Shapes shared by the server pipeline and the browser. Every field an agent
// can fail to produce is nullable: the normalizers in lib/normalize.ts fill
// missing fields with null rather than trusting model output.

export type Confidence = "high" | "medium" | "low";
export type Rarity = "common" | "uncommon" | "rare" | "mythical";

export interface SpotterResult {
  is_tech_billboard: boolean;
  readable: boolean;
  billboard_text: string | null;
  company_name: string | null;
  company_url_guess: string | null;
  visual_read: string | null;
  jargon_terms: string[];
  confidence: Confidence | null;
  /** Only set when is_tech_billboard is false: "a mattress advertisement". */
  subject_if_not_tech: string | null;
}

export interface Source {
  title: string;
  url: string;
}

export interface ResearcherResult {
  company_name: string | null;
  url: string | null;
  verdict: string | null;
  behavior: string | null;
  diet: string | null;
  habitat: string | null;
  natural_predators: string[];
  stage: string | null;
  rarity: Rarity | null;
  rarity_reason: string | null;
  bigger_picture: string | null;
  /** Pages the web search surfaced, so readers can check the facts. */
  sources: Source[];
  /** True on the early event that carries only the verdict; the full entry follows. */
  partial?: boolean;
}

export interface JargonEntry {
  term: string;
  plain_english: string | null;
  joke: string | null;
}

export interface ExplainerResult {
  species_name: string | null;
  field_notes: string | null;
  jargon: JargonEntry[];
  jargon_density: number | null;
  jargon_density_note: string | null;
}

export interface PhotographerResult {
  hero_image_url: string | null;
  logo_url: string | null;
  /** Stretch: a Microlink homepage screenshot. */
  screenshot_url: string | null;
  /** The page the images came from. */
  page_url: string | null;
}

export interface NotABird {
  reason: "not_tech" | "unreadable";
  title: string;
  line: string;
  hint: string;
}

export type Section = "spotter" | "researcher" | "explainer" | "photographer";

export interface SectionError {
  section: Section | "pipeline";
  message: string;
}

export interface DoneInfo {
  total_ms: number;
  timings: Partial<Record<Section, number>>;
}

/** One Server-Sent Event from POST /api/decode. */
export type DecodeEvent =
  | { event: "spotter"; data: SpotterResult }
  | { event: "explainer"; data: ExplainerResult }
  | { event: "researcher"; data: ResearcherResult }
  | { event: "photographer"; data: PhotographerResult }
  | { event: "not_a_bird"; data: NotABird }
  | { event: "error"; data: SectionError }
  | { event: "done"; data: DoneInfo };

export type DecodeEventName = DecodeEvent["event"];

export interface GlossaryEntry {
  term: string;
  aliases: string[];
  plain_english: string;
  analogy: string;
  joke: string;
}
