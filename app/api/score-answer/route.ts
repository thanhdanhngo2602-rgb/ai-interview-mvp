import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, SCORING_MODEL } from "@/lib/openai";
import { buildScoringPrompt } from "@/prompts/scoring-prompt";
import { InterviewQuestionSchema } from "@/lib/interview-schema";

const scoringJsonSchema = {
  name: "interview_answer_score",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      core_coverage_score: {
        type: "number",
        description: "Điểm mức độ bao phủ expected core, thang 0-10.",
      },
      quality_score: {
        type: "number",
        description: "Điểm chất lượng câu trả lời, thang 0-10.",
      },
      bonus_score: {
        type: "number",
        description: "Điểm cộng vượt mong đợi, thang 0-2.",
      },
      penalty_score: {
        type: "number",
        description: "Điểm trừ nếu mơ hồ/lạc đề, thang 0-5.",
      },
      total_score: {
        type: "number",
        description: "Tổng điểm cuối cùng cho câu hỏi, thang 0-10.",
      },
      exceeded_expectation: {
        type: "boolean",
        description: "Ứng viên có trả lời vượt mong đợi hay không.",
      },
      criterion_breakdown: {
        type: "object",
        additionalProperties: false,
        properties: {
          domain_knowledge: { type: "number" },
          problem_solving: { type: "number" },
          communication: { type: "number" },
        },
        required: ["domain_knowledge", "problem_solving", "communication"],
      },
      strengths: {
        type: "array",
        items: { type: "string" },
      },
      weaknesses: {
        type: "array",
        items: { type: "string" },
      },
      explanation: {
        type: "string",
        description: "Giải thích ngắn gọn vì sao chấm điểm như vậy.",
      },
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
    },
    required: [
      "core_coverage_score",
      "quality_score",
      "bonus_score",
      "penalty_score",
      "total_score",
      "exceeded_expectation",
      "criterion_breakdown",
      "strengths",
      "weaknesses",
      "explanation",
      "confidence",
    ],
  },
  strict: true,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const question = InterviewQuestionSchema.parse(body.question);
    const answer = String(body.answer || "").trim();

    if (!answer) {
      return NextResponse.json(
        { ok: false, error: "Thiếu câu trả lời của ứng viên." },
        { status: 400 }
      );
    }

   const openai = getOpenAIClient();

const response = await openai.responses.create({
      model: SCORING_MODEL,
      input: buildScoringPrompt(question, answer),
      text: {
        format: {
          type: "json_schema",
          ...scoringJsonSchema,
        },
      },
    });

    const parsedScore = JSON.parse(response.output_text);

    return NextResponse.json({
      ok: true,
      score: parsedScore,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Score answer failed",
      },
      { status: 500 }
    );
  }
}
