import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getClient, imageBlock, MODELS, toolInput, type ImageInput } from "../anthropic";
import { normalizeSpotter } from "../normalize";
import type { SpotterResult } from "../types";
import { NARRATOR_VOICE } from "../voice";

const nullableString = (description: string) => ({ type: ["string", "null"], description });

// Property order is generation order: read and describe first, judge last.
const RECORD_SIGHTING: Anthropic.Tool = {
  name: "record_sighting",
  description: "Record exactly what the billboard in the field photo shows. Call this exactly once.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "billboard_text",
      "visual_read",
      "company_name",
      "company_url_guess",
      "jargon_terms",
      "confidence",
      "readable",
      "is_tech_billboard",
      "subject_if_not_tech",
    ],
    properties: {
      billboard_text: nullableString(
        "The exact words printed on the advertisement, in reading order, with a line break wherever the ad breaks a line. Keep the ad's own capitalization and punctuation. Only the ad itself: never the frame, the billboard operator's logo (e.g. Clear Channel, Outfront), street signs, or nearby shop signs. null if there is no ad text.",
      ),
      visual_read: {
        type: "string",
        description:
          "2–3 plain sentences: what is pictured, the visual metaphor it seems to use, and the feeling the design is going for. Describe; don't guess facts about the company.",
      },
      company_name: nullableString(
        "The advertiser's name exactly as shown in its logo or text (e.g. 'MotherDuck'). If only a web address is printed, derive the name from it. null if no brand is visible. Never guess from style alone.",
      ),
      company_url_guess: nullableString(
        "The advertiser's website. If a web address is printed on the ad, use exactly that (e.g. 'https://motherduck.com'). Otherwise give the official domain only if you are highly confident of it; else null. Never invent a domain.",
      ),
      jargon_terms: {
        type: "array",
        items: { type: "string" },
        description:
          "Words or short phrases on the ad that a person with no tech background would not understand, as written (e.g. 'agentic', 'multimodal data', 'pipelines'). 0–6 items. Skip plain words and brand names.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "How sure you are about company_name.",
      },
      readable: {
        type: "boolean",
        description:
          "false only when the photo shows an advertisement whose words or brand can't be made out: too blurry, dark, far away, glared or cropped. If the photo isn't an ad at all, or the ad can be read, true.",
      },
      is_tech_billboard: {
        type: "boolean",
        description:
          "true if this is an advertisement (billboard, bus shelter poster, wall wrap, digital screen, vehicle wrap) for a technology company or product: software, AI, apps, developer tools, data, cloud, fintech, crypto and similar. false for any other ad (mattresses, TV shows, drinks, cars, lawyers) and for anything that isn't an ad at all. If it is an ad too blurry or dark to tell what it's for, true: we'll ask for a retake.",
      },
      subject_if_not_tech: nullableString(
        "Only when is_tech_billboard is false: a short noun phrase with an article saying what the photo actually shows, e.g. 'a mattress advertisement', 'a pigeon', 'a burrito'. Otherwise null.",
      ),
    },
  },
};

const SYSTEM = `You are the Spotter on Billboard Birder, a field expedition cataloguing the wild tech billboards of San Francisco. People photograph a baffling tech billboard; you read it so the rest of the team can explain it.

YOUR JOB
Read the field photo carefully and call record_sighting once.
- Transcribe the ad's text exactly. Leave out everything that is not part of the ad itself: the billboard operator's logo on the frame, shop awnings, street signs, graffiti.
- Capture the visual, not just the words. Billboards often land their meaning through imagery: say what is pictured, what metaphor it seems to use, and what feeling it is going for.
- Identify the advertiser only from what is visible: a logo, a name, a printed web address. If nothing identifies the company, say so with null. Never invent a company or a domain.
- List the jargon a layperson would trip over.
- Decide whether this is a tech billboard at all, and whether it is readable. A photo of a real ad taken at an angle or from a car is fine if the words can still be read.

${NARRATOR_VOICE}

Your fields are mostly factual. Keep the narrator's style to a light touch in visual_read, and keep it accurate.`;

export async function runSpotter(image: ImageInput, signal: AbortSignal): Promise<SpotterResult> {
  const message = await getClient().messages.create(
    {
      model: MODELS.spotter,
      max_tokens: 1500,
      temperature: 0.2,
      system: SYSTEM,
      tools: [RECORD_SIGHTING],
      tool_choice: { type: "tool", name: RECORD_SIGHTING.name },
      messages: [
        {
          role: "user",
          content: [
            imageBlock(image),
            { type: "text", text: "Here is today's field photo. Record the sighting." },
          ],
        },
      ],
    },
    { signal },
  );
  const input = toolInput(message, RECORD_SIGHTING.name);
  if (input === undefined) throw new Error(`spotter returned no sighting (stop_reason: ${message.stop_reason})`);
  return normalizeSpotter(input);
}
