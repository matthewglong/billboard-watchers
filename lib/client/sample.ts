import sample from "@/fixtures/sample.json";
import type { DecodeEvent } from "@/lib/types";

// "Try a sample sighting": replays one recorded run (fixtures/sample.json,
// made by scripts/record-sample.mjs) with its images served from
// public/sample/, so it works with the wifi off. Played back faster than real
// life, but slowly enough to watch the card fill in.

const SPEED = 0.35;

export const SAMPLE_PHOTO: string = sample.photo;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export async function replaySample(onEvent: (event: DecodeEvent) => void, signal: AbortSignal): Promise<void> {
  let previous = 0;
  for (const { t, event, data } of sample.events) {
    await sleep(Math.max(0, t - previous) * SPEED, signal);
    previous = t;
    onEvent({ event, data } as DecodeEvent);
  }
}
