import glossary from "@/data/glossary.json";
import type { GlossaryEntry } from "@/lib/types";

// Case-insensitive lookup against each entry's term and aliases. Also tolerant
// of punctuation, hyphens and simple plurals, since billboards say "AGENTS".

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s-]+/g, " ")
    .trim();
}

function variants(s: string): string[] {
  const n = normalize(s);
  const out = [n];
  if (n.endsWith("ies")) out.push(n.slice(0, -3) + "y");
  if (n.endsWith("es")) out.push(n.slice(0, -2));
  if (n.endsWith("s")) out.push(n.slice(0, -1));
  return out;
}

const index = new Map<string, GlossaryEntry>();
for (const entry of glossary as GlossaryEntry[]) {
  for (const key of [entry.term, ...entry.aliases]) {
    const n = normalize(key);
    if (!index.has(n)) index.set(n, entry);
  }
}

export function lookupGlossary(term: string): GlossaryEntry | null {
  for (const v of variants(term)) {
    const hit = index.get(v);
    if (hit) return hit;
  }
  return null;
}
