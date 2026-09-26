import "server-only";
import type { ImageInput } from "./anthropic";
import { runExplainer } from "./agents/explainer";
import { runPhotographer, siteKey } from "./agents/photographer";
import { runResearcher } from "./agents/researcher";
import { runSpotter } from "./agents/spotter";
import { EMPTY_PHOTOS } from "./normalize";
import type { DecodeEvent, NotABird, PhotographerResult, ResearcherResult, Section, SpotterResult } from "./types";

//            ┌─► RESEARCHER  (Sonnet 5 + web search)
// SPOTTER ───┼─► EXPLAINER   (Haiku, vision)
//            └─► PHOTOGRAPHER (plain fetch)
// Each agent has its own timeout, and one failure never sinks the card.

export const TIMEOUTS: Record<Section, number> = {
  spotter: 15_000,
  explainer: 20_000,
  researcher: 45_000,
  photographer: 8_000,
};

export type Emit = <E extends DecodeEvent>(event: E["event"], data: E["data"]) => void;

class TimeoutError extends Error {}

const PARTIAL_RESEARCH: ResearcherResult = {
  company_name: null,
  url: null,
  verdict: null,
  behavior: null,
  diet: null,
  habitat: null,
  natural_predators: [],
  stage: null,
  rarity: null,
  rarity_reason: null,
  bigger_picture: null,
  sources: [],
};

/** Runs one agent with its own deadline, and logs its latency. */
async function timed<T>(
  label: string,
  ms: number,
  parent: AbortSignal,
  run: (signal: AbortSignal) => Promise<T>,
  timings?: Partial<Record<Section, number>>,
): Promise<T> {
  const started = Date.now();
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  try {
    const result = await run(AbortSignal.any([parent, deadline.signal]));
    const took = Date.now() - started;
    if (timings && label in TIMEOUTS) timings[label as Section] = took;
    console.log(`[decode] ${label.padEnd(20)} ok   ${(took / 1000).toFixed(1)}s`);
    return result;
  } catch (err) {
    const took = ((Date.now() - started) / 1000).toFixed(1);
    const reason = deadline.signal.aborted ? `timeout (${ms / 1000}s)` : err instanceof Error ? err.message : String(err);
    console.warn(`[decode] ${label.padEnd(20)} FAIL ${took}s  ${reason}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// In-character notes for a section that didn't make it back.
const MISSING: Record<Section, string> = {
  spotter: "The billboard slipped away before our Spotter could read it. Shall we try that sighting again?",
  researcher:
    "Our researcher returned from the literature empty-handed. The facts on this one will have to wait for another expedition.",
  explainer:
    "Our naturalist wandered off after a particularly fine pigeon. No species name or jargon notes this time.",
  photographer: "No photographs of this creature's habitat could be obtained.",
};

function notABird(spotter: SpotterResult): NotABird | null {
  // An ad too blurry to classify counts as a tech billboard, so an unreadable
  // non-tech photo is simply "not a bird", and only real billboards get a retake.
  if (spotter.is_tech_billboard && !spotter.readable) {
    return {
      reason: "unreadable",
      title: "It won't hold still",
      line: "The creature is there, but the light is poor and it refuses to hold still. We simply cannot make out its markings.",
      hint: "Try again a little closer: steady your hands and let the whole billboard fill the frame.",
    };
  }
  if (!spotter.is_tech_billboard) {
    const subject = spotter.subject_if_not_tech ?? "something else entirely";
    return {
      reason: "not_tech",
      title: "Not the species we seek",
      line: `Remarkable. This appears to be… ${subject}. A common species, and not the one we seek.`,
      hint: "This field guide covers the wild tech billboards of San Francisco. Try one that mentions AI, apps, data, or the cloud.",
    };
  }
  return null;
}

export async function runPipeline(image: ImageInput, emit: Emit, signal: AbortSignal): Promise<void> {
  const started = Date.now();
  const timings: Partial<Record<Section, number>> = {};
  const finish = () => {
    const total_ms = Date.now() - started;
    console.log(`[decode] ${"total".padEnd(20)}      ${(total_ms / 1000).toFixed(1)}s`);
    emit("done", { total_ms, timings });
  };

  let spotter: SpotterResult;
  try {
    spotter = await timed("spotter", TIMEOUTS.spotter, signal, (s) => runSpotter(image, s), timings);
  } catch {
    emit("error", { section: "spotter", message: MISSING.spotter });
    return finish();
  }
  emit("spotter", spotter);

  const fallback = notABird(spotter);
  if (fallback) {
    emit("not_a_bird", fallback);
    return finish();
  }

  // The photographer may retry with the researcher's URL, so let it wait on it.
  let settleResearcherUrl: (url: string | null) => void = () => {};
  const researcherUrl = new Promise<string | null>((resolve) => (settleResearcherUrl = resolve));

  const researcher = timed(
    "researcher",
    TIMEOUTS.researcher,
    signal,
    (s) =>
      runResearcher(spotter, s, {
        onLog: (m) => console.log(`[decode]   researcher ${m}`),
        // The verdict is the most important line on the card: send it ahead.
        onPreview: (preview) => emit("researcher", { ...PARTIAL_RESEARCH, ...preview, partial: true }),
      }),
    timings,
  )
    .then((r) => {
      emit("researcher", r);
      settleResearcherUrl(r.url);
    })
    .catch(() => {
      emit("error", { section: "researcher", message: MISSING.researcher });
      settleResearcherUrl(null);
    });

  const explainer = timed("explainer", TIMEOUTS.explainer, signal, (s) => runExplainer(image, spotter, s), timings)
    .then((r) => emit("explainer", r))
    .catch(() => emit("error", { section: "explainer", message: MISSING.explainer }));

  const photographer = (async () => {
    const shoot = (url: string, label: string) =>
      timed(label, TIMEOUTS.photographer, signal, (s) => runPhotographer(url, s), timings).catch(
        () => null as PhotographerResult | null,
      );
    const guess = spotter.company_url_guess;
    let photos = guess ? await shoot(guess, "photographer") : null;
    if (photos) emit("photographer", photos);

    // Retry once with the researcher's URL if the first attempt found nothing,
    // or if the researcher confirmed a different site than the Spotter guessed.
    const confirmed = await researcherUrl;
    const tried = new Set([siteKey(guess), siteKey(photos?.page_url)]);
    if (confirmed && !tried.has(siteKey(confirmed))) {
      const retry = await shoot(confirmed, "photographer (retry)");
      if (retry) {
        photos = retry;
        emit("photographer", retry);
      }
    }
    if (!photos) emit("photographer", EMPTY_PHOTOS);
  })();

  await Promise.allSettled([researcher, explainer, photographer]);
  finish();
}
