/** Speech to text behind one interface (docs/VOICE.md). Audio never leaves the device except through ServerTranscriber. */
export interface Transcriber {
  /** Start listening. onPartial gets live text where the engine has any; level (0 to 1) drives the waveform. */
  start(onPartial: (text: string) => void, onLevel?: (level: number) => void): Promise<void>;
  /** Stop and resolve with the final transcript. */
  stop(): Promise<string>;
  /** Stop and throw everything away. */
  cancel(): void;
}

export type VoiceErrorCode = "denied" | "unsupported" | "empty" | "failed" | "daily_limit";

export class VoiceError extends Error {
  constructor(public readonly code: VoiceErrorCode) {
    super(`voice ${code}`);
    this.name = "VoiceError";
  }
}
