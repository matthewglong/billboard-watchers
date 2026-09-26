# Billboard Birder — Build Spec

> A bird-watching app for San Francisco tech billboards. Snap or upload a photo of a baffling AI billboard; a hushed nature-documentary narrator identifies the "species," explains what the company actually does in plain English, and translates every piece of jargon so a layperson walks away understanding the bigger picture.

**Build this end-to-end in one session.** It's a demo, not a production system: favor working and delightful over well-architected. Target: running on `localhost` in under an hour, deployable to Vercel as a stretch.

---

## 1. Product principles (read these twice)

1. **Informative first, funny second.** The costume is a field guide; the job is teaching. Every joke must sit next to a clear, true fact. If a line is funny but the reader learns nothing, cut it.
2. **Forest before trees.** Above the fold, a user should get the answer in five seconds: what this is, what it does, and a one-line verdict. Detail (jargon, bigger picture, product visuals) lives below and is scannable.
3. **Layperson only.** Write for a smart person with zero tech background, at roughly an 8th-grade reading level. Explanations never use jargon to explain jargon. If a term is unavoidable, it becomes a tappable chip.
4. **It must look like a bird-watching app.** Field notebook, species cards, binocular viewfinder, rubber stamps. Not a chatbot, not a SaaS dashboard.
5. **Never invent a company.** If the company can't be found, say so in character (rarity: Mythical) instead of guessing.

---

## 2. Stack

- **Next.js (App Router) + TypeScript + Tailwind**, so the same code runs on localhost and Vercel
- **`@anthropic-ai/sdk`**, with `ANTHROPIC_API_KEY` in `.env.local`. The key is server-side only and never reaches the browser.
- Models:
  - Spotter and Explainer: `claude-haiku-4-5-20251001`
  - Researcher: `claude-sonnet-5`
- Web search: use Anthropic's **web search server tool**. Check docs.claude.com for the current tool `type` string before writing it; don't guess.
- No database, no auth, no accounts.

---

## 3. The pipeline (multi-agent, streamed)

`POST /api/decode` accepts the image, runs the agents, and **streams results to the browser as Server-Sent Events** so each section of the card appears the moment it's ready. Nobody should stare at a blank screen for 30 seconds.

Before upload, the client downscales the image to about 1568px on the long edge as JPEG at quality 0.85, to cut latency.

```
photo ──► SPOTTER (Haiku, vision, ~3s)
              │
              ├──► RESEARCHER (Sonnet 5 + web search, ≤3 searches)
              ├──► EXPLAINER  (Haiku, vision — receives the PHOTO + spotter output)
              └──► PHOTOGRAPHER (no LLM — fetches og:image / logo)
```

**Stream events:** `spotter`, `explainer`, `researcher`, `photographer`, `done`, `error`, `not_a_bird`.

### 3a. Spotter (Haiku 4.5, vision)

This agent reads the billboard. It **must capture the visual**, not just the text, because billboards often land their meaning through imagery.

It returns JSON by forcing a single tool call whose `input_schema` is this shape:

```json
{
  "is_tech_billboard": true,
  "readable": true,
  "billboard_text": "exact text on the billboard",
  "company_name": "best guess or null",
  "company_url_guess": "https://... or null",
  "visual_read": "What's pictured, the visual metaphor, and the feeling the design is going for",
  "jargon_terms": ["agentic", "inference", "..."],
  "confidence": "high | medium | low"
}
```

Fallbacks:
- If `is_tech_billboard` is false, emit `not_a_bird` and stop. Example narrator line: *"Remarkable. This appears to be… a mattress advertisement. A common species, and not the one we seek."*
- If `readable` is false, emit `not_a_bird` with a retake prompt.

### 3b. Researcher (Sonnet 5 + web search, max 3 searches)

This agent finds the facts. It receives the spotter's JSON as text, not the image.

Use `tool_choice: auto` with two tools: web search, and a `submit_findings` tool. Instruct the model to search, then finish by calling `submit_findings`. Don't force `submit_findings` from the start, because a forced tool call would block searching.

