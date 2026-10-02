/** Records with MediaRecorder and sends the audio to /api/transcribe on stop. No live text; works on iOS Safari. */
import { watchLevel, isDenied } from "./level";
import { audioFileName, pickMime } from "./text";
import { VoiceError, type Transcriber } from "./types";

export class ServerTranscriber implements Transcriber {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stopLevel: () => void = () => {};
  private startedAt = 0;

  static supported(): boolean {
    return typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  }

  async start(_onPartial: (text: string) => void, onLevel?: (level: number) => void): Promise<void> {
    if (!ServerTranscriber.supported()) throw new VoiceError("unsupported");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      throw new VoiceError(isDenied(e) ? "denied" : "unsupported");
    }
    const mime = pickMime((m) => MediaRecorder.isTypeSupported(m));
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start(1000);
    this.startedAt = Date.now();
    if (onLevel) this.stopLevel = watchLevel(this.stream, onLevel);
  }

  async stop(): Promise<string> {
    const recorder = this.recorder;
    if (!recorder) throw new VoiceError("failed");
    const type = recorder.mimeType || "audio/webm";
    await new Promise<void>((resolve) => { recorder.onstop = () => resolve(); if (recorder.state !== "inactive") recorder.stop(); else resolve(); });
    const seconds = Math.ceil((Date.now() - this.startedAt) / 1000);
    this.release();
    const blob = new Blob(this.chunks, { type });
    this.chunks = [];
    if (blob.size < 1200) throw new VoiceError("empty"); // under about a tenth of a second of audio
    const form = new FormData();
    form.append("audio", blob, audioFileName(type));
    form.append("seconds", String(seconds));
    let res: Response;
    try { res = await fetch("/api/transcribe", { method: "POST", body: form }); } catch { throw new VoiceError("failed"); }
    if (res.status === 401) { window.location.assign("/welcome"); throw new VoiceError("failed"); }
    if (res.status === 429) throw new VoiceError("daily_limit");
    if (!res.ok) throw new VoiceError("failed");
    const text = ((await res.json().catch(() => null)) as { text?: unknown } | null)?.text;
    if (typeof text !== "string" || !text.trim()) throw new VoiceError("empty");
    return text.trim();
  }

  cancel(): void {
    this.chunks = [];
    if (this.recorder) { this.recorder.onstop = null; this.recorder.ondataavailable = null; if (this.recorder.state !== "inactive") this.recorder.stop(); }
    this.release();
  }

  private release() {
    this.stopLevel();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}
