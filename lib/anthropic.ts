import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// The API key is read from ANTHROPIC_API_KEY (.env.local locally, project env
// vars on Vercel). This module is server-only, so the key never ships to the
// browser.

export const MODELS = {
  spotter: "claude-haiku-4-5-20251001",
  explainer: "claude-haiku-4-5-20251001",
  researcher: "claude-sonnet-5",
} as const;

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  // One retry for transient 429/5xx; each agent's own timeout caps the total.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  return client;
}

export interface ImageInput {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export function imageBlock(image: ImageInput): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: { type: "base64", media_type: image.mediaType, data: image.base64 },
  };
}

/** The input of the first tool_use block with this name, or undefined. */
export function toolInput(message: Anthropic.Message, name: string): unknown {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === name) return block.input;
  }
  return undefined;
}
