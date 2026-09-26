import type { DecodeEvent, DecodeEventName } from "@/lib/types";

// POST the photo to /api/decode and read the Server-Sent Events as they
// arrive. EventSource only does GET, so this parses the stream by hand.

export class DecodeRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const EVENTS = new Set<DecodeEventName>([
  "spotter",
  "explainer",
  "researcher",
  "photographer",
  "not_a_bird",
  "error",
  "done",
]);

function parseFrame(frame: string): DecodeEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!EVENTS.has(name as DecodeEventName) || data.length === 0) return null;
  try {
    return { event: name, data: JSON.parse(data.join("\n")) } as DecodeEvent;
  } catch {
    return null;
  }
}

export async function streamDecode(
  photo: Blob,
  onEvent: (event: DecodeEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const body = new FormData();
  body.append("image", photo, "sighting.jpg");

  let res: Response;
  try {
    res = await fetch("/api/decode", { method: "POST", body, signal });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new DecodeRequestError("We couldn't reach the field station. Check your connection and try again.", 0);
  }

  if (!res.ok || !res.body) {
    let message = "The field station turned us away. Please try again in a moment.";
    try {
      const json = await res.json();
      if (typeof json?.message === "string") message = json.message;
    } catch {
      // not JSON; keep the default message
    }
    throw new DecodeRequestError(message, res.status);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value.replace(/\r\n/g, "\n");
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = parseFrame(frame);
      if (event) onEvent(event);
    }
  }
}
