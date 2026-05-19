"use client";

import { useEffect, useRef, useState } from "react";
import { createRecordingController } from "@/lib/recording";
import { InterviewStateMachine, type InterviewState } from "@/lib/interview-state";
import { DebugLogger } from "@/lib/debug-log";
type TranscriptItem = {
  role: "assistant" | "candidate";
  text: string;
  timestamp: string;
};

type QuestionReport = {
  question_no: number;
  question_text: string;
  answer: string;
  score?: any;
  error?: string;
};

type FinalReport = {
  job_title: string;
  total_score: number;
  recommendation: "Pass" | "Consider" | "Reject";
  question_reports: QuestionReport[];
  strengths: string[];
  weaknesses: string[];
  summary: string;
};

export default function InterviewPage() {
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState("Chưa bắt đầu");
  const [events, setEvents] = useState<string[]>([]);
  const [candidateText, setCandidateText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("interview_config");
    if (raw) setConfig(JSON.parse(raw));

    return () => {
      cleanupRealtimeSession();
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function log(message: string) {
    setEvents((prev) => [`${new Date().toLocaleTimeString()} - ${message}`, ...prev].slice(0, 40));
  }

  function addTranscript(role: "assistant" | "candidate", text: string) {
    const cleanText = text.trim();
    if (!cleanText) return;

    setTranscript((prev) => [
      ...prev,
      {
        role,
        text: cleanText,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  function cleanupRealtimeSession() {
    try {
      recorderRef.current?.stop();
    } catch {
      // Recorder may already be inactive.
    }
    recorderRef.current = null;

    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current = null;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
  }

  async function startMixedRecording(micStream: MediaStream, remoteStream: MediaStream) {
    try {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
        setRecordingUrl(null);
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const destination = audioContext.createMediaStreamDestination();

      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(destination);

      const aiSource = audioContext.createMediaStreamSource(remoteStream);
      aiSource.connect(destination);

      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(destination.stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (!recordedChunksRef.current.length) return;

        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        log("Đã tạo file ghi âm. Có thể tải xuống.");
      };

      recorder.start();
      recorderRef.current = recorder;
      log("Đã bắt đầu ghi âm phiên phỏng vấn.");
    } catch (err) {
      console.error("Recording failed:", err);
      log(`Không thể bắt đầu ghi âm: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function startRealtimeSession() {
    if (!config) return;

    cleanupRealtimeSession();
    setFinalReport(null);
    setStatus("Đang tạo realtime token...");

    const tokenRes = await fetch("/api/realtime-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
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

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    pc.ontrack = async (event) => {
      const [remoteTrack] = event.streams[0]?.getAudioTracks() || [];
      if (remoteTrack) {
        remoteStream.addTrack(remoteTrack);
      }

      if (!audioRef.current) return;
      audioRef.current.srcObject = remoteStream;

      try {
        await audioRef.current.play();
      } catch (err) {
        console.error("Audio play failed:", err);
        log("Trình duyệt chưa cho tự động phát audio. Hãy bấm Play trên audio player.");
      }

      if (micStreamRef.current && remoteStream.getAudioTracks().length && !recorderRef.current) {
        await startMixedRecording(micStreamRef.current, remoteStream);
      }
    };

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = micStream;
    micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

    const dc = pc.createDataChannel("oai-events");
    dataChannelRef.current = dc;

    dc.onopen = () => {
      log("Data channel opened");
    };

    dc.onmessage = (event) => {
      log(event.data);

      try {
        const parsed = JSON.parse(event.data);

        if (parsed.type === "response.output_audio_transcript.done" && parsed.transcript) {
          addTranscript("assistant", parsed.transcript);
        }

        if (
          parsed.type === "conversation.item.input_audio_transcription.completed" &&
          parsed.transcript
        ) {
          addTranscript("candidate", parsed.transcript);
        }
      } catch {
        // Keep raw event in the debug log only.
      }
    };

    setStatus("Đang kết nối WebRTC...");

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.client_secret}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp || "",
    });

    if (!sdpRes.ok) {
      setStatus("Kết nối WebRTC thất bại");
      log(await sdpRes.text());
      cleanupRealtimeSession();
      return;
    }

    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    setStatus("Đang phỏng vấn realtime");
    log("Realtime voice session started");
  }

  function stopRealtimeSession() {
    try {
      recorderRef.current?.stop();
    } catch {
      // Recorder may already be inactive.
    }
    recorderRef.current = null;

    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    setStatus("Đã dừng phỏng vấn");
    log("Realtime voice session stopped");
  }

  function splitCandidateAnswers(): string[] {
    const candidateTranscript = transcript
      .filter((item) => item.role === "candidate")
      .map((item) => item.text);

    if (candidateTranscript.length >= config.questions.length) {
      return config.questions.map((_: any, index: number) => candidateTranscript[index] || "");
    }

    const fallbackAnswers = candidateText
      .split(/\n\s*\n|---|Câu\s+\d+:/i)
      .map((x) => x.trim())
      .filter(Boolean);

    return config.questions.map((_: any, index: number) => {
      return candidateTranscript[index] || fallbackAnswers[index] || "";
    });
  }

  function buildRecommendation(totalScore: number): "Pass" | "Consider" | "Reject" {
    if (totalScore >= 75) return "Pass";
    if (totalScore >= 55) return "Consider";
    return "Reject";
  }

  async function generateFinalReport() {
    if (!config?.questions?.length) return;

    setIsGeneratingReport(true);
    setFinalReport(null);
    setStatus("Đang tạo báo cáo đánh giá...");

    const answers = splitCandidateAnswers();
    const questionReports: QuestionReport[] = [];

    for (let i = 0; i < config.questions.length; i++) {
      const question = config.questions[i];
      const answer = answers[i] || "Ứng viên chưa có câu trả lời được ghi nhận cho câu hỏi này.";

      try {
        const res = await fetch("/api/score-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, answer }),
        });

        const data = await res.json();

        questionReports.push({
          question_no: question.question_no || i + 1,
          question_text: question.question_text,
          answer,
          score: data.ok ? data.score : undefined,
          error: data.ok ? undefined : data.error,
        });
      } catch (err) {
        questionReports.push({
          question_no: question.question_no || i + 1,
          question_text: question.question_text,
          answer,
          error: err instanceof Error ? err.message : "Không chấm được câu trả lời.",
        });
      }
    }

    const weightedTotal = questionReports.reduce((sum, item, index) => {
      const questionWeight = Number(config.questions[index]?.question_weight || 0);
      const rawScore = Number(item.score?.total_score || 0);
      return sum + rawScore * questionWeight;
    }, 0);

    const totalWeight = config.questions.reduce((sum: number, question: any) => {
      return sum + Number(question.question_weight || 0);
    }, 0);

    const totalScore = totalWeight > 0 ? Math.round((weightedTotal / totalWeight) * 10) / 10 : 0;

    const strengths = Array.from(
      new Set(questionReports.flatMap((item) => item.score?.strengths || []))
    ).slice(0, 6);

    const weaknesses = Array.from(
      new Set(questionReports.flatMap((item) => item.score?.weaknesses || []))
    ).slice(0, 6);

    const report: FinalReport = {
      job_title: config.job_title,
      total_score: totalScore,
      recommendation: buildRecommendation(totalScore),
      question_reports: questionReports,
      strengths,
      weaknesses,
      summary:
        totalScore >= 75
          ? "Ứng viên thể hiện mức phù hợp tốt với yêu cầu vị trí."
          : totalScore >= 55
            ? "Ứng viên có một số điểm phù hợp nhưng cần được phỏng vấn hoặc kiểm chứng thêm."
            : "Ứng viên chưa thể hiện đủ mức phù hợp theo bộ câu hỏi hiện tại.",
    };

    setFinalReport(report);
    setIsGeneratingReport(false);
    setStatus("Đã tạo báo cáo đánh giá");
  }

  function downloadReport() {
    if (!finalReport) return;

    const blob = new Blob([JSON.stringify(finalReport, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-interview-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!config) return <main>Không tìm thấy interview config. Hãy quay lại trang upload.</main>;

  return (
    <main>
      <h1>Interview: {config.job_title || "Unknown Job"}</h1>
      <p>
        <strong>Trạng thái:</strong> {status}
      </p>

      <audio ref={audioRef} autoPlay controls />

      <section className="card">
        <h2>Voice Interview</h2>
        <p>Bấm Start để mở microphone và kết nối OpenAI Realtime qua WebRTC.</p>

        <div className="row">
          <button onClick={startRealtimeSession}>Start Voice Session</button>
          <button className="secondary" onClick={stopRealtimeSession}>
            Stop
          </button>
        </div>

        {recordingUrl && (
          <p>
            <a href={recordingUrl} download={`ai-interview-recording-${Date.now()}.webm`}>
              Tải file ghi âm buổi phỏng vấn
            </a>
          </p>
        )}
      </section>

      <section className="card">
        <h2>Kết thúc phỏng vấn & tạo báo cáo</h2>
        <p>
          Khi kết thúc phỏng vấn, hệ thống sẽ chấm toàn bộ câu hỏi trong file Excel và tạo báo
          cáo cuối cùng.
        </p>

        <p>
          <strong>Lưu ý MVP:</strong> nếu transcript từ realtime chưa tách đúng theo từng câu,
          anh/chị có thể dán câu trả lời theo thứ tự câu hỏi vào ô bên dưới. Mỗi câu cách nhau
          bằng một dòng trống.
        </p>

        <textarea
          rows={8}
          value={candidateText}
          onChange={(e) => setCandidateText(e.target.value)}
          placeholder={"Tùy chọn: dán câu trả lời ứng viên theo thứ tự câu hỏi.\nMỗi câu cách nhau bằng một dòng trống."}
        />

        <br />
        <br />

        <button onClick={generateFinalReport} disabled={isGeneratingReport}>
          {isGeneratingReport ? "Đang tạo báo cáo..." : "Kết thúc phỏng vấn & tạo báo cáo"}
        </button>
      </section>

      {finalReport && (
        <section className="card">
          <h2>AI Interview Report</h2>

          <p>
            <strong>Vị trí:</strong> {finalReport.job_title}
          </p>
          <p>
            <strong>Tổng điểm:</strong> {finalReport.total_score}/100
          </p>
          <p>
            <strong>Khuyến nghị:</strong> {finalReport.recommendation}
          </p>
          <p>
            <strong>Tóm tắt:</strong> {finalReport.summary}
          </p>

          <h3>Điểm mạnh</h3>
          <ul>
            {finalReport.strengths.length ? (
              finalReport.strengths.map((item, index) => <li key={index}>{item}</li>)
            ) : (
              <li>Chưa có điểm mạnh nổi bật được ghi nhận.</li>
            )}
          </ul>

          <h3>Điểm cần cải thiện</h3>
          <ul>
            {finalReport.weaknesses.length ? (
              finalReport.weaknesses.map((item, index) => <li key={index}>{item}</li>)
            ) : (
              <li>Chưa có điểm yếu nổi bật được ghi nhận.</li>
            )}
          </ul>

          <h3>Chi tiết từng câu hỏi</h3>
          {finalReport.question_reports.map((item) => (
            <div key={item.question_no} className="card">
              <p>
                <strong>Câu {item.question_no}:</strong> {item.question_text}
              </p>
              <p>
                <strong>Câu trả lời:</strong> {item.answer}
              </p>
              {item.score ? (
                <>
                  <p>
                    <strong>Điểm:</strong> {item.score.total_score}/10
                  </p>
                  <p>
                    <strong>Vượt mong đợi:</strong>{" "}
                    {item.score.exceeded_expectation ? "Có" : "Không"}
                  </p>
                  <p>
                    <strong>Giải thích:</strong> {item.score.explanation}
                  </p>
                </>
              ) : (
                <p>
                  <strong>Lỗi scoring:</strong> {item.error}
                </p>
              )}
            </div>
          ))}

          <button onClick={downloadReport}>Tải báo cáo JSON</button>
        </section>
      )}

      <section className="card">
        <h2>Transcript tạm thời</h2>
        {transcript.length ? (
          <pre>{transcript.map((item) => `${item.role}: ${item.text}`).join("\n\n")}</pre>
        ) : (
          <p>Chưa có transcript được ghi nhận từ realtime events.</p>
        )}
      </section>

      <section className="card">
        <h2>Realtime events</h2>
        <pre>{events.join("\n\n")}</pre>
      </section>
    </main>
  );
}
