"use client";

import { useState } from "react";

type UploadState = "idle" | "uploading" | "validating" | "ready" | "error";

export default function HomePage() {
  const [config, setConfig] = useState<any>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setState("uploading");

    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch("/api/upload-config", { method: "POST", body: formData });
    const uploadData = await uploadRes.json();

    if (!uploadData.ok) {
      setError(uploadData.error || "Upload failed");
      setState("error");
      return;
    }

    setState("validating");

    const validateRes = await fetch("/api/validate-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: uploadData.config })
    });
    const validateData = await validateRes.json();

    if (!validateData.ok) {
      // Theo yêu cầu MVP: nếu AI validate lỗi, vẫn dùng config parse bằng code để không block flow.
      setConfig(uploadData.config);
    } else {
      setConfig(validateData.config);
    }

    setState("ready");
  }

  function startInterview() {
    sessionStorage.setItem("interview_config", JSON.stringify(config));
    window.location.href = "/interview";
  }

  return (
    <main>
      <h1>AI Interview MVP V1</h1>
      <p>Upload file Excel cấu hình phỏng vấn, hệ thống sẽ parse, AI validate và bắt đầu session.</p>

      <section className="card">
        <h2>1. Upload Excel</h2>
        <input type="file" accept=".xlsx,.xls" onChange={handleUpload} />
        {state === "uploading" && <p>Đang parse Excel...</p>}
        {state === "validating" && <p>Đang AI validate config...</p>}
        {state === "error" && <p className="error">{error}</p>}
      </section>

      {config && (
        <section className="card">
          <div className="row">
            <span className="badge">Ready</span>
            <strong>{config.job_title}</strong>
          </div>
          <p>Số câu hỏi: {config.questions.length}</p>
          <p>Ngôn ngữ: tiếng Việt</p>
          <button onClick={startInterview}>Start Interview</button>
        </section>
      )}

      {config && (
        <section className="card">
          <h2>Config đã parse</h2>
          <pre>{JSON.stringify(config, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
