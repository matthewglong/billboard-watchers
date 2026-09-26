import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { cleanUrl } from "../normalize";
import type { PhotographerResult } from "../types";

// No LLM here: fetch the company's homepage and pull its share image and icon.
// og:image, then twitter:image for the hero; apple-touch-icon, then the largest
// icon link, then /favicon.ico for the logo.

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 800_000;
const MAX_REDIRECTS = 4;

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Refuse to fetch anything that resolves to localhost or a private network. */
async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error(`blocked host ${host}`);
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error(`blocked host ${host}`);
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (text.length < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    text += chunk;
    // Everything we need lives in <head>; stop once it has closed.
    if (/<\/head>/i.test(text.slice(-(chunk.length + 8)))) break;
  }
  reader.cancel().catch(() => {});
  return text;
}

async function fetchHtml(start: URL, signal: AbortSignal): Promise<{ html: string; finalUrl: URL }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "user-agent": BROWSER_UA,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("bad redirect");
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) throw new Error(`not html (${type})`);
    return { html: await readCapped(res, MAX_HTML_BYTES), finalUrl: url };
  }
  throw new Error("too many redirects");
}

type Attrs = Record<string, string>;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/");
}

function tags(html: string, name: "meta" | "link"): Attrs[] {
  const out: Attrs[] = [];
  const tagRe = new RegExp(`<${name}\\b([^>]*)>`, "gi");
  const attrRe = /([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  for (const m of html.matchAll(tagRe)) {
    const attrs: Attrs = {};
    for (const a of m[1].matchAll(attrRe)) {
      attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? "");
    }
    out.push(attrs);
  }
  return out;
}

function absolute(href: string | undefined, base: URL): string | null {
  if (!href?.trim()) return null;
  try {
    const u = new URL(href.trim(), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

function metaContent(metas: Attrs[], keys: string[]): string | undefined {
  for (const key of keys) {
    const hit = metas.find((m) => (m.property ?? m.name ?? "").toLowerCase() === key && m.content);
    if (hit) return hit.content;
  }
  return undefined;
}

function iconSize(sizes: string | undefined): number {
  const m = sizes?.match(/(\d+)x(\d+)/);
  return m ? Number(m[1]) : 0;
}

function pickLogo(links: Attrs[], base: URL): string | null {
  const rels = (l: Attrs) => (l.rel ?? "").toLowerCase().split(/\s+/);
  const touch = links.filter((l) => l.href && rels(l).some((r) => r.startsWith("apple-touch-icon")));
  const icons = links.filter((l) => l.href && rels(l).includes("icon") && !/\.svg(\?|$)/i.test(l.href));
  const svgIcons = links.filter((l) => l.href && rels(l).includes("icon") && /\.svg(\?|$)/i.test(l.href));
  const biggest = (list: Attrs[]) => [...list].sort((a, b) => iconSize(b.sizes) - iconSize(a.sizes))[0];
  const pick = biggest(touch) ?? biggest(icons) ?? svgIcons[0];
  return absolute(pick?.href, base) ?? absolute("/favicon.ico", base);
}

/** Stretch goal: a Microlink free-tier screenshot, loaded by the browser on demand. */
function microlinkScreenshot(pageUrl: string): string {
  const q = new URLSearchParams({
    url: pageUrl,
    screenshot: "true",
    meta: "false",
    embed: "screenshot.url",
    "viewport.width": "1280",
    "viewport.height": "800",
  });
  return `https://api.microlink.io/?${q}`;
}

export async function runPhotographer(rawUrl: string, signal: AbortSignal): Promise<PhotographerResult> {
  const cleaned = cleanUrl(rawUrl);
  if (!cleaned) throw new Error(`unusable url: ${rawUrl}`);
  const { html, finalUrl } = await fetchHtml(
    new URL(cleaned),
    AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
  );
  const head = html.split(/<\/head>/i)[0];
  const metas = tags(head, "meta");
  const hero = absolute(
    metaContent(metas, ["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"]),
    finalUrl,
  );
  return {
    hero_image_url: hero,
    logo_url: pickLogo(tags(head, "link"), finalUrl),
    screenshot_url: microlinkScreenshot(finalUrl.href),
    page_url: finalUrl.href,
  };
}

/** Hostname without "www.", for comparing the Spotter's guess to the Researcher's URL. */
export function siteKey(url: string | null | undefined): string | null {
  const cleaned = cleanUrl(url);
  return cleaned ? new URL(cleaned).hostname.replace(/^www\./, "").toLowerCase() : null;
}
