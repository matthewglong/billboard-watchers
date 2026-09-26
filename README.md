# Ad Hawk

*A Field Guide to the Wild Billboards of San Francisco.*

Photograph a baffling tech billboard. A hushed, delighted nature-documentary narrator identifies the "species", says in plain English what the company actually does, and translates every piece of jargon so a non-tech reader walks away understanding the bigger picture.

Built from [`AD_HAWK_SPEC.md`](./AD_HAWK_SPEC.md).

## Run it

```bash
npm install
cp .env.example .env.local     # then paste your Anthropic API key into .env.local
npm run dev
```

Open http://localhost:3000. No key handy? **Try a sample sighting** replays a recorded run, fully offline.

**On your phone:** keep `npm run dev` running and open the "Network" address it prints (for example `http://192.168.1.20:3000`) on a phone on the same wifi. `next.config.ts` allows this machine's LAN addresses automatically. On a phone, **Spot one now** opens the camera directly.

## How it works

`POST /api/decode` takes the photo and streams the agents' results back as Server-Sent Events, so each part of the card appears the moment it's ready.

```
photo ──► SPOTTER  (Haiku 4.5, vision)      reads the billboard: text, imagery, jargon, company
              │
              ├──► RESEARCHER (Sonnet 5 + web search, ≤3 searches)   facts, verdict, rarity
              ├──► EXPLAINER  (Haiku 4.5, vision: photo + Spotter)   species name, field notes, jargon
              └──► PHOTOGRAPHER (no LLM)                             og:image, icon, homepage screenshot
```

Events: `spotter`, `explainer`, `researcher` (sent twice: first with just the verdict, then the full entry), `photographer`, `not_a_bird`, `error`, `done`.

- **Spotter** and **Explainer** use a forced tool call to return JSON. Every agent's output goes through `lib/normalize.ts`, which validates the shape and fills anything missing with `null`.
- **Researcher** runs with `tool_choice: auto` and two tools: the web search server tool (`max_uses: 3`) and `submit_findings`. It streams, and the verdict is forwarded to the browser as soon as that field is complete, several seconds before the rest of the entry. If the model ends its turn without filing, a forced `submit_findings` call finishes the job. `pause_turn` is resumed.
- **The verdict** is the most important line on the card. If the Researcher's one-pass verdict slips into jargon or runs past 12 words, a quick Haiku call rewrites it (`lib/agents/verdict.ts`); clean verdicts skip this.
- **Photographer** fetches the company's homepage server-side (5s timeout, browser user agent, private-network addresses refused) and reads `og:image`, `twitter:image`, then `apple-touch-icon` or the favicon. If that finds nothing, or the Researcher confirms a different site than the Spotter guessed, it retries once with the Researcher's URL. It also offers a Microlink homepage screenshot.
- **Fallbacks:** not a tech billboard, or an unreadable one, gets an in-character `not_a_bird` card. A company that can't be confirmed is marked **Mythical**, with no guesses. Each agent has its own timeout (Spotter 15s, Explainer 20s, Researcher 45s, Photographer 8s), and one failure never sinks the card: the missing section gets an in-character note.
- **Narrator voice** lives in `lib/voice.ts` and is included in every agent prompt.

### Choices made while building

- **Web search tool version.** The docs (checked 2026-09-26) list `web_search_20250305` (basic), `web_search_20260209` (dynamic filtering) and `web_search_20260318` (adds `response_inclusion`). On the sample billboards, basic search filed the verdict about 5s into the Researcher's turn; dynamic filtering's code-execution step pushed that to 15–21s. For a card that must show its verdict within about 15 seconds, basic wins.
- **Strict tool schemas.** `submit_findings` uses `strict: true`: with eager input streaming, the server no longer validates tool JSON, and strict mode is what keeps the streamed JSON valid. The Haiku agents don't use strict mode, because it added about 1.5s (and more on a schema's first use); their output is validated by the normalizers instead.
- **Thinking** is off for the Researcher. Adaptive thinking didn't improve the verdicts and delayed them by 13–21 seconds.

### Measured latency (MacBook, home wifi, three sample billboards)

| | Spotter | Verdict | Explainer | Complete card |
|---|---|---|---|---|
| Typical | 4–7s | 10–12s | 10–14s | 15–19s |

Every agent's latency is logged to the server console, for example `[decode] researcher ok 11.9s`.

## The sample sighting

`fixtures/sample.json` is a real run against the MotherDuck billboard, with its photo and every image it references stored in `public/sample/`. The app plays it back a little faster than real time, entirely offline. To re-record it from a different photo (a JPEG about 1568px on the long edge, like the browser sends):

```bash
npm run dev          # in one terminal
npm run record-sample -- path/to/billboard.jpg
```

## Other scripts

- `npm run bench -- photo.jpg [spotter|explainer|researcher|all]` runs agents directly and prints their output and timings. It was used to tune prompts and choose the search tool.
- `npm run typecheck`, `npm run lint`, `npm run build`.

## Deploying to Vercel

1. Import the repo into Vercel.
2. Add `ANTHROPIC_API_KEY` under Project Settings → Environment Variables.
3. Deploy. The decode route sets `maxDuration = 60`. On Vercel an in-memory limiter allows 10 decodes per IP per 10 minutes; each serverless instance keeps its own count, which is fine for a demo. Locally there is no limit.

## Project layout

```
app/api/decode/route.ts   SSE endpoint: validates the upload, runs the pipeline
lib/pipeline.ts           orchestration, timeouts, latency logs, fallbacks
lib/agents/               spotter, researcher, explainer, photographer, verdict
lib/voice.ts              the narrator voice shared by every prompt
lib/normalize.ts          defensive validation of model output
lib/client/               upload prep (downscale, HEIC), SSE client, glossary lookup, life list, sample replay
components/               the field guide: cover, viewfinder, species card, stamps, bottom sheet
data/glossary.json        53 AI and startup terms in plain English
fixtures/sample.json      recorded sample sighting (images in public/sample/)
```

## Notes

- Photos are downscaled in the browser to about 1568px, as JPEG at 0.85, before upload. iPhone HEIC photos that desktop Chrome can't open are converted in the browser by a WebAssembly decoder (`heic-to`), which loads only when needed.
- The **Life List** of past sightings lives in the browser's `localStorage` and never leaves the device.
- Photos are sent to the Anthropic API to be read and are not stored by this app.
