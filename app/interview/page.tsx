"use client";

import { useEffect, useRef, useState } from "react";

export default function InterviewPage() {
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState("Chưa bắt đầu");
  const [events, setEvents] = useState<string[]>([]);
  const [manualAnswer, setManualAnswer] = useState("");
  const [score, setScore] = useState<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("interview_config");
    if (raw) setConfig(JSON.parse(raw));
  }, []);

  function log(message: string) {
    setEvents((prev) => [`${new Date().toLocaleTimeString()} - ${message}`, ...prev].slice(0, 30));
  }

  async function startRealtimeSession() {
    if (!config) return;

    setStatus("Đang tạo realtime token...");
    const tokenRes = await fetch("/api/realtime-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config })
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.ok || !tokenData.client_secret) {
      setStatus("Không tạo được token");
      log(JSON.stringify(tokenData));
      return;
    }

    setStatus("Đang mở microphone...");
    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    
const audioEl = document.createElement("audio");
audioEl.autoplay = true;
audioEl.controls = true;

document.body.appendChild(audioEl);
   pc.ontrack = async (event) => {
  audioEl.srcObject = event.streams[0];

  try {
    await audioEl.play();
  } catch (err) {
    console.error("Audio play failed:", err);
  }
};

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const dc = pc.createDataChannel("oai-events");
    dc.onopen = () => log("Data channel opened");
    dc.onmessage = (event) => log(event.data);

    setStatus("Đang kết nối WebRTC...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const realtimeModel = process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL || "gpt-realtime";
const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${tokenData.client_secret}`,
    "Content-Type": "application/sdp"
  },
  body: offer.sdp || ""
});

    if (!sdpRes.ok) {
      setStatus("Kết nối WebRTC thất bại");
      log(await sdpRes.text());
      return;
    }

    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    setStatus("Đang phỏng vấn realtime");
    log("Realtime voice session started");
  }

  function stopRealtimeSession() {
    pcRef.current?.close();
    pcRef.current = null;
    setStatus("Đã dừng");
  }

  async function scoreFirstQuestionManual() {
    if (!config || !manualAnswer.trim()) return;
    const firstQuestion = config.questions[0];
    const res = await fetch("/api/score-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: firstQuestion, answer: manualAnswer })
    });
    const data = await res.json();
    setScore(data);
  }

  if (!config) return <main>Không tìm thấy interview config. Hãy quay lại trang upload.</main>;

  return (
    <main>
      <h1>Interview: {config.job_title}</h1>
      <p><strong>Trạng thái:</strong> {status}</p>
      <audio ref={audioRef} autoPlay />

      <section className="card">
        <h2>Voice Interview</h2>
        <p>Bấm Start để mở microphone và kết nối OpenAI Realtime qua WebRTC.</p>
        <div className="row">
          <button onClick={startRealtimeSession}>Start Voice Session</button>
          <button className="secondary" onClick={stopRealtimeSession}>Stop</button>
        </div>
      </section>

      <section className="card">
        <h2>Manual scoring test</h2>
        <p>Dùng để test scoring API nhanh với câu hỏi đầu tiên trong file Excel.</p>
        <p><strong>Câu 1:</strong> {config.questions[0]?.question_text}</p>
        <textarea rows={5} value={manualAnswer} onChange={(e) => setManualAnswer(e.target.value)} placeholder="Dán câu trả lời ứng viên tại đây..." />
        <br /><br />
        <button onClick={scoreFirstQuestionManual}>Score câu 1</button>
        {score && <pre>{JSON.stringify(score, null, 2)}</pre>}
      </section>

      <section className="card">
        <h2>Realtime events</h2>
        <pre>{events.join("\n\n")}</pre>
      </section>
    </main>
  );
}
