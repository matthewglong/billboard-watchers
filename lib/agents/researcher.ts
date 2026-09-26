import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODELS, toolInput } from "../anthropic";
import { cleanUrl, normalizeResearcher } from "../normalize";
import type { ResearcherResult, Source, SpotterResult } from "../types";
import { NARRATOR_VOICE } from "../voice";
import { polishVerdict, verdictNeedsPolish } from "./verdict";

const SUBMIT_FINDINGS: Anthropic.Tool = {
  name: "submit_findings",
  description:
    "File the field-guide entry for the company behind the billboard. Call this exactly once, after you have finished searching. It is your final answer.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "company_name",
      "url",
      "verdict",
      "behavior",
      "diet",
      "habitat",
      "natural_predators",
      "stage",
      "rarity",
      "rarity_reason",
      "bigger_picture",
    ],
    properties: {
      company_name: { type: "string", description: "The company's real name, or 'Unknown'." },
      url: {
        type: ["string", "null"],
        description: "The company's official website (https://…), or null if not confirmed.",
      },
      verdict: {
        type: "string",
        description:
          "About 9 words, never more than 12. Plain English: what they sell and to whom. No jokes, no jargon.",
      },
      behavior: {
        type: "string",
        description:
          "Exactly 2 sentences: what the company actually does, including one concrete example of it in use.",
      },
      diet: { type: "string", description: "1 sentence: who it is for and who pays." },
      habitat: {
        type: "string",
        description: "SF neighborhood or HQ city (e.g. 'SoMa, San Francisco' or 'Seattle, WA'), or 'Unknown'.",
      },
      natural_predators: {
        type: "array",
        items: { type: "string" },
        description: "2–3 real competitors by name. Empty if you are not sure.",
      },
      stage: {
        type: "string",
        description:
          "Plain-English company stage, e.g. 'Early-stage startup (raised about $5M)', 'Well-funded startup (Series B)', 'Public company', or 'Unknown'.",
      },
      rarity: { type: "string", enum: ["common", "uncommon", "rare", "mythical"] },
      rarity_reason: { type: "string", description: "1 short line explaining the rarity." },
      bigger_picture: {
        type: "string",
        description:
          "One paragraph, 80 words or fewer: why this category of company exists right now and what problem in the world it is betting on. Plain English.",
      },
    },
  },
};

const SYSTEM = `You are the Researcher on Ad Hawk, a field expedition cataloguing the wild tech billboards of San Francisco. The Spotter photographed a billboard and sent you a field report. You find the facts about the company behind it, then file its field-guide entry by calling submit_findings.

HOW TO WORK
1. Search the web to confirm who the advertiser is and what it actually sells. You have at most 3 searches, and 1–2 is usually enough. Good first searches: the printed web address, or the company name plus a distinctive word from the billboard. Prefer the company's own site, plus a reputable news or funding source for stage and headquarters.
2. Then call submit_findings exactly once. Don't write a long text answer: the entry is the answer.

NEVER INVENT
- The Spotter's company name and URL are guesses from a photo. Verify them. A web address printed on the billboard beats a guess.
- State only facts you found in search results or know with high confidence. If a field cannot be confirmed, write "Unknown" (or leave natural_predators empty).
- If you cannot confirm that the company exists or what it does, set rarity to "mythical", mark unconfirmed fields "Unknown", and make the verdict say plainly that no confirmed record exists. Never guess a company from vibes.

WRITING RULES
- verdict: the most important line on the card. Aim for about 9 words; never more than 12. Say what they sell and to whom, in words a 12-year-old knows: what it does for the customer, not what it is built on or how it works. "AI" and "app" are fine. Never use: agent, agentic, platform, data warehouse, warehouse, pipeline, infrastructure, open-source, cloud-native, engine, LLM, model, multimodal, SaaS, analytics, or any product or technology name (like "DuckDB"). Before you file, reread it: if any word would puzzle a grandparent, rewrite it. Examples: "An AI helper that answers customers' questions for companies." / "Helps companies sort through and study their own data, fast."
- behavior: exactly 2 sentences, with one concrete example of the product in use.
- behavior, diet and bigger_picture: no unexplained tech terms. If one is unavoidable, explain it in the same sentence, e.g. "open-source (free for anyone to use and change)".
- diet: 1 short sentence on who uses it and who pays.
- habitat: SF neighborhood if known, otherwise the headquarters city.
- natural_predators: 2–3 real competitors a curious reader could look up. Never the company's own parent or owner.
- stage: plain English, 12 words or fewer, e.g. "Well-funded startup (Series B, about $100M raised)" or "Owned by Salesforce since 2026".
- rarity: common = household names at OpenAI scale; uncommon = well-funded and known in tech; rare = seed or early stage; mythical = can't be found or confirmed.
- bigger_picture: 80 words or fewer. Why this category of company exists right now and what problem in the world it bets on. If the Spotter's visual_read helps explain the billboard's message, weave it in, and describe that message generously.

${NARRATOR_VOICE}

Facts carry the entry. Keep verdict, behavior and diet crisp and literal; let the narrator's warmth show in rarity_reason and bigger_picture.`;

