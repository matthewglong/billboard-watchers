import type { Sighting } from "./sighting";

// A birder's life list: every species you've seen, kept in this browser only.
// localStorage can be missing, full, or blocked (private mode), so every
// access is wrapped and the app works without it. Components read it through
// useSyncExternalStore(subscribeLifeList, getLifeList, getServerLifeList).

const KEY = "ad-hawk:life-list:v1";
// Pre-rename key; read as a fallback so existing life lists carry over.
const LEGACY_KEY = "billboard-birder:life-list:v1";
const MAX_ENTRIES = 30;

export type LifeListEntry = Pick<
  Sighting,
  "id" | "seenAt" | "thumb" | "spotter" | "explainer" | "researcher" | "photographer"
>;

const EMPTY: LifeListEntry[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedList: LifeListEntry[] = EMPTY;

function isEntry(v: unknown): v is LifeListEntry {
  return !!v && typeof v === "object" && typeof (v as LifeListEntry).id === "string" && "seenAt" in v;
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): LifeListEntry[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEntry) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Current list; returns the same array until the stored value changes. */
export function getLifeList(): LifeListEntry[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parse(raw);
  }
  return cachedList;
}

export function getServerLifeList(): LifeListEntry[] {
  return EMPTY;
}

export function subscribeLifeList(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(list: LifeListEntry[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Adds a finished sighting to the top of the list. */
export function addToLifeList(s: Sighting): void {
  const entry: LifeListEntry = {
    id: s.id,
    seenAt: s.seenAt,
    thumb: s.thumb,
    spotter: s.spotter,
    explainer: s.explainer,
    researcher: s.researcher,
    photographer: s.photographer,
  };
  let list = [entry, ...getLifeList().filter((e) => e.id !== s.id)].slice(0, MAX_ENTRIES);
  // If storage is full, drop the oldest sightings until it fits.
  while (!write(list) && list.length > 1) list = list.slice(0, -1);
  listeners.forEach((l) => l());
}
