"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { lookupGlossary } from "@/lib/client/glossary";
import { narratorLines } from "@/lib/client/narration";
import { commonName, isUnknown, type Sighting } from "@/lib/client/sighting";
import { JargonSheet, linkify, NarratorAside } from "./Jargon";
import { TrackDivider } from "./Ornaments";
import { MountedPhoto, NarratorTicker, SafeImage, Viewfinder } from "./Photo";
import { DensityStamp, RarityBadge, Stamp } from "./Stamps";

/** Pencil-sketch placeholder for a section that hasn't arrived yet. */
function Sketch({ lines = 2, note = "Still observing…", big = false }: { lines?: number; note?: string; big?: boolean }) {
  const widths = ["92%", "74%", "84%", "58%"];
  return (
    <div className="py-1" aria-hidden="true">
      <div className="space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={`sketch-line ${big ? "h-6" : ""}`} style={{ width: widths[i % widths.length] }} />
        ))}
      </div>
      <p className="font-display mt-2 text-[0.9rem] italic text-pencil">{note}</p>
    </div>
  );
}

/** In-character note where a section failed to arrive. */
function Missing({ children }: { children: ReactNode }) {
  return <p className="font-display text-[1rem] italic text-pencil">{children}</p>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="section-title mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Entry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-1.5">
      <dt className="entry-label inline">{label}. </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}