export interface ResearcherOptions {
  /**
   * Web search tool version, per platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
   * (checked 2026-09-26: web_search_20250305 basic, _20260209 dynamic filtering, _20260318 +
   * response_inclusion). We default to basic: on our sample billboards it filed the verdict at
   * ~5s, while dynamic filtering's code-execution step pushed it to 15–21s.
   */
  searchTool?: "web_search_20250305" | "web_search_20260209" | "web_search_20260318";
  thinking?: "adaptive" | "disabled";
  effort?: "low" | "medium" | "high";
  strict?: boolean;
  /** Fires once, as soon as the verdict has streamed in, before the rest of the entry. */
  onPreview?: (preview: Pick<ResearcherResult, "company_name" | "url" | "verdict">) => void;
  onLog?: (msg: string) => void;
}

const MAX_SEARCHES = 3;

function searchToolDef(type: NonNullable<ResearcherOptions["searchTool"]>): Anthropic.Messages.ToolUnion {
  return {
    type,
    name: "web_search",
    max_uses: MAX_SEARCHES,
    user_location: {
      type: "approximate",
      city: "San Francisco",
      region: "California",
      country: "US",
      timezone: "America/Los_Angeles",
    },
  } as Anthropic.Messages.ToolUnion;
}

function collectSources(content: Anthropic.ContentBlock[], into: Source[]) {
  for (const block of content) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const r of block.content) {
      if (r.type === "web_search_result" && r.url && !into.some((s) => s.url === r.url)) {
        into.push({ url: r.url, title: r.title });
      }
    }
  }
}

/** A string field from partial tool-input JSON, once its closing quote has arrived. */
function completedString(partialJson: string, key: string): string | null {
  const m = partialJson.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return null;
  }
}

