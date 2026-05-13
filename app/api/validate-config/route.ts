import { NextRequest, NextResponse } from "next/server";
import { openai, SCORING_MODEL } from "@/lib/openai";
import { InterviewConfigSchema } from "@/lib/interview-schema";
import { buildConfigValidationPrompt } from "@/prompts/config-validation-prompt";

const configJsonSchema = {
  name: "interview_config",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      job_title: { type: "string" },
      job_description: { type: "string" },
      language: { type: "string", enum: ["vi"] },
      interviewer_style: { type: "string", enum: ["semi_formal"] },
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            question_no: { type: "number" },
            question_text: { type: "string" },
            expected_core: { type: "array", items: { type: "string" } },
            expected_bonus: { type: "array", items: { type: "string" } },
            criteria_weights: { type: "object", additionalProperties: { type: "number" } },
            question_weight: { type: "number" },
            probe_question_optional: { type: "string" },
            must_have_keywords_optional: { type: "array", items: { type: "string" } },
            disqualifier_optional: { type: "string" },
            notes_optional: { type: "string" },
            is_ai_inferred: { type: "boolean" }
          },
          required: [
            "question_no",
            "question_text",
            "expected_core",
            "expected_bonus",
            "criteria_weights",
            "question_weight",
            "probe_question_optional",
            "must_have_keywords_optional",
            "disqualifier_optional",
            "notes_optional",
            "is_ai_inferred"
          ]
        }
      }
    },
    required: ["job_title", "job_description", "language", "interviewer_style", "questions"]
  },
  strict: true
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = InterviewConfigSchema.parse(body.config);

    const response = await openai.responses.create({
      model: SCORING_MODEL,
      input: buildConfigValidationPrompt(config),
      text: { format: { type: "json_schema", ...configJsonSchema } }
    });

    const validatedConfig = InterviewConfigSchema.parse(JSON.parse(response.output_text));

    return NextResponse.json({ ok: true, config: validatedConfig });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Validate config failed" },
      { status: 500 }
    );
  }
}
