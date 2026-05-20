import OpenAI from "openai";

export const SCORING_MODEL = "gpt-4.1-mini";
export const REALTIME_MODEL = "gpt-realtime";
export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({
    apiKey,
  });
}
