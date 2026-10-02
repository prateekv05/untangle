/** Browser only. Turns a microphone stream into a 0 to 1 loudness reading about 15 times a second. Returns a stop function. */
export function watchLevel(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};
  let ctx: AudioContext;
  try { ctx = new Ctx(); } catch { return () => {}; }
  void ctx.resume().catch(() => {}); // iOS starts the context suspended
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
  }, 70);
  return () => { clearInterval(timer); void ctx.close().catch(() => {}); };
}

export const isDenied = (e: unknown): boolean => e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
