import type { Page } from "@playwright/test";

/** Chromium opens a fake microphone (a steady beep) instead of asking, so getUserMedia and MediaRecorder run for real. */
export const FAKE_MIC = { permissions: ["microphone" as const], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } };

/** A SpeechRecognition that "hears" these phrases, one every 400 ms, after start(). */
export async function fakeSpeech(page: Page, phrases: string[]) {
  await page.addInitScript((words) => {
    class Fake {
      continuous = false; interimResults = false; lang = "";
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
      private on = false;
      start() {
        this.on = true;
        words.forEach((w, i) => setTimeout(() => { if (this.on) this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: `${w} ` } }] }); }, 400 * (i + 1)));
      }
      stop() { this.on = false; setTimeout(() => this.onend?.(), 20); }
      abort() { this.on = false; }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = Fake;
  }, phrases);
}

/** No Web Speech at all, as on Firefox and iOS Safari: the recorder and /api/transcribe do the work. */
export async function noSpeech(page: Page) {
  await page.addInitScript(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });
}

export async function blockMic(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("blocked", "NotAllowedError"));
  });
}
