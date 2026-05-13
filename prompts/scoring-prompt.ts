import { InterviewQuestion } from "@/lib/interview-schema";

export function buildScoringPrompt(question: InterviewQuestion, answer: string) {
  return `
Bạn là AI Evaluator cho hệ thống AI Interview tiếng Việt.

Nhiệm vụ:
Chấm điểm câu trả lời của ứng viên dựa trên câu hỏi, expected core, expected bonus và tiêu chí đánh giá.

Thang điểm:
- total_score: 0 đến 100
- core_coverage_score: 0 đến 60
- quality_score: 0 đến 25
- bonus_score: 0 đến 15
- penalty_score: 0 đến 30

Cách đánh giá:
1. Core coverage: ứng viên cover bao nhiêu ý chính trong expected_core.
2. Quality: câu trả lời có logic, rõ ràng, có cấu trúc, có ví dụ không.
3. Bonus: ứng viên có ý vượt mong đợi trong expected_bonus hoặc insight tốt hơn không.
4. Penalty: trừ điểm nếu mơ hồ, lạc đề, né tránh, hoặc không đủ thông tin.

Câu hỏi:
${question.question_text}

Expected core:
${question.expected_core.map((x) => `- ${x}`).join("\n") || "- Không có, hãy suy luận dựa trên câu hỏi."}

Expected bonus:
${question.expected_bonus.map((x) => `- ${x}`).join("\n") || "- Không có."}

Criteria weights:
${JSON.stringify(question.criteria_weights, null, 2)}

Câu trả lời của ứng viên:
${answer}

Yêu cầu output:
- Trả về JSON đúng schema.
- Không thêm markdown.
- Explanation phải ngắn gọn nhưng đủ rõ để HR hiểu vì sao được điểm đó.
`;
}
