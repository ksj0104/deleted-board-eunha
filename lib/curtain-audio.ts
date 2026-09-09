// Original, deterministic microphone-check sounds. The waveform and audio use
// the very same PCM, so the player can solve the comparison without hearing it.
export type Take = "a" | "b" | "c" | "recording";
export const AUDIO_RATE = 12000;
export function curtainSamples(take: Take): Float32Array {
  const base = take === "recording" ? "b" : take;
  const out = new Float32Array(AUDIO_RATE * (take === "recording" ? 6 : 4));
  const delay = take === "recording" ? 1.2 : 0;
  const taps =
    base === "a"
      ? [0.4, 0.95, 2.5]
      : base === "b"
        ? [0.4, 1.1, 2.05]
        : [0.3, 1.6, 2.05];
  let seed = 321;
  for (let i = 0; i < AUDIO_RATE * 4; i++) {
    const t = i / AUDIO_RATE;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    let sample = 0;
    for (let n = 0; n < taps.length; n++) {
      const dt = t - taps[n];
      if (dt >= 0 && dt < 0.22)
        sample +=
          (Math.sin(dt * 2 * Math.PI * (170 + n * 31)) * 0.55 + noise * 0.22) *
          Math.exp(-dt * 24) *
          Math.min(1, dt / 0.003);
    }
    if (t > 2.8 && t < 3.55)
      sample +=
        noise * Math.sin(((t - 2.8) / 0.75) * Math.PI) ** 2 * 0.14 +
        Math.sin(2 * Math.PI * (t * 155 + t * t * 12)) *
          0.055 *
          Math.sin(((t - 2.8) / 0.75) * Math.PI);
    out[i + Math.round(delay * AUDIO_RATE)] = sample;
  }
  return out;
}
export function waveform(take: Take, bars = 180): number[] {
  const samples = curtainSamples(take);
  const window = Math.round((AUDIO_RATE * 6) / bars);
  return Array.from({ length: bars }, (_, n) => {
    let max = 0;
    for (
      let i = n * window;
      i < Math.min(samples.length, (n + 1) * window);
      i++
    )
      max = Math.max(max, Math.abs(samples[i]));
    return max;
  });
}
