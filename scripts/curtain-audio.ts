import { mkdir, writeFile } from "node:fs/promises";
import { AUDIO_RATE, curtainSamples, type Take } from "../lib/curtain-audio";

await mkdir("public/curtain", { recursive: true });
for (const take of ["a", "b", "c", "recording"] as Take[]) {
  const samples = curtainSamples(take);
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(AUDIO_RATE, 24);
  wav.writeUInt32LE(AUDIO_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) =>
    wav.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, v)) * 32767),
      44 + i * 2,
    ),
  );
  await writeFile(`public/curtain/${take}.wav`, wav);
}
console.log(
  "Wrote four original microphone-check WAV files from the waveform PCM.",
);
