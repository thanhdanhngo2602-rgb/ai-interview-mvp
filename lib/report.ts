import { QuestionScore } from "./interview-schema";

export function normalizeScore(scores: QuestionScore[]): number {
  if (!scores.length) return 0;
  const avg = scores.reduce((sum, item) => sum + item.total_score, 0) / scores.length;
  return Math.max(0, Math.min(100, Math.round(avg)));
}
