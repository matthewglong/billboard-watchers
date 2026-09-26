import "server-only";
import { getClient, MODELS } from "../anthropic";
import { NARRATOR_VOICE } from "../voice";

// The verdict is the most important line on the card, and the researcher
// writes it in one fast pass. When that pass slips into jargon or runs long,
// a quick Haiku call rewrites it. Clean verdicts skip this step entirely.

const MAX_WORDS = 12;
const BANNED = [
  "agent",
  "agents",
  "agentic",
  "platform",
  "data warehouse",
  "warehouse",
  "pipeline",
  "pipelines",
  "infrastructure",
  "open-source",
  "open source",
  "cloud-native",
  "engine",
  "LLM",
  "LLMs",
  "model",
  "models",
  "multimodal",
  "SaaS",
  "analytics",
  "API",
  "APIs",
  "SDK",
  "stack",
  "built on",
];
const BANNED_RE = new RegExp(`\\b(${BANNED.map((w) => w.replace(/[-\s]/g, "[-\\s]?")).join("|")})\\b`, "i");

// Product names ("DuckDB") and acronyms ("CRM") are jargon too; "AI" is fine.
const CAMEL_CASE_RE = /\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/;
const ACRONYM_RE = /\b(?!AI\b)[A-Z]{3,}s?\b/;

const wordCount = (s: string) => s.trim().split(/\s+/).length;

export function verdictNeedsPolish(verdict: string): boolean {
  return (
    wordCount(verdict) > MAX_WORDS ||
    BANNED_RE.test(verdict) ||
    CAMEL_CASE_RE.test(verdict) ||
    ACRONYM_RE.test(verdict)
  );
}

export async function polishVerdict(verdict: string, company: string | null, signal: AbortSignal): Promise<string> {
  const message = await getClient().messages.create(
    {
      model: MODELS.explainer,
      max_tokens: 80,
      temperature: 0.3,
      system: `You edit the one-line verdict on a Billboard Birder species card: what a company sells and to whom, for readers with no tech background. Reply with the rewritten line only: no quotes, no preamble.

${NARRATOR_VOICE}

The verdict is the one line where the narrator steps aside: plain facts, no jokes, no flourishes.`,
      messages: [
        {
          role: "user",
          content: `Company: ${company ?? "unknown"}\nDraft: ${verdict}\n\nRewrite the draft as one plain-English line of about 9 words, never more than ${MAX_WORDS}, saying what they sell and to whom. Use words a 12-year-old knows; "AI" and "app" are fine. Don't use any of these: ${BANNED.join(", ")}. Don't name the technology it runs on. Keep the facts in the draft and add none; if the draft says the company couldn't be found or confirmed, say that instead.`,
        },
      ],
    },
    { signal },
  );
  const text = message.content.find((b) => b.type === "text")?.text ?? "";
  const line = text.trim().split("\n")[0].replace(/^["“]|["”]$/g, "").trim();
  return line && wordCount(line) <= MAX_WORDS + 2 ? line : verdict;
}
