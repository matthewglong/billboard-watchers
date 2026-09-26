import "server-only";

// A simple in-memory limiter: 10 decodes per IP per 10 minutes. Each serverless
// instance keeps its own map, which is fine for a demo. Skipped on localhost.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

export function rateLimitEnabled(): boolean {
  return Boolean(process.env.VERCEL);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

/** Records a hit; returns seconds until the next slot opens, or 0 if allowed. */
export function takeSlot(ip: string, now = Date.now()): number {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return Math.ceil((recent[0] + WINDOW_MS - now) / 1000);
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }
  return 0;
}
