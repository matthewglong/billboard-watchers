"use client";

import type { ReactNode } from "react";
import type { Sighting } from "@/lib/client/sighting";
import type { LifeListEntry } from "@/lib/client/lifelist";
import { BirdOnBillboard, CameraIcon, CheckBox, PhotosIcon, TrackDivider } from "./Ornaments";
import { MountedPhoto } from "./Photo";
import { RarityBadge, Stamp } from "./Stamps";

/** A big button that opens the camera (capture) or the photo library. */
export function PhotoButton({
  camera,
  variant,
  onFile,
  children,
}: {
  camera: boolean;
  variant: "primary" | "secondary";
  onFile: (file: File) => void;
  children: ReactNode;
}) {
  return (
    <label className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"}`}>
      <input
        type="file"
        accept="image/*"
        capture={camera ? "environment" : undefined}
        className="sr-only-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      {camera ? <CameraIcon /> : <PhotosIcon />}
      {children}
    </label>
  );
}

export function SightingActions({
  onFile,
  onHome,
  primary = "Spot another",
}: {
  onFile: (file: File) => void;
  onHome: () => void;
  primary?: string;
}) {
  return (
    <div className="space-y-3">
      <PhotoButton camera variant="primary" onFile={onFile}>
        {primary}
      </PhotoButton>
      <PhotoButton camera={false} variant="secondary" onFile={onFile}>
        From your camera roll
      </PhotoButton>
      <div className="pt-3 text-center">
        <button type="button" className="link font-display text-[1.05rem]" onClick={onHome}>
          Back to the field guide
        </button>
      </div>
    </div>
  );
}

/** The photo wasn't a tech billboard, or couldn't be read. */
export function NotABirdCard({ sighting, actions }: { sighting: Sighting; actions: ReactNode }) {
  const nb = sighting.notABird!;
  return (
    <article className="pb-4">
      <div className="px-1 pt-5">
        <MountedPhoto src={sighting.photoUrl} alt="Your photo">
          <Stamp thump tilt={-9} className="absolute -bottom-4 right-1 text-[1.15rem]">
            {nb.reason === "unreadable" ? "Too blurry" : "Not a bird"}
          </Stamp>
        </MountedPhoto>
      </div>
      <h1 className="font-display mt-10 text-[2rem] font-semibold leading-tight">{nb.title}</h1>
      <p className="font-display mt-4 text-[1.3rem] italic leading-snug text-ink-soft">{nb.line}</p>
      <p className="mt-4 prose-width">{nb.hint}</p>
      <div className="mt-10">{actions}</div>
    </article>
  );
}

/** The request itself failed: no connection, rate limit, unreadable file. */
export function FailedCard({ sighting, actions }: { sighting: Sighting; actions: ReactNode }) {
  const message =
    sighting.errors.request ?? sighting.errors.spotter ?? sighting.errors.pipeline ?? "Something went wrong.";
  return (
    <article className="pb-4">
      {sighting.photoUrl && (
        <div className="px-1 pt-5">
          <MountedPhoto src={sighting.photoUrl} alt="Your photo" />
        </div>
      )}
      <h1 className="font-display mt-10 text-[2rem] font-semibold leading-tight">The sighting slipped away</h1>
      <p className="font-display mt-4 text-[1.2rem] italic leading-snug text-ink-soft">{message}</p>
      <div className="mt-10">{actions}</div>
    </article>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function Home({
  onFile,
  onSample,
  lifeList,
  onOpenEntry,
}: {
  onFile: (file: File) => void;
  onSample: () => void;
  lifeList: LifeListEntry[];
  onOpenEntry: (entry: LifeListEntry) => void;
}) {
  return (
    <main className="pb-10">
      <header className="pt-4 text-center">
        <BirdOnBillboard className="mx-auto w-[15rem] max-w-full" />
        <h1
          className="font-display mt-3 text-[3.1rem] font-bold leading-[0.95] tracking-[-0.01em] text-ink sm:text-[3.6rem]"
          style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 144' }}
        >
          Ad Hawk
        </h1>
        <p className="font-display mx-auto mt-3 max-w-[20rem] text-[1.2rem] italic leading-snug text-moss-deep">
          A Field Guide to the Wild Billboards of San Francisco
        </p>
      </header>

      <TrackDivider className="my-7" />

      <p className="font-display mx-auto max-w-[30rem] text-center text-[1.15rem] italic leading-relaxed text-ink-soft">
        Hush now. Somewhere on Market Street, a billboard is saying “agentic” to no one in particular. Photograph it,
        and we&apos;ll tell you, in plain English, what the company actually does.
      </p>

      <div className="mt-8 space-y-3">
        <PhotoButton camera variant="primary" onFile={onFile}>
          Spot one now
        </PhotoButton>
        <PhotoButton camera={false} variant="secondary" onFile={onFile}>
          From your camera roll
        </PhotoButton>
      </div>

      <div className="mt-6 text-center">
        <button type="button" className="link font-display text-[1.1rem]" onClick={onSample}>
          Try a sample sighting
        </button>
      </div>

      {lifeList.length > 0 && (
        <section className="mt-12">
          <h2 className="section-title">Your life list</h2>
          <p className="mt-1 text-[0.95rem] text-pencil">
            Birders keep a list of every species they&apos;ve seen. Yours lives in this browser.
          </p>
          <ul className="mt-4 divide-y divide-pencil/25 border-y border-pencil/25">
            {lifeList.map((entry) => {
              const company =
                entry.researcher?.company_name && !/^unknown/i.test(entry.researcher.company_name)
                  ? entry.researcher.company_name
                  : entry.spotter?.company_name;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onOpenEntry(entry)}
                    className="flex w-full items-center gap-3 py-3 text-left hover:bg-paper-light/60"
                  >
                    <CheckBox />
                    <span className="min-w-0 flex-1">
                      <span className="font-display block truncate text-[1.1rem] italic text-moss-deep">
                        {entry.explainer?.species_name ?? "Species unnamed"}
                      </span>
                      <span className="block truncate text-[0.95rem] text-ink-soft">{company ?? "Company unknown"}</span>
                    </span>
                    {entry.researcher?.rarity && (
                      <span className="hidden min-[400px]:inline-flex">
                        <RarityBadge rarity={entry.researcher.rarity} />
                      </span>
                    )}
                    <span className="shrink-0 text-[0.85rem] text-pencil">{formatDate(entry.seenAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="mt-14 border-t border-pencil/25 pt-4 text-[0.9rem] leading-relaxed text-pencil">
        How it works: your photo goes to a small team of Claude agents. One reads the billboard, one searches the web
        for the facts, and one translates the jargon. Photos aren&apos;t stored.
      </footer>
    </main>
  );
}
