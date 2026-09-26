"use client";

import { Fragment, useId, type ReactNode } from "react";
import glossary from "@/data/glossary.json";
import { lookupGlossary } from "@/lib/client/glossary";
import type { GlossaryEntry, JargonEntry } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";

/** The drill-down for one jargon term: our glossary first, else the naturalist's note. */
export function JargonSheet({
  term,
  fromExplainer,
  onClose,
}: {
  term: string;
  fromExplainer: JargonEntry | undefined;
  onClose: () => void;
}) {
  const titleId = useId();
  const entry = lookupGlossary(term);
  const filedUnder = entry && entry.term.toLowerCase() !== term.toLowerCase() ? entry.term : null;

  return (
    <BottomSheet onClose={onClose} labelledBy={titleId}>
      <h2 id={titleId} className="font-display text-[1.75rem] font-semibold leading-tight">
        {entry && !filedUnder ? entry.term : `“${term}”`}
      </h2>
      {filedUnder && <p className="mt-1 text-[0.95rem] text-pencil">Filed in our glossary under {filedUnder}.</p>}

      {entry ? (
        <div className="mt-4 space-y-4">
          <SheetPart title="In plain English">{entry.plain_english}</SheetPart>
          <SheetPart title="Think of it like…">{entry.analogy}</SheetPart>
          <NarratorAside>{entry.joke}</NarratorAside>
        </div>
      ) : fromExplainer?.plain_english ? (
        <div className="mt-4 space-y-4">
          <SheetPart title="In plain English">{fromExplainer.plain_english}</SheetPart>
          {fromExplainer.joke && <NarratorAside>{fromExplainer.joke}</NarratorAside>}
          <p className="text-[0.9rem] text-pencil">Translated by our naturalist for this billboard.</p>
        </div>
      ) : (
        <p className="mt-4 italic text-ink-soft">
          Our naturalist is still consulting the literature on this one. Give it a moment and tap again.
        </p>
      )}

      <button type="button" onClick={onClose} className="btn btn-secondary mt-6">
        Back to the card
      </button>
    </BottomSheet>
  );
}

function SheetPart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-[1.05rem] font-semibold italic text-moss-deep">{title}</h3>
      <p className="mt-1 prose-width">{children}</p>
    </section>
  );
}

export function NarratorAside({ children }: { children: ReactNode }) {
  return (
    <p className="font-display border-l-[3px] border-robin pl-3 text-[1.05rem] italic leading-snug text-ink-soft">
      {children}
    </p>
  );
}

// Inline glossary links: jargon that slips into the card's prose becomes
// tappable, so no explanation leans on an unexplained word. Everyday words
// that happen to be glossary aliases stay plain.
const TOO_EVERYDAY = new Set(
  [
    "ai", "a.i.", "model", "models", "trained", "training", "seed", "burn", "chips", "bot", "investors",
    "backed by", "customer service", "customer support", "customer experience", "customer experiences",
    "workflow", "workflows", "automation", "automations", "automate", "reasoning", "monitoring", "vector",
    "vectors", "startup", "startups", "start-up", "cloud", "the cloud", "in the cloud", "evaluation",
    "evaluations", "platform", "platforms", "warehouse", "pipeline", "pipelines", "lag", "response time",
    "agent", "agents", "enterprises", "dataset", "datasets", "benchmark", "benchmarks", "venture-backed",
    "early-stage startup",
  ].map((s) => s.toLowerCase()),
);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LINKABLE = (glossary as GlossaryEntry[])
  .flatMap((e) => [e.term, ...e.aliases])
  .filter((k) => k.length >= 3 && !TOO_EVERYDAY.has(k.toLowerCase()))
  .sort((a, b) => b.length - a.length);
const LINK_RE = new RegExp(`(?<![\\w-])(${LINKABLE.map(escapeRe).join("|")})(?![\\w-])`, "gi");

/**
 * Wraps the first mention of each glossary term in a tappable button.
 * `used` holds glossary entries already linked (or shown as chips) on this card.
 */
export function linkify(text: string, used: Set<string>, onTerm: (term: string) => void): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const entry = lookupGlossary(m[0]);
    if (!entry || used.has(entry.term) || m.index === undefined) continue;
    used.add(entry.term);
    out.push(text.slice(last, m.index));
    out.push(
      <button key={m.index} type="button" className="term" onClick={() => onTerm(m[0])}>
        {m[0]}
      </button>,
    );
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out.map((part, i) => <Fragment key={i}>{part}</Fragment>);
}
