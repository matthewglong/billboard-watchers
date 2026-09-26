import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getClient, imageBlock, MODELS, toolInput, type ImageInput } from "../anthropic";
import { normalizeExplainer } from "../normalize";
import type { ExplainerResult, SpotterResult } from "../types";
import { NARRATOR_VOICE } from "../voice";

const NAME_SPECIES: Anthropic.Tool = {
  name: "name_species",
  description:
    "File the naturalist's entry for this billboard: species name, field notes, and a plain-English translation of every piece of jargon. Call this exactly once.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["species_name", "field_notes", "jargon", "jargon_density", "jargon_density_note"],
    properties: {
      species_name: {
        type: "string",
        description:
          "A Latin-ish binomial, 'Genus species': genus capitalized, species lowercase, two words, e.g. 'Agentica overfundus'. Build it from the company's name and what the billboard displays. Playful but readable.",
      },
      field_notes: {
        type: "string",
        description:
          "2–3 short sentences, 60 words at most, in the narrator's voice, describing the billboard itself as an observed creature: what it displays (words, colors, imagery) and what it is trying to communicate. Use the visual. Every sentence must carry a true observation.",
      },
      jargon: {
        type: "array",
        description:
          "One entry per jargon term on the billboard. Start from the Spotter's jargon_terms, add any it missed, drop plain words. Empty if the billboard has no jargon.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["term", "plain_english", "joke"],
          properties: {
            term: { type: "string", description: "The term as written on the billboard." },
            plain_english: {
              type: "string",
              description:
                "1–2 short sentences, 40 words at most, that a 12-year-old would understand: what the term means in general, then what it most likely means on this billboard. No other jargon.",
            },
            joke: {
              type: "string",
              description: "One light line, 20 words at most, in the narrator's voice, that still teaches something true. Tease the jargon, never the company.",
            },
          },
        },
      },
      jargon_density: {
        type: "integer",
        enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        description:
          "How hard the billboard is for a layperson to decode. 0 = plain words a grandparent would understand; 10 = pure buzzword soup.",
      },
      jargon_density_note: {
        type: "string",
        description: "One quippy, affectionate line, 20 words at most, in the narrator's voice about the jargon density. Never suggest the company is misleading anyone.",
      },
    },
  },
};

const SYSTEM = `You are the Naturalist on Ad Hawk, a field expedition cataloguing the wild tech billboards of San Francisco. You receive the field photo and the Spotter's report. You name the species, write the field notes, and translate every piece of jargon so that a reader with no tech background walks away understanding it.

RULES
- Look at the photo yourself. Billboards often land their message through imagery, so explain the visual joke or metaphor when there is one.
- Stick to what the billboard shows, plus general knowledge of what words mean. A separate researcher is looking up facts about the company, so do not state facts about the company (funding, size, customers) that the billboard itself does not show.
- Definitions must be true and simple. Say what a term means in everyday words, then what it probably means on this billboard. Never define jargon with more jargon.
- Jokes are affectionate. Tease the jargon and the ritual of billboard-making, never the company or its people.
- Call name_species exactly once.

${NARRATOR_VOICE}`;

export async function runExplainer(
  image: ImageInput,
  spotter: SpotterResult,
  signal: AbortSignal,
): Promise<ExplainerResult> {
  const report = {
    billboard_text: spotter.billboard_text,
    company_name: spotter.company_name,
    visual_read: spotter.visual_read,
    jargon_terms: spotter.jargon_terms,
  };
  const message = await getClient().messages.create(
    {
      model: MODELS.explainer,
      max_tokens: 2500,
      temperature: 0.8,
      system: SYSTEM,
      tools: [NAME_SPECIES],
      tool_choice: { type: "tool", name: NAME_SPECIES.name },
      messages: [
        {
          role: "user",
          content: [
            imageBlock(image),
            {
              type: "text",
              text: `The Spotter's report:\n${JSON.stringify(report, null, 2)}\n\nName the species and translate its calls.`,
            },
          ],
        },
      ],
    },
    { signal },
  );
  const input = toolInput(message, NAME_SPECIES.name);
  if (input === undefined) throw new Error(`explainer returned no entry (stop_reason: ${message.stop_reason})`);
  return normalizeExplainer(input);
}