```json
{
  "company_name": "Acme AI",
  "url": "https://acme.ai",
  "verdict": "≤12 words, plain English: what they sell and to whom",
  "behavior": "What the company actually does, 2 sentences, plain English, one concrete example of it in use",
  "diet": "Who it's for / who pays, 1 sentence",
  "habitat": "SF neighborhood or HQ city, or 'Unknown'",
  "natural_predators": ["Competitor A", "Competitor B"],
  "stage": "e.g. 'Seed-stage startup' / 'Public company' — plain English",
  "rarity": "common | uncommon | rare | mythical",
  "rarity_reason": "1 short line",
  "bigger_picture": "One paragraph (≤80 words): why this *category* of company exists right now and what problem in the world it's betting on. Plain English. Weave in the visual_read if it helps explain the billboard's message."
}
```

Rarity scale:
- **Common:** household names at OpenAI scale
- **Uncommon:** well-funded and known in tech
- **Rare:** seed or early stage
- **Mythical:** can't be found or confirmed

When it can't find something, the researcher says "Unknown" rather than inventing it.

### 3c. Explainer (Haiku 4.5, vision)

This agent translates and names the species. It receives **the photo itself** plus the spotter JSON, so it can interpret the visual joke.

It returns JSON by forcing a single tool call:

```json
{
  "species_name": "Latin-ish binomial, e.g. 'Agentica overfundus'",
  "field_notes": "2–3 sentences, narrator voice, describing the billboard itself as an observed creature — what it's displaying and what it's trying to communicate (uses the visual)",
  "jargon": [
    { "term": "agentic", "plain_english": "1–2 plain sentences", "joke": "one light line" }
  ],
  "jargon_density": 7,
  "jargon_density_note": "one quippy line"
}
```

### 3d. Photographer (no LLM)

This step brings back product visuals.
- It fetches `company_url_guess` server-side with a 5-second timeout and a normal browser user agent.
- It parses `og:image`, then `twitter:image`, then `apple-touch-icon` or favicon.
- It returns `{ hero_image_url, logo_url }`.
- If the fetch fails and the Researcher later returns a different `url`, it retries once with that URL.
- If nothing is found, it returns nulls and the UI hides the section.
- Stretch: add a Microlink free-tier homepage screenshot as a second image.

---

## 4. Glossary (predefined drill-down)

Create `data/glossary.json` with about **40 common AI and startup terms**, each written in plain English. Write them yourself during the build.

Shape of each entry:

```json
{
  "term": "LLM",
  "aliases": ["large language model", "language model"],
  "plain_english": "2 sentences max, zero jargon",
  "analogy": "one everyday comparison",
  "joke": "one light line in narrator voice"
}
```

Cover at least: AI, LLM, model, agent / agentic, AI agent, copilot, inference, training, fine-tuning, prompt, token, context window, RAG, embeddings, vector database, GPU, compute, API, SDK, open source, foundation model, multimodal, hallucination, eval, guardrails, orchestration, workflow automation, no-code, low-code, SaaS, B2B, enterprise, platform, infrastructure, observability, latency, seed round, Series A, runway, unicorn, YC.

When a user taps a chip:
- Match it case-insensitively against `term` and `aliases`.
- On a match, show the glossary entry in a bottom sheet with the plain English, the analogy and the joke.
- Otherwise, show the Explainer's version.

No recursive drill-down.

---

## 5. Narrator voice

Every agent prompt includes this voice guidance:

- Hushed, reverent, delighted **British nature-documentary narrator** observing startups in the wild. Describe the voice this way in the prompts; don't name or impersonate a real person, and never attribute invented quotes to anyone.
- The comedy comes from treating corporate behavior as animal behavior: courtship displays for venture capital, territorial marking on Market Street, the migration of engineers to open-plan offices.
- **Warm, never mean.** No value judgments between species. Be genuinely enthusiastic about what's cool; don't gush about what isn't. No raking companies over the coals.
- **Informative first.** Each funny line must carry a real fact. Use short sentences and plain words.

---

## 6. Screens and visual design

