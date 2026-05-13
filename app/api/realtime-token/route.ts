import { NextRequest, NextResponse } from "next/server";
import { buildInterviewerPrompt } from "@/prompts/interviewer-prompt";
import { REALTIME_MODEL } from "@/lib/openai";
import { InterviewConfigSchema } from "@/lib/interview-schema";

export async function POST(req: NextRequest) {
  try {
    const { config } = await req.json();
    const parsedConfig = InterviewConfigSchema.parse(config);

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: REALTIME_MODEL,
          instructions: buildInterviewerPrompt(parsedConfig),
          audio: {
            output: { voice: "alloy" },
            input: { transcription: { model: "gpt-4o-mini-transcribe" } }
          }
        }
      })
    });

    if (!response.ok) {
      return NextResponse.json({ ok: false, error: await response.text() }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ ok: true, client_secret: data.value || data.client_secret?.value, raw: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Realtime token failed" },
      { status: 500 }
    );
  }
}
