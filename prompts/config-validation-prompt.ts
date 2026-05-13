import { InterviewConfig } from "@/lib/interview-schema";

export function buildConfigValidationPrompt(config: InterviewConfig) {
  return `
Bạn là chuyên gia HR Interview Design.

Hãy kiểm tra cấu hình interview bên dưới. Nếu thiếu expected_core, expected_bonus hoặc criteria_weights thì tự bổ sung dựa trên JD và câu hỏi. Không thay đổi ý nghĩa câu hỏi gốc.

Quy tắc:
- Giữ nguyên job_title và job_description nếu đã có.
- Giữ nguyên question_text nếu không có lỗi rõ ràng.
- Nếu expected_core rỗng, hãy tạo 3 đến 5 ý chính.
- Nếu expected_bonus rỗng, hãy tạo 2 đến 3 ý vượt mong đợi.
- Nếu criteria_weights thiếu, dùng domain_knowledge:0.4, problem_solving:0.4, communication:0.2.
- Đánh dấu is_ai_inferred=true cho câu nào có dữ liệu được AI bổ sung.
- Trả về JSON đúng schema, không markdown.

Config hiện tại:
${JSON.stringify(config, null, 2)}
`;
}