**Aesthetic:** a well-loved birding field guide, with these elements:
- **Page:** cream or parchment paper with subtle paper texture (CSS only)
- **Palette:** moss green, ink, robin's-egg blue accents, rust for stamps
- **Type:** an expressive serif for headings (e.g. Fraunces via `next/font`) and a highly readable body face (e.g. Source Sans 3) at 17px, max 65ch
- **Decoration:** hand-drawn feeling dividers, tape-corner photo mounts, rubber-stamp badges
- **Layout:** mobile-first at 380px, with no horizontal scroll

Informative must win: strong contrast, generous spacing, and no decorative element that hurts legibility.

### Screen 1 — Home ("The Field Guide")
- Title: **Billboard Birder**, with the subtitle *A Field Guide to the Wild Billboards of San Francisco*
- Two big buttons:
  - **Spot one now:** `<input type="file" accept="image/*" capture="environment">`
  - **From your camera roll:** the same input without `capture`
- A short narrator intro line.
- A **"Try a sample sighting"** link that loads a cached result from `fixtures/sample.json`. This is demo insurance for bad room wifi. Record the fixture from one real successful run.

### Screen 2 — Observing (loading)
- The uploaded photo inside a **binocular viewfinder** vignette (two overlapping circles, soft blur outside).
- Rotating narrator lines every ~2.5s, e.g.:
  - "The researcher approaches the billboard slowly, so as not to startle it…"
  - "Consulting the literature…"
  - "A distinctive call. We have heard this word 'agentic' before…"
- Stream in card sections as their events arrive; don't wait for all four.

### Screen 3 — The Species Card (the result)

**Above the fold (the forest):**
1. Field photo, mounted with tape corners
2. *Species name* (italic) with the common name (company) beneath it, and a **rarity badge** (Common / Uncommon / Rare / Mythical)
3. **Verdict**: the ≤12-word plain-English line, set large. This is the single most important element on the page.
4. A **"DECODED"** rubber stamp, slightly rotated

**Field entries** (compact label/value rows, like a species card):
- **Call:** the billboard text
- **Behavior:** what it does
- **Diet:** who it's for
- **Habitat:** where it lives
- **Natural predators:** competitors
- **Life stage:** plain-English company stage

**Below (the trees):**
- **Field notes:** the narrator's reading of the billboard, including the visual
- **Jargon spotted:** tappable chips that open a bottom sheet (see §4)
- **The bigger picture:** a single paragraph, set in a lightly tinted box
- **Observed in the wild:** product image and logo from the Photographer, hidden if absent
- **Jargon density:** an "X / 10" rubber stamp with the note
- A **"Spot another"** button

For each section that hasn't arrived yet, show a skeleton with a tiny narrator placeholder ("Still observing…").

---

## 7. Resilience

- Each agent has its own timeout: Spotter 15s, Explainer 20s, Researcher 45s, Photographer 8s. One failure shouldn't kill the card; render what arrived, with an in-character note for the missing section.
- Wrap all JSON parsing in try/catch. Validate the shape and fill missing fields with `null`.
- Log each agent's latency to the server console so the pipeline can be tuned.
- For Vercel, set `export const maxDuration = 60` on the route and add a simple in-memory per-IP limit of 10 decodes per 10 minutes. On localhost, skip the limit.

---

## 8. Build order

1. Scaffold Next.js, Tailwind and fonts; write `glossary.json`.
2. Build `/api/decode` with the SSE stream, test it with one real billboard photo via curl, and log the output.
3. Build Screen 3 against a hardcoded result object until it looks right.
4. Wire streaming into Screens 2 and 3.
5. Build Screen 1, record `fixtures/sample.json`, and wire up the sample button.
6. Polish: stamps, viewfinder, tape corners, bottom sheet.
7. **Stretch goals, only if time remains:**
   - A "Life List" of past sightings in `localStorage`, wrapped in try/catch
   - A Microlink screenshot
   - Vercel deploy

## 9. Out of scope

Maps, accounts, server persistence, recursive drill-down, a "creator mode" with founder and funding dossiers, and sharing.

## 10. Done when

- Photographing a real SF tech billboard on a phone over localhost (or a local network IP) shows the verdict within ~15s and a complete card within ~40s.
- A layperson can read the card and explain back what the company does and what at least two jargon terms mean.
- Photographing something that isn't a tech billboard produces a graceful in-character fallback, not a hallucinated company.
- The sample sighting works with wifi off.
