import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is missing. API routes that call OpenAI will fail until it is set.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const SCORING_MODEL = process.env.OPENAI_SCORING_MODEL || "gpt-4.1-mini";
export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";
