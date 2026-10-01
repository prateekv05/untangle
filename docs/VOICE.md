# Voice

Voice is the hero input. The experience: tap the mic, talk naturally, watch your words appear and tasks pop out as chips, tap Done.

## Why not only the browser's speech API

The Web Speech API (`SpeechRecognition`) works in Chrome and Edge and Android Chrome, is unreliable in iOS Safari, and is missing in Firefox. Many demo viewers are on iPhones. So build both behind one interface and pick at runtime.

```ts
// src/lib/stt/types.ts
export interface Transcriber {
  /** Start listening. onPartial gets live text; resolves with the final transcript on stop(). */
  start(onPartial: (text: string) => void): Promise<void>;
  stop(): Promise<string>;
  cancel(): void;
}
```

| Implementation | When | Notes |
| --- | --- | --- |
| `WebSpeechTranscriber` | feature-detected (`window.SpeechRecognition ?? window.webkitSpeechRecognition`) | free, instant live text. Use `continuous = true`, `interimResults = true`. |
| `ServerTranscriber` | fallback, and the one to ship for iOS | `MediaRecorder` records audio (prefer `audio/webm;codecs=opus`, fall back to `audio/mp4` on Safari) → `POST /api/transcribe` → text. No live text; show the waveform and "Listening…" and send chunks every ~5 s for pseudo-live text if desired. |

Server provider is **OpenAI Whisper** (`STT_PROVIDER=openai`, model from `STT_MODEL`, default `whisper-1`; confirm the current transcription model name in OpenAI's docs). Uses `OPENAI_API_KEY`. Anthropic's API does not provide speech-to-text. Wrap it in `src/lib/stt/server.ts` with one function `transcribe(audio: Blob): Promise<string>` so another provider can be added later. Whisper's upload limit (25 MB) is far above our 5 MB cap. Pass the user's language hint only if we add a language setting; otherwise let Whisper detect it.

## Live extraction while talking (the demo moment)

While the user speaks (partial text available), debounce ~1.2 s and call a cheap, fast extraction of the partial transcript to show "Heard so far" chips (title + location dot only). This is a UI nicety, not the source of truth: the real `understand` call runs once on Done with the full transcript. If it costs too much or lags, simulate with a lightweight client-side split on commas and "and" for chip display only.

Date chip: if the transcript contains "tomorrow" or a weekday, show "Planning for tomorrow, Friday". The authoritative `planFor` still comes from `understand`.

## UI states (see `design/screens/02-listening.html`)

| State | UI |
| --- | --- |
| idle | mic button 68 px on the dump box |
| permission needed | sheet: "Untangle needs your microphone to hear you." Buttons: "Allow microphone", "Type instead" |
| permission denied | inline: "Microphone is blocked. You can still type." Mic button disabled with `aria-label` explaining |
| listening | waveform (reduced-motion: static bars), live transcript, timer, heard-so-far chips, Done talking button |
| processing | think screen: "Reading your list" with 3 steps |
| error / empty | "I didn't catch anything. Try again, or type it." No raw errors |

## Re-plan by voice

Same component on the re-plan sheet: mic fills the text box with the transcript, the user can edit it, then taps Re-plan my day. Do not auto-submit.

## Cleaning the transcript

The `understand` prompt handles filler words ("um", "okay so", "like"), self-corrections ("buy milk, no wait, oat milk") and spoken times ("at two" = 14:00 for an afternoon meeting, "at five" = 17:00). Keep the original transcript in `days.raw_dump`.

## Privacy

Do not store audio. Delete the blob after transcription. State this once in settings: "Your voice is turned into text and then discarded."
