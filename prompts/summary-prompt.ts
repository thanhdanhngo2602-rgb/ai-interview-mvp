export function buildSummaryPrompt(payload: unknown) {
  return `
Bạn là HR evaluator. Hãy tạo summary cuối buổi phỏng vấn bằng tiếng Việt dựa trên dữ liệu scoring.

Yêu cầu:
- Tóm tắt ngắn gọn năng lực ứng viên.
- Nêu 3 điểm mạnh.
- Nêu 3 điểm cần làm rõ/cải thiện.
- Đề xuất next step: proceed / review / reject.
- Giải thích ngắn gọn.

Dữ liệu:
${JSON.stringify(payload, null, 2)}
`;
}
