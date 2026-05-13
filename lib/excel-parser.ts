import * as XLSX from "xlsx";
import { DEFAULT_CRITERIA_WEIGHTS, InterviewConfig, InterviewConfigSchema } from "./interview-schema";

function cell(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? "").trim();
}

function splitPipe(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseCriteriaWeights(value: unknown): Record<string, number> {
  if (!value) return DEFAULT_CRITERIA_WEIGHTS;

  const result: Record<string, number> = {};
  String(value)
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((item) => {
      const [key, raw] = item.split(":");
      const parsed = Number(raw);
      if (key && Number.isFinite(parsed)) result[key.trim()] = parsed;
    });

  return Object.keys(result).length ? result : DEFAULT_CRITERIA_WEIGHTS;
}

export async function parseInterviewExcel(fileBuffer: Buffer): Promise<InterviewConfig> {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheet = workbook.Sheets["Interview_Config"] || workbook.Sheets["Sample_Data"] || workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) throw new Error("Không tìm thấy sheet hợp lệ trong file Excel.");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rows.length) throw new Error("File Excel không có dữ liệu.");

  const firstDataRow = rows.find((r) => cell(r, "question_text")) || rows[0];

  const config: InterviewConfig = {
    job_title: cell(firstDataRow, "job_title") || "Vị trí chưa đặt tên",
    job_description: cell(firstDataRow, "job_description") || "JD chưa được cung cấp đầy đủ.",
    language: "vi",
    interviewer_style: "semi_formal",
    questions: rows
      .filter((row) => cell(row, "question_text"))
      .map((row, index) => ({
        question_no: Number(cell(row, "question_no")) || index + 1,
        question_text: cell(row, "question_text"),
        expected_core: splitPipe(row.expected_core),
        expected_bonus: splitPipe(row.expected_bonus),
        criteria_weights: parseCriteriaWeights(row.criteria_weights),
        question_weight: Number(cell(row, "question_weight")) || 10,
        probe_question_optional: cell(row, "probe_question_optional") || undefined,
        must_have_keywords_optional: splitPipe(row.must_have_keywords_optional),
        disqualifier_optional: cell(row, "disqualifier_optional") || undefined,
        notes_optional: cell(row, "notes_optional") || undefined,
        is_ai_inferred: false,
      })),
  };

  return InterviewConfigSchema.parse(config);
}
