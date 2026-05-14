"use client";

import { useEffect, useRef, useState } from "react";

type InterviewState =
  | "IDLE"
  | "CONNECTING"
  | "READY"
  | "AI_SPEAKING"
  | "WAITING_FOR_ANSWER"
  | "CANDIDATE_SPEAKING"
  | "PROCESSING_ANSWER"
  | "FINISHED"
  | "ERROR";

type TranscriptItem = {
  role: "assistant" | "candidate";
  text: string;
  timestamp: string;
  question_no?: number;
};

type QuestionAnswer = {
  question_no: number;
  question_text: string;
  answer: string;
  ended_at?: string;
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

const CONNECT_STEPS = [
  "Tạo phiên bảo mật",
  "Mở microphone",
  "Kết nối WebRTC",
  "Chuẩn bị âm thanh",
  "Sẵn sàng phỏng vấn",
];

export default function InterviewPage() {
  const [config, setConfig] = useState<any>(null);
  const [state, setState] = useState<InterviewState>("IDLE");
  const [status, setStatus] = useState("Chưa bắt đầu");
  const [connectStep, setConnectStep] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const [candidateText, setCandidateText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswerBuffer, setCurrentAnswerBuffer] = useState("");
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
  const answerBufferRef = useRef("");
  const currentQuestionIndexRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedRef = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("interview_config");
    if (raw) setConfig(JSON.parse(raw));

    return () => {
      cleanupRealtimeSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function log(message: string) {
    setEvents((prev) => [`${new Date().toLocaleTimeString()} - ${message}`, ...prev].slice(0, 120));
  }

  function updateStep(step: number, nextStatus: string) {
    setConnectStep(step);
    setStatus(nextStatus);
  }

  function addTranscript(role: "assistant" | "candidate", text: string, questionNo?: number) {
    const cleanText = text.trim();
    if (!cleanText) return;

    setTranscript((prev) => [
      ...prev,
      { role, text: cleanText, timestamp: new Date().toISOString(), question_no: questionNo },
    ]);
  }

  function cleanupRealtimeSession() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }

    recorderRef.current = null;
    recordingStartedRef.current = false;

    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current = null;

    if (audioRef.current) audioRef.current.srcObject = null;

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
  }

  async function startMixedRecording(micStream: MediaStream, remoteStream: MediaStream) {
    try {
      if (recordingStartedRef.current) return;

      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
        setRecordingUrl(null);
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const destination = audioContext.createMediaStreamDestination();
      audioContext.createMediaStreamSource(micStream).connect(destination);
      audioContext.createMediaStreamSource(remoteStream).connect(destination);

      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(destination.stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
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
      recordingStartedRef.current = true;
      log("Đã bắt đầu ghi âm phiên phỏng vấn.");
    } catch (err) {
      log(`Không thể bắt đầu ghi âm: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function sendRealtimeEvent(payload: any) {
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") {
      log("Data channel chưa sẵn sàng.");
      return;
    }
    dc.send(JSON.stringify(payload));
  }

  function requestFirstQuestion() {
    sendRealtimeEvent({
      type: "response.create",
      response: {
        instructions:
          "Hãy bắt đầu buổi phỏng vấn. Chào ứng viên thật ngắn gọn, sau đó hỏi câu hỏi đầu tiên trong danh sách. Không hỏi nhiều câu cùng lúc.",
      },
    });
  }

  function requestConfirmAndNextQuestion() {
    const questionCount = config?.questions?.length || 0;
    const currentIndex = currentQuestionIndexRef.current;

    if (currentIndex >= questionCount - 1) {
      sendRealtimeEvent({
        type: "response.create",
        response: {
          instructions:
            "Hãy nói: Cảm ơn bạn, mình đã ghi nhận câu trả lời. Buổi phỏng vấn đến đây là kết thúc. Cảm ơn bạn đã tham gia.",
        },
      });
      setState("FINISHED");
      setStatus("Phỏng vấn đã hoàn tất. Bạn có thể tạo báo cáo.");
      return;
    }

    currentQuestionIndexRef.current = currentIndex + 1;
    setCurrentQuestionIndex(currentIndex + 1);
    answerBufferRef.current = "";
    setCurrentAnswerBuffer("");

    sendRealtimeEvent({
      type: "response.create",
      response: {
        instructions:
          "Hãy xác nhận ngắn gọn: Cảm ơn bạn, mình đã ghi nhận câu trả lời. Sau đó chuyển sang câu hỏi tiếp theo trong danh sách. Chỉ hỏi một câu.",
      },
    });
  }

  function finalizeCurrentAnswer() {
    const answer = answerBufferRef.current.trim();
    const q = config?.questions?.[currentQuestionIndexRef.current];
    if (!q) return;

    if (!answer) {
      setStatus("Chưa ghi nhận được câu trả lời. AI sẽ tiếp tục chờ ứng viên.");
      setState("WAITING_FOR_ANSWER");
      return;
    }

    const qa: QuestionAnswer = {
      question_no: q.question_no || currentQuestionIndexRef.current + 1,
      question_text: q.question_text,
      answer,
      ended_at: new Date().toISOString(),
    };

    setQuestionAnswers((prev) => {
      const withoutCurrent = prev.filter((item) => item.question_no !== qa.question_no);
      return [...withoutCurrent, qa].sort((a, b) => a.question_no - b.question_no);
    });

    setState("PROCESSING_ANSWER");
    setStatus("Đã ghi nhận câu trả lời. AI đang chuyển sang câu tiếp theo...");
    requestConfirmAndNextQuestion();
  }

  function scheduleAnswerFinalize() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => finalizeCurrentAnswer(), 2500);
  }

  async function startRealtimeSession() {
    if (!config) return;

    cleanupRealtimeSession();
    setFinalReport(null);
    setQuestionAnswers([]);
    setTranscript([]);
    setCandidateText("");
    setCurrentQuestionIndex(0);
    currentQuestionIndexRef.current = 0;
    answerBufferRef.current = "";
    setCurrentAnswerBuffer("");
    setState("CONNECTING");
    updateStep(1, "🔐 Đang tạo phiên bảo mật với AI Interviewer...");

    try {
      const tokenRes = await fetch("/api/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenData.ok || !tokenData.client_secret) {
        setState("ERROR");
        setStatus("Không tạo được token");
        log(JSON.stringify(tokenData));
        return;
      }

      updateStep(2, "🎤 Đang xin quyền microphone...");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;

      pc.ontrack = async (event) => {
        updateStep(4, "🔊 Đang chuẩn bị âm thanh từ AI Interviewer...");

        const [remoteTrack] = event.streams[0]?.getAudioTracks() || [];
        if (remoteTrack) remoteStream.addTrack(remoteTrack);

        if (!audioRef.current) return;
        audioRef.current.srcObject = remoteStream;

        try {
          await audioRef.current.play();
          updateStep(5, "✅ AI Interviewer đã sẵn sàng.");
          setState("READY");
        } catch {
          setState("ERROR");
          setStatus("⚠️ Trình duyệt chưa cho tự động phát audio. Hãy bấm Play trên audio player.");
        }
      };

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      micStreamRef.current = micStream;
      micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

      updateStep(3, "🔗 Đang kết nối AI Interviewer qua WebRTC...");

      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        log("Data channel opened");
        setStatus("🤖 AI đang chuẩn bị câu hỏi đầu tiên...");
        requestFirstQuestion();
      };

      dc.onmessage = async (event) => {
        log(event.data);

        try {
          const parsed = JSON.parse(event.data);

          if (parsed.type === "response.created") {
            setState("AI_SPEAKING");
            setStatus("🗣️ AI đang chuẩn bị nói...");
          }

          if (parsed.type === "response.output_audio.delta") {
            setState("AI_SPEAKING");
            setStatus("🗣️ AI đang nói...");

            if (
              micStreamRef.current &&
              remoteStreamRef.current &&
              remoteStreamRef.current.getAudioTracks().length &&
              !recordingStartedRef.current
            ) {
              await startMixedRecording(micStreamRef.current, remoteStreamRef.current);
            }
          }

          if (parsed.type === "response.output_audio.done") {
            setState("WAITING_FOR_ANSWER");
            setStatus("🎧 AI đang lắng nghe câu trả lời của bạn...");
          }

          if (parsed.type === "input_audio_buffer.speech_started") {
            setState("CANDIDATE_SPEAKING");
            setStatus("🎙️ Đã phát hiện ứng viên đang nói...");

            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          }

          if (parsed.type === "input_audio_buffer.speech_stopped") {
            setState("PROCESSING_ANSWER");
            setStatus("⏳ Đang chờ ứng viên kết thúc câu trả lời...");
            scheduleAnswerFinalize();
          }

          if (parsed.type === "response.output_audio_transcript.done" && parsed.transcript) {
            addTranscript(
              "assistant",
              parsed.transcript,
              config?.questions?.[currentQuestionIndexRef.current]?.question_no
            );
          }

          if (
            parsed.type === "conversation.item.input_audio_transcription.completed" &&
            parsed.transcript
          ) {
            const qNo = config?.questions?.[currentQuestionIndexRef.current]?.question_no;
            const cleanText = parsed.transcript.trim();

            answerBufferRef.current = `${answerBufferRef.current} ${cleanText}`.trim();
            setCurrentAnswerBuffer(answerBufferRef.current);
            addTranscript("candidate", cleanText, qNo);
          }
        } catch {
          // keep raw log only
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setStatus("🌐 Đang trao đổi tín hiệu với OpenAI Realtime...");

      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.client_secret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp || "",
      });

      if (!sdpRes.ok) {
        setState("ERROR");
        setStatus("Kết nối WebRTC thất bại");
        log(await sdpRes.text());
        cleanupRealtimeSession();
        return;
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStatus("⏳ Đang chờ AI Interviewer phát âm thanh đầu tiên...");
      log("Realtime voice session started");
    } catch (err) {
      setState("ERROR");
      setStatus(`Lỗi kết nối: ${err instanceof Error ? err.message : String(err)}`);
      cleanupRealtimeSession();
    }
  }

  function stopRealtimeSession() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
    recorderRef.current = null;

    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    setState("FINISHED");
    setStatus("Đã dừng phỏng vấn. Bạn có thể tạo báo cáo.");
    log("Realtime voice session stopped");
  }

  function getAnswersForScoring(): string[] {
    const answersByQuestion = config.questions.map((q: any, index: number) => {
      const qNo = q.question_no || index + 1;
      return questionAnswers.find((item) => item.question_no === qNo)?.answer || "";
    });

    if (answersByQuestion.some(Boolean)) return answersByQuestion;

    const fallbackAnswers = candidateText
      .split(/\n\s*\n|---|Câu\s+\d+:/i)
      .map((x) => x.trim())
      .filter(Boolean);

    return config.questions.map((_: any, index: number) => fallbackAnswers[index] || "");
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

    const answers = getAnswersForScoring();
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

  function downloadDebugLogs() {
    const debugPayload = {
      state,
      status,
      currentQuestionIndex,
      currentAnswerBuffer,
      questionAnswers,
      transcript,
      events,
    };

    const blob = new Blob([JSON.stringify(debugPayload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-interview-debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!config) return <main>Không tìm thấy interview config. Hãy quay lại trang upload.</main>;

  const progressPercent = Math.round((connectStep / CONNECT_STEPS.length) * 100);
  const currentQuestion = config.questions?.[currentQuestionIndex];

  return (
    <main>
      <h1>Interview: {config.job_title || "Unknown Job"}</h1>

      <section className="card">
        <h2>Trạng thái hệ thống</h2>

        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: state === "CONNECTING" ? "#fff7ed" : "#f8fafc",
            border: state === "CONNECTING" ? "1px solid #fdba74" : "1px solid #e2e8f0",
            fontWeight: 600,
          }}
        >
          {status}
        </div>

        {state === "CONNECTING" && (
          <div style={{ marginTop: "14px" }}>
            <div
              style={{
                width: "100%",
                height: "10px",
                background: "#e2e8f0",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  background: "#f97316",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <p style={{ marginTop: "8px", color: "#64748b" }}>
              Đang thực hiện bước {connectStep}/{CONNECT_STEPS.length}:{" "}
              {CONNECT_STEPS[Math.max(connectStep - 1, 0)]}
            </p>
          </div>
        )}

        <p style={{ marginTop: "12px", color: "#64748b" }}>
          Khuyến nghị phòng họp: đặt micro gần ứng viên, giảm âm lượng loa ở mức vừa đủ, tránh để
          loa hướng trực tiếp vào micro để hạn chế echo.
        </p>
      </section>

      <audio ref={audioRef} autoPlay controls />

      <section className="card">
        <h2>Voice Interview</h2>

        {currentQuestion && (
          <p>
            <strong>Câu hiện tại:</strong> Câu {currentQuestion.question_no || currentQuestionIndex + 1}:{" "}
            {currentQuestion.question_text}
          </p>
        )}

        <div className="row">
          <button onClick={startRealtimeSession} disabled={state === "CONNECTING"}>
            {state === "CONNECTING" ? "Đang kết nối..." : "Start Voice Session"}
          </button>
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
        <h2>Câu trả lời đã ghi nhận</h2>
        {questionAnswers.length ? (
          questionAnswers.map((item) => (
            <div key={item.question_no} className="card">
              <strong>Câu {item.question_no}:</strong> {item.question_text}
              <p style={{ whiteSpace: "pre-wrap" }}>{item.answer}</p>
            </div>
          ))
        ) : (
          <p>Chưa ghi nhận câu trả lời nào.</p>
        )}

        {currentAnswerBuffer && (
          <div className="card">
            <strong>Đang ghi nhận câu hiện tại:</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{currentAnswerBuffer}</p>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Kết thúc phỏng vấn & tạo báo cáo</h2>
        <p>
          Khi kết thúc phỏng vấn, hệ thống sẽ chấm toàn bộ câu hỏi trong file Excel và tạo báo cáo
          cuối cùng.
        </p>

        <p>
          <strong>Fallback MVP:</strong> nếu phần ghi nhận tự động chưa đúng, anh/chị có thể dán
          câu trả lời theo thứ tự câu hỏi vào ô bên dưới. Mỗi câu cách nhau bằng một dòng trống.
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
              <h4>Câu {item.question_no}</h4>

              <p>
                <strong>Câu hỏi:</strong> {item.question_text}
              </p>

              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  margin: "12px 0",
                }}
              >
                <strong>Câu trả lời của ứng viên:</strong>
                <p style={{ whiteSpace: "pre-wrap", marginTop: "8px" }}>
                  {item.answer || "Chưa ghi nhận được câu trả lời."}
                </p>
              </div>

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
                    <strong>Đánh giá AI:</strong> {item.score.explanation}
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
        <h2>Debug logs</h2>
        <p>Log kỹ thuật được ẩn khỏi màn hình. Chỉ tải xuống khi cần kiểm tra lỗi.</p>
        <button onClick={downloadDebugLogs}>Tải logs kỹ thuật</button>
      </section>
    </main>
  );
}
