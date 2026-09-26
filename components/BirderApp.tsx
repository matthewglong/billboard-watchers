"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DecodeRequestError, streamDecode } from "@/lib/client/decode";
import { preparePhoto } from "@/lib/client/image";
import {
  addToLifeList,
  getLifeList,
  getServerLifeList,
  subscribeLifeList,
  type LifeListEntry,
} from "@/lib/client/lifelist";
import { replaySample, SAMPLE_PHOTO } from "@/lib/client/sample";
import { applyEvent, newSighting, type Sighting } from "@/lib/client/sighting";
import type { DecodeEvent } from "@/lib/types";
import { FailedCard, Home, NotABirdCard, SightingActions } from "./Screens";
import { SpeciesCard } from "./SpeciesCard";

const LOST =
  "The connection to the field station was lost before every note came back. What arrived is below.";

function announcement(s: Sighting | null): string {
  if (!s) return "";
  if (s.notABird) return `${s.notABird.title}. ${s.notABird.line}`;
  if (s.errors.request) return s.errors.request;
  if (s.status === "done") return "Field guide entry complete.";
  if (s.researcher?.verdict) return `Verdict: ${s.researcher.verdict}`;
  return "Observing the billboard. Results will appear as they arrive.";
}

export default function BirderApp() {
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const lifeList = useSyncExternalStore(subscribeLifeList, getLifeList, getServerLifeList);
  const run = useRef<AbortController | null>(null);
  const saved = useRef(new Set<string>());

  // The browser's back button returns to the field guide.
  useEffect(() => {
    const onPop = () => {
      run.current?.abort();
      setSighting(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Finished live sightings go on the life list.
  useEffect(() => {
    if (!sighting || sighting.source !== "live" || sighting.status !== "done") return;
    if (sighting.notABird || !(sighting.researcher || sighting.explainer) || saved.current.has(sighting.id)) return;
    saved.current.add(sighting.id);
    addToLifeList(sighting);
  }, [sighting]);

  const onEvent = useCallback((event: DecodeEvent) => {
    setSighting((s) => (s ? applyEvent(s, event) : s));
  }, []);

  const begin = useCallback((s: Sighting) => {
    run.current?.abort();
    const controller = new AbortController();
    run.current = controller;
    setSighting((previous) => {
      if (previous?.source === "live" && previous.photoUrl.startsWith("blob:")) URL.revokeObjectURL(previous.photoUrl);
      return s;
    });
    if (!window.history.state?.sighting) window.history.pushState({ sighting: true }, "");
    window.scrollTo({ top: 0 });
    return controller;
  }, []);

  const spot = useCallback(
    async (file: File) => {
      const controller = begin(newSighting("live", ""));
      const fail = (message: string) =>
        setSighting((s) => (s ? { ...s, status: "done", errors: { ...s.errors, request: message } } : s));
      let photo;
      try {
        photo = await preparePhoto(file);
      } catch (err) {
        if (!controller.signal.aborted) fail(err instanceof Error ? err.message : "We couldn't open that photo.");
        return;
      }
      if (controller.signal.aborted) return;
      setSighting((s) => (s ? { ...s, photoUrl: photo.url, thumb: photo.thumb } : s));
      try {
        await streamDecode(photo.blob, onEvent, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) return;
        fail(err instanceof DecodeRequestError ? err.message : "We lost the trail. Please try that sighting again.");
        return;
      }
      if (controller.signal.aborted) return;
      // The stream closed; if it never said "done", record what was lost.
      setSighting((s) =>
        s && s.status === "observing" ? { ...s, status: "done", errors: { pipeline: LOST, ...s.errors } } : s,
      );
    },
    [begin, onEvent],
  );

  const sample = useCallback(async () => {
    const controller = begin(newSighting("sample", SAMPLE_PHOTO));
    try {
      await replaySample(onEvent, controller.signal);
    } catch {
      // aborted
    }
  }, [begin, onEvent]);

  const openEntry = useCallback(
    (entry: LifeListEntry) => {
      begin({ ...newSighting("lifelist", entry.thumb ?? ""), ...entry, status: "done" });
    },
    [begin],
  );

  const home = useCallback(() => {
    run.current?.abort();
    if (window.history.state?.sighting) window.history.back();
    else setSighting(null);
  }, []);

  const actions = (primary?: string) => <SightingActions onFile={spot} onHome={home} primary={primary} />;

  let screen;
  if (!sighting) {
    screen = <Home onFile={spot} onSample={sample} lifeList={lifeList} onOpenEntry={openEntry} />;
  } else if (sighting.notABird) {
    screen = (
      <NotABirdCard
        sighting={sighting}
        actions={actions(sighting.notABird.reason === "unreadable" ? "Try again" : "Spot another")}
      />
    );
  } else if (sighting.errors.request || (sighting.status === "done" && !sighting.spotter)) {
    screen = <FailedCard sighting={sighting} actions={actions("Try again")} />;
  } else {
    screen = (
      <>
        <SpeciesCard key={sighting.id} sighting={sighting} actions={actions()} />
        {sighting.status === "observing" && (
          <div className="mt-6 text-center">
            <button type="button" className="link text-[0.95rem]" onClick={home}>
              Stop observing
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[36rem] px-4 pb-10 pt-4 sm:px-6 sm:pt-8">
      <p className="sr-only" aria-live="polite">
        {announcement(sighting)}
      </p>
      {screen}
    </div>
  );
}