function callText(text: string | null): string | null {
  if (!text) return null;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return `“${lines.join(" / ")}”`;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function SpeciesCard({ sighting: s, actions }: { sighting: Sighting; actions: ReactNode }) {
  const [sheetTerm, setSheetTerm] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const closeSheet = useCallback(() => setSheetTerm(null), []);

  const observing = s.status === "observing";
  const researcher = s.researcher;
  const research = researcher && !researcher.partial ? researcher : null;
  const explainer = s.explainer;
  const photos = s.photographer;
  const { name, confirmed } = commonName(s);
  const researchPending = !research && !s.errors.researcher && observing;
  const explainerPending = !explainer && !s.errors.explainer && observing;

  // Chips: the naturalist's list once it arrives; the Spotter's list until then.
  const chips = useMemo(() => {
    if (explainer) return explainer.jargon.map((j) => j.term);
    return s.spotter?.jargon_terms ?? [];
  }, [explainer, s.spotter]);

  // Every glossary entry is linked once per card; chips count as linked.
  const used = new Set(chips.map((t) => lookupGlossary(t)?.term).filter((t): t is string => !!t));
  const link = (text: string | null | undefined) => (text ? linkify(text, used, setSheetTerm) : null);

  // Share images are usually 1.91:1; Microlink screenshots are 16:10. Fixed
  // frames keep the layout still while a slow screenshot renders.
  type Print = { src: string; alt: string; caption: string; frame: string };
  const images = [
    photos?.hero_image_url && {
      src: photos.hero_image_url,
      alt: `${name ?? "The company"}'s own promotional image`,
      caption: "Its own portrait, as it presents itself online.",
      frame: "aspect-[1.91/1] object-contain",
    },
    photos?.screenshot_url && {
      src: photos.screenshot_url,
      alt: `${name ?? "The company"}'s website homepage`,
      caption: "Its home on the web, photographed from a respectful distance.",
      frame: "aspect-[16/10] object-cover object-top",
    },
  ].filter((i): i is Print => !!i && !failedImages.has(i.src));
  const logo = photos?.logo_url && !failedImages.has(photos.logo_url) ? photos.logo_url : null;
  const hasPhotos = images.length > 0 || !!logo;
  const markFailed = (src: string) => setFailedImages((prev) => new Set(prev).add(src));

  const mythical = research?.rarity === "mythical";
  const call = callText(s.spotter?.billboard_text ?? null);

  return (
    <article className="pb-4">
      {/* The field photo: through the binoculars while observing, then mounted. */}
      {observing ? (
        <div className="space-y-4">
          <Viewfinder src={s.photoUrl} />
          <NarratorTicker lines={narratorLines(s.spotter)} />
        </div>
      ) : (
        <div className="px-1 pt-5">
          <MountedPhoto src={s.photoUrl} alt={call ? `The billboard, reading ${call}` : "The billboard"}>
            <Stamp thump={s.source !== "lifelist"} tilt={-11} className="absolute -bottom-4 right-1 text-[1.3rem]">
              {mythical ? "Unverified" : "Decoded"}
            </Stamp>
          </MountedPhoto>
        </div>
      )}

      {/* The forest: name, rarity, verdict. */}
      <header className="mt-8">
        {explainer?.species_name ? (
          <h1 className="font-display text-[2rem] font-semibold italic leading-[1.1] text-moss-deep">
            {explainer.species_name}
          </h1>
        ) : explainerPending ? (
          <Sketch lines={1} big note="Consulting the taxonomy…" />
        ) : (
          <h1 className="font-display text-[1.6rem] font-semibold italic text-moss-deep">Species unnamed</h1>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          {name || !(observing && (researchPending || !s.spotter)) ? (
            <p className="font-display text-[1.25rem] leading-snug text-ink-soft">
              {name ?? "Company unknown"}
              {name && !confirmed && research && <span className="text-pencil"> (unconfirmed)</span>}
            </p>
          ) : (
            <div className="w-40">
              <Sketch lines={1} note="Reading its markings…" />
            </div>
          )}
          {research?.rarity && <RarityBadge rarity={research.rarity} />}
        </div>
      </header>

      <div className="mt-5">
        {researcher?.verdict ? (
          <p className="font-display text-[1.7rem] font-semibold leading-[1.18] text-ink [text-wrap:balance] sm:text-[1.95rem]">
            {researcher.verdict}
          </p>
        ) : s.errors.researcher || !observing ? (
          <Missing>{s.errors.researcher ?? "No verdict this time. The facts below are all we could gather."}</Missing>
        ) : (
          <Sketch lines={2} big />
        )}
        {mythical && (
          <p className="mt-3 text-pencil">
            A mythical creature: we found no confirmed record of this company, so we won&apos;t guess at one.
          </p>
        )}
      </div>

      <TrackDivider className="my-7" />

      {/* Species-account entries. */}
      <dl className="prose-width">
        {call || !observing || s.spotter ? (
          <Entry label="Call">{call ?? <span className="italic text-pencil">No legible call.</span>}</Entry>
        ) : (
          <div className="pb-2">
            <Sketch lines={1} note="Listening for its call…" />
          </div>
        )}
        {research ? (
          <>
            <Entry label="Behavior">{link(research.behavior) ?? "Unknown."}</Entry>
            <Entry label="Diet">{link(research.diet) ?? "Unknown."}</Entry>
            <Entry label="Habitat">{research.habitat ?? "Unknown."}</Entry>
            <Entry label="Natural predators">
              {research.natural_predators.length ? research.natural_predators.join(", ") : "Unknown."}
            </Entry>
            <Entry label="Life stage">{link(research.stage) ?? "Unknown."}</Entry>
          </>
        ) : researchPending ? (
          <div className="pt-2">
            <Sketch lines={4} note="Taking notes on its behavior, diet and habitat…" />
          </div>
        ) : (
          <div className="pt-1">
            <Missing>No notes on its behavior, diet or habitat this time.</Missing>
          </div>
        )}
      </dl>

      <TrackDivider className="my-7" />

      {/* The trees. */}
      <Section title="Field notes">
        {explainer?.field_notes ? (
          <p className="ruled prose-width">{link(explainer.field_notes)}</p>
        ) : explainerPending ? (
          <Sketch lines={3} note="Our naturalist is writing it up…" />
        ) : (
          <Missing>{s.errors.explainer ?? "No field notes this time."}</Missing>
        )}
      </Section>

      <Section title="Jargon spotted">
        {chips.length > 0 ? (
          <>
            <p className="mb-3 text-[0.95rem] text-pencil">Tap a word for a plain-English translation.</p>
            <ul className="flex flex-wrap gap-2.5">
              {chips.map((term) => (
                <li key={term}>
                  <button type="button" className="chip" onClick={() => setSheetTerm(term)}>
                    {term}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : explainerPending ? (
          <Sketch lines={1} note="Listening for unusual calls…" />
        ) : (
          <Missing>No jargon spotted. A rare, plain-spoken specimen.</Missing>
        )}
      </Section>

      <Section title="The bigger picture">
        {research?.bigger_picture && !isUnknown(research.bigger_picture) ? (
          <div className="clipping prose-width">
            <span className="tape tape-top" aria-hidden="true" />
            <p>{link(research.bigger_picture)}</p>
          </div>
        ) : researchPending ? (
          <Sketch lines={3} note="Consulting the literature…" />
        ) : (
          <Missing>The bigger picture remains, for now, out of focus.</Missing>
        )}
      </Section>

      {(hasPhotos || (!photos && observing)) && (
        <Section title="Observed in the wild">
          {!photos ? (
            <Sketch lines={2} note="Our photographer is creeping up on its website…" />
          ) : (
            <div className="space-y-6">
              {(logo || research?.url || photos.page_url) && (
                <div className="flex items-center gap-3">
                  {logo && (
                    <SafeImage
                      src={logo}
                      alt={`${name ?? "Company"} logo`}
                      className="h-12 w-12 rounded-lg bg-paper-light object-contain p-1 shadow-sm"
                      onFail={() => markFailed(logo)}
                    />
                  )}
                  {(research?.url ?? photos.page_url) && (
                    <a
                      className="link font-display text-[1.1rem]"
                      href={research?.url ?? photos.page_url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Visit its habitat: {hostname(research?.url ?? photos.page_url ?? "")}
                    </a>
                  )}
                </div>
              )}
              {images.map((img, i) => (
                <figure key={img.src} className="mx-auto w-[calc(100%-0.5rem)]" style={{ transform: `rotate(${i % 2 ? 0.8 : -0.6}deg)` }}>
                  <div className="mount corners">
                    <SafeImage
                      src={img.src}
                      alt={img.alt}
                      className={`block w-full bg-paper-deep/40 ${img.frame}`}
                      onFail={() => markFailed(img.src)}
                    />
                  </div>
                  <figcaption className="mt-2 text-center text-[0.9rem] italic text-pencil">{img.caption}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section title="Jargon density">
        {explainer?.jargon_density != null ? (
          <div className="flex items-center gap-5">
            <DensityStamp score={explainer.jargon_density} />
            {explainer.jargon_density_note && <NarratorAside>{explainer.jargon_density_note}</NarratorAside>}
          </div>
        ) : explainerPending ? (
          <Sketch lines={1} note="Measuring…" />
        ) : (
          <Missing>Unmeasured.</Missing>
        )}
      </Section>

      {research && research.sources.length > 0 && !mythical && (
        <Section title="Literature consulted">
          <ul className="space-y-2 text-[0.95rem]">
            {research.sources.map((src) => (
              <li key={src.url}>
                <a className="link" href={src.url} target="_blank" rel="noreferrer">
                  {src.title}
                </a>{" "}
                <span className="text-pencil">({hostname(src.url)})</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!observing && <div className="mt-12">{actions}</div>}

      {sheetTerm && (
        <JargonSheet
          term={sheetTerm}
          fromExplainer={explainer?.jargon.find((j) => j.term.toLowerCase() === sheetTerm.toLowerCase())}
          onClose={closeSheet}
        />
      )}
    </article>
  );
}