export async function runResearcher(
  spotter: SpotterResult,
  signal: AbortSignal,
  opts: ResearcherOptions = {},
): Promise<ResearcherResult> {
  const { searchTool = "web_search_20250305", thinking = "disabled", effort = "low", strict = true, onLog } = opts;
  let onPreview = opts.onPreview;
  const client = getClient();
  const started = Date.now();
  const log = (msg: string) => onLog?.(`+${((Date.now() - started) / 1000).toFixed(1)}s ${msg}`);

  // Eager streaming lets the verdict reach the browser before the rest of the entry
  // is written. It skips server-side validation, so strict mode keeps the JSON valid.
  const submit: Anthropic.Tool = { ...SUBMIT_FINDINGS, strict, eager_input_streaming: true };
  const tools: Anthropic.Messages.ToolUnion[] = [searchToolDef(searchTool), submit];
  const report = {
    billboard_text: spotter.billboard_text,
    company_name: spotter.company_name,
    company_url_guess: spotter.company_url_guess,
    visual_read: spotter.visual_read,
    jargon_terms: spotter.jargon_terms,
    confidence: spotter.confidence,
  };
  const today = new Date().toISOString().slice(0, 10);
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Today is ${today}. The Spotter's field report:\n${JSON.stringify(report, null, 2)}\n\nIdentify the company behind this billboard, then call submit_findings.`,
    },
  ];
  const sources: Source[] = [];

  // Checks the verdict (and rewrites it if it slipped into jargon) as soon as
  // it has streamed in, while the rest of the entry is still being written.
  let verdictTask: Promise<string> | null = null;
  const finishVerdict = (verdict: string, company: string | null): Promise<string> => {
    if (!verdictNeedsPolish(verdict)) return Promise.resolve(verdict);
    log(`polishing verdict: ${verdict}`);
    return polishVerdict(verdict, company, signal).catch(() => verdict);
  };

  // Streams one request, surfacing the verdict the moment it is complete.
  async function call(extra: Pick<Anthropic.MessageCreateParams, "thinking" | "tool_choice">) {
    const stream = client.messages.stream(
      { model: MODELS.researcher, max_tokens: 6000, system: SYSTEM, tools, output_config: { effort }, messages, ...extra },
      { signal },
    );
    let submitIndex = -1;
    let partial = "";
    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const b = event.content_block;
        log(`${b.type}${b.type === "tool_use" || b.type === "server_tool_use" ? `:${b.name}` : ""}`);
        if (b.type === "tool_use" && b.name === SUBMIT_FINDINGS.name) submitIndex = event.index;
      } else if (
        event.type === "content_block_delta" &&
        event.index === submitIndex &&
        event.delta.type === "input_json_delta"
      ) {
        partial += event.delta.partial_json;
        const verdict = verdictTask ? null : completedString(partial, "verdict");
        if (verdict) {
          log("verdict ready");
          const company_name = completedString(partial, "company_name");
          const url = cleanUrl(completedString(partial, "url"));
          verdictTask = finishVerdict(verdict, company_name);
          const preview = onPreview;
          verdictTask.then((v) => preview?.({ company_name, url, verdict: v }));
          onPreview = undefined;
        }
      }
    }
    const message = await stream.finalMessage();
    collectSources(message.content, sources);
    log(`done: stop=${message.stop_reason} searches=${message.usage.server_tool_use?.web_search_requests ?? 0} out=${message.usage.output_tokens}`);
    return message;
  }

  const file = async (findings: unknown): Promise<ResearcherResult> => {
    const entry = normalizeResearcher(findings, sources);
    if (entry.verdict) entry.verdict = await (verdictTask ?? finishVerdict(entry.verdict, entry.company_name));
    return entry;
  };

  for (let turn = 1; turn <= 4; turn++) {
    const message = await call({ thinking: { type: thinking }, tool_choice: { type: "auto" } });
    const findings = toolInput(message, SUBMIT_FINDINGS.name);
    if (findings !== undefined) return file(findings);
    if (message.stop_reason === "refusal") throw new Error("researcher declined");

    messages.push({ role: "assistant", content: message.content });
    if (message.stop_reason === "pause_turn") continue; // server-side search loop paused; resume as-is

    // It finished its turn without filing. Force the filing, without new searches.
    messages.push({ role: "user", content: "File the entry now: call submit_findings with what you found." });
    const forced = await call({
      thinking: { type: "disabled" }, // forced tool_choice is incompatible with thinking
      tool_choice: { type: "tool", name: SUBMIT_FINDINGS.name },
    });
    const forcedFindings = toolInput(forced, SUBMIT_FINDINGS.name);
    if (forcedFindings !== undefined) return file(forcedFindings);
    throw new Error(`researcher never filed (stop_reason: ${forced.stop_reason})`);
  }
  throw new Error("researcher ran out of turns");
}
