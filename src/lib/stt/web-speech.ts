/** The browser's own recognizer: free, live text. Chrome, Edge and Android Chrome (Safari goes through ServerTranscriber). */
import { watchLevel, isDenied } from "./level";
import { VoiceError, type Transcriber } from "./types";

type Result = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type Ctor = new () => Recognition;
const ctor = (): Ctor | undefined => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

/** Safari's implementation is unreliable (docs/VOICE.md), so it is left to the server path even though it exists. */
export const isSafari = (ua: string): boolean => /iPad|iPhone|iPod/.test(ua) || (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|Android/.test(ua));

/** Engines differ on leading and trailing spaces between phrases. */
const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

export class WebSpeechTranscriber implements Transcriber {
  private rec: Recognition | null = null;
  private stream: MediaStream | null = null;
  private stopLevel: () => void = () => {};
  private finals = "";
  private interim = "";
  private ending = false;
  private failure: VoiceError | null = null;
  private ended: (() => void) | null = null;

  static supported(): boolean {
    return !!ctor() && !isSafari(navigator.userAgent);
  }

  async start(onPartial: (text: string) => void, onLevel?: (level: number) => void): Promise<void> {
    const Rec = ctor();
    if (!Rec) throw new VoiceError("unsupported");
    // Opening the stream first surfaces a blocked microphone straight away and feeds the waveform.
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      throw new VoiceError(isDenied(e) ? "denied" : "unsupported");
    }
    if (onLevel) this.stopLevel = watchLevel(this.stream, onLevel);
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.finals += `${r[0].transcript} `; else interim += r[0].transcript;
      }
      this.interim = interim;
      onPartial(tidy(`${this.finals}${interim}`));
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      this.failure = new VoiceError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : "failed");
    };
    // Chrome ends a session after a pause. Keep going until the user stops.
    rec.onend = () => {
      if (!this.ending && !this.failure) { try { rec.start(); return; } catch { /* fall through to ended */ } }
      this.ended?.();
    };
    this.rec = rec;
    rec.start();
  }

  async stop(): Promise<string> {
    const rec = this.rec;
    if (!rec) throw new VoiceError("failed");
    this.ending = true;
    await new Promise<void>((resolve) => { this.ended = resolve; rec.stop(); setTimeout(resolve, 1500); });
    const text = tidy(`${this.finals}${this.interim}`);
    this.release();
    if (this.failure && !text) throw this.failure;
    if (!text) throw new VoiceError("empty");
    return text;
  }

  cancel(): void {
    this.ending = true;
    if (this.rec) { this.rec.onresult = null; this.rec.onend = null; this.rec.onerror = null; this.rec.abort(); }
    this.release();
  }

  private release() {
    this.stopLevel();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.rec = null;
  }
}
