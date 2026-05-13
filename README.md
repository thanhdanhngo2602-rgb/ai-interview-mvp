# AI Interview MVP V1

Standalone MVP cho hệ thống AI Interview tiếng Việt.

## Chức năng hiện có

- Upload Excel cấu hình phỏng vấn
- Parse Excel bằng code
- AI validate/enrich cấu hình nếu thiếu expected answer hoặc criteria
- Start voice interview qua OpenAI Realtime API/WebRTC
- Manual scoring test cho câu hỏi đầu tiên
- Scoring API trả JSON structured output

## Kiến trúc

```text
Next.js App
  app/page.tsx                     Upload Excel + validate config
  app/interview/page.tsx            Voice session + manual scoring test
  app/api/upload-config             Parse Excel
  app/api/validate-config           AI validate/enrich config
  app/api/realtime-token            Tạo ephemeral token cho Realtime API
  app/api/score-answer              Chấm điểm câu trả lời
  lib/excel-parser.ts               Excel -> JSON
  lib/interview-schema.ts           Zod schema
  prompts/*                         Prompt templates
```

OpenAI Realtime API hỗ trợ kết nối low-latency qua WebRTC/WebSocket/SIP và speech-to-speech. Browser nên dùng ephemeral client secret thay vì dùng API key thật ở client.

## Yêu cầu môi trường

- Node.js 20+
- npm
- OpenAI API key
- Tài khoản Vercel nếu muốn deploy public

## Cài đặt local

### 1. Giải nén ZIP

```bash
unzip ai-interview-mvp-v1.zip
cd ai-interview-mvp-v1
```

### 2. Cài package

```bash
npm install
```

### 3. Tạo file `.env.local`

Copy từ `.env.example`:

```bash
cp .env.example .env.local
```

Sau đó sửa `.env.local`:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_SCORING_MODEL=gpt-4.1-mini
OPENAI_REALTIME_MODEL=gpt-realtime
NEXT_PUBLIC_OPENAI_REALTIME_MODEL=gpt-realtime
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Supabase đang để optional trong V1. Có thể bỏ trống nếu chưa lưu DB.

### 4. Chạy local

```bash
npm run dev
```

Mở:

```text
http://localhost:3000
```

## Cách dùng MVP

### Bước 1. Chuẩn bị Excel

Dùng file mẫu trong:

```text
samples/ai_interview_excel_template_v1.xlsx
```

Sheet chính: `Interview_Config`

Các cột cần có:

| Cột | Ý nghĩa |
|---|---|
| job_title | Tên vị trí |
| job_description | JD |
| question_no | Số thứ tự câu hỏi |
| question_text | Nội dung câu hỏi |
| expected_core | Ý chính bắt buộc, ngăn cách bằng `|` |
| expected_bonus | Ý vượt mong đợi, ngăn cách bằng `|` |
| criteria_weights | Ví dụ `domain_knowledge:0.4|problem_solving:0.4|communication:0.2` |
| question_weight | Trọng số câu hỏi |
| probe_question_optional | Câu hỏi đào sâu nếu trả lời quá ngắn |
| must_have_keywords_optional | Keyword bắt buộc, ngăn cách bằng `|` |
| disqualifier_optional | Red flag |
| notes_optional | Ghi chú |

### Bước 2. Upload file Excel

Vào trang chủ, upload Excel. App sẽ:

1. Parse Excel bằng code
2. Gọi AI validate/enrich config
3. Hiển thị JSON config
4. Cho phép Start Interview

### Bước 3. Start Voice Session

Tại trang `/interview`, bấm `Start Voice Session`.

Trình duyệt sẽ hỏi quyền microphone. Sau khi cấp quyền, app sẽ kết nối WebRTC tới OpenAI Realtime API.

### Bước 4. Test scoring thủ công

Trong trang interview có block `Manual scoring test`.

Dán một câu trả lời ứng viên vào ô text, bấm `Score câu 1` để test scoring API.

## Deploy lên Vercel từ GitHub

### 1. Push source lên GitHub

```bash
git init
git add .
git commit -m "Initial AI Interview MVP V1"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

### 2. Import vào Vercel

- Vào Vercel
- New Project
- Import GitHub repo
- Framework: Next.js
- Add Environment Variables giống `.env.local`
- Deploy

### 3. Lưu ý bảo mật

Không commit `.env.local` lên GitHub.

API key OpenAI chỉ được đặt trong Vercel Environment Variables hoặc `.env.local` khi chạy local.

## Những phần chưa hoàn thiện trong V1

V1 đã có khung chạy được để demo, nhưng chưa phải production-ready.

Cần làm tiếp:

1. Lưu transcript theo từng câu vào Supabase
2. Tự động gọi scoring sau mỗi câu thay vì manual scoring
3. Tạo trang report đầy đủ
4. Thêm consent screen trước khi interview
5. Thêm cơ chế xác định câu hiện tại trong Realtime session
6. Thêm retry/error handling tốt hơn cho WebRTC
7. Thêm role HR/Hiring Manager

## Troubleshooting

### Lỗi không tạo được realtime token

Kiểm tra:

- `OPENAI_API_KEY` đúng chưa
- API key có quyền dùng Realtime API không
- Model trong `OPENAI_REALTIME_MODEL` có đúng không

### Lỗi upload Excel

Kiểm tra:

- File là `.xlsx` hoặc `.xls`
- Có sheet `Interview_Config`
- Có cột `question_text`

### Lỗi validate config

Nếu AI validate lỗi, app vẫn dùng config parse bằng code để không block flow MVP.

### Lỗi WebRTC trên browser

Kiểm tra:

- Browser đã cấp quyền microphone
- Trang đang chạy trên `localhost` hoặc HTTPS
- Không dùng HTTP public domain vì browser thường chặn microphone

## Next step khuyến nghị

Sau khi chạy được MVP này, bước tiếp theo là V2:

- Bắt transcript từ Realtime events
- Map transcript vào từng câu hỏi
- Auto-score từng câu
- Sinh report cuối buổi
- Lưu toàn bộ vào Supabase
