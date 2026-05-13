import { NextRequest, NextResponse } from "next/server";
import { parseInterviewExcel } from "@/lib/excel-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Thiếu file Excel." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const config = await parseInterviewExcel(buffer);

    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Upload config failed" },
      { status: 500 }
    );
  }
}
