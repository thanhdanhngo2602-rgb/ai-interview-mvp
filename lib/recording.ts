export type RecordingController = {
  start: (micStream: MediaStream, remoteStream?: MediaStream) => Promise<void>;
  stop: () => void;
  isRecording: () => boolean;
};

export function createRecordingController(params: {
  onRecordingReady: (url: string, blob: Blob) => void;
  onStatus?: (message: string) => void;
}) {
  let recorder: MediaRecorder | null = null;
  let audioContext: AudioContext | null = null;
  let chunks: Blob[] = [];
  let recording = false;

  async function start(micStream: MediaStream, remoteStream?: MediaStream) {
    if (recording) return;

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;

    audioContext = new AudioContextClass();
    const destination = audioContext.createMediaStreamDestination();

    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);

    if (remoteStream && remoteStream.getAudioTracks().length > 0) {
      const aiSource = audioContext.createMediaStreamSource(remoteStream);
      aiSource.connect(destination);
      params.onStatus?.("Recording mode: mic + AI audio");
    } else {
      params.onStatus?.("Recording mode: mic only");
    }

    chunks = [];

    recorder = new MediaRecorder(destination.stream);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      recording = false;

      const blob = new Blob(chunks, {
        type: "audio/webm",
      });

      const url = URL.createObjectURL(blob);
      params.onRecordingReady(url, blob);

      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }

      audioContext = null;
      recorder = null;
    };

    recorder.start(1000);
    recording = true;
  }

  function stop() {
    if (!recorder || recorder.state === "inactive") {
      recording = false;
      return;
    }

    recorder.requestData();
    recorder.stop();
  }

  function isRecording() {
    return recording;
  }

  return {
    start,
    stop,
    isRecording,
  };
}
