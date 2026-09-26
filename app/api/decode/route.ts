import type { ImageInput } from "@/lib/anthropic";
import { runPipeline, type Emit } from "@/lib/pipeline";
import { clientIp, rateLimitEnabled, takeSlot } from "@/lib/rate-limit";

// POST /api/decode: multipart form with an "image" field. Streams the agents'
// results back as Server-Sent Events: spotter, explainer, researcher,
// photographer, not_a_bird, error, done.

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // the Claude API's per-image limit

function fail(status: number, error: string, message: string) {
  return Response.json({ error, message }, { status });
}

/** Identify the image by its magic bytes rather than trusting the client. */
function sniffImage(bytes: Uint8Array): ImageInput["mediaType"] | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail(500, "not_configured", "The expedition has no permit: ANTHROPIC_API_KEY isn't set on the server.");
  }

  if (rateLimitEnabled()) {
    const wait = takeSlot(clientIp(req));
    if (wait > 0) {
      return fail(
        429,
        "rate_limited",
        `Easy now. Ten sightings every ten minutes, lest we disturb the wildlife. Try again in about ${Math.ceil(wait / 60)} min.`,
      );
    }
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("image");
  } catch {
    return fail(400, "bad_request", "We expected a photograph, and received none.");
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return fail(400, "no_image", "We expected a photograph, and received none.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return fail(413, "too_large", "That photograph is too large to carry back to camp. Try a smaller one.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImage(bytes);
  if (!mediaType) {
    return fail(415, "unsupported_image", "We can't read that kind of image. A JPEG, PNG, or screenshot will do nicely.");
  }
  const image: ImageInput = { base64: Buffer.from(bytes).toString("base64"), mediaType };

  // Stop the agents if the browser goes away.
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false;
        }
      };
      const emit: Emit = (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      // SSE comment lines keep proxies from closing a quiet connection.
      const keepAlive = setInterval(() => write(": still observing\n\n"), 10_000);
      try {
        await runPipeline(image, emit, abort.signal);
      } catch (err) {
        console.error("[decode] pipeline crashed", err);
        emit("error", { section: "pipeline", message: "Something startled the whole expedition. Please try again." });
        emit("done", { total_ms: 0, timings: {} });
      } finally {
        clearInterval(keepAlive);
        if (open) {
          open = false;
          controller.close();
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
