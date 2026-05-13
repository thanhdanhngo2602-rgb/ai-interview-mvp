import { z } from "zod";

export const DEFAULT_CRITERIA_WEIGHTS = {
  domain_knowledge: 0.4,
  problem_solving: 0.4,
  communication: 0.2,
};

export const InterviewQuestionSchema = z.object({
  question_no: z.number().int().positive(),
  question_text: z.string().min(1),
  expected_core: z.array(z.string()).default([]),
  expected_bonus: z.array(z.string()).default([]),
  criteria_weights: z.record(z.string(), z.number()).default(DEFAULT_CRITERIA_WEIGHTS),
  question_weight: z.number().positive().default(10),
  probe_question_optional: z.string().optional(),
  must_have_keywords_optional: z.array(z.string()).default([]),
  disqualifier_optional: z.string().optional(),
  notes_optional: z.string().optional(),
  is_ai_inferred: z.boolean().default(false),
});

export const InterviewConfigSchema = z.object({
  job_title: z.string().min(1),
  job_description: z.string().min(1),
  language: z.literal("vi").default("vi"),
  interviewer_style: z.literal("semi_formal").default("semi_formal"),
  questions: z.array(InterviewQuestionSchema).min(1),
});

export type InterviewConfig = z.infer<typeof InterviewConfigSchema>;
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;

export type QuestionScore = {
  core_coverage_score: number;
  quality_score: number;
  bonus_score: number;
  penalty_score: number;
  total_score: number;
  exceeded_expectation: boolean;
  criterion_breakdown: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
  confidence: "low" | "medium" | "high";
};
