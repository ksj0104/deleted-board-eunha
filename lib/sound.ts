export type SoundName =
  | "open"
  | "close"
  | "select"
  | "deselect"
  | "collect"
  | "release"
  | "verify"
  | "success"
  | "retry"
  | "notice";
export type SoundSettings = { enabled: boolean; volume: number };
export const SOUND_STORAGE_KEY = "eunha.deleted-board.sound.v1";
export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.35,
};
const durations: Record<SoundName, number> = {
  open: 0.18,
  close: 0.09,
  select: 0.055,
  deselect: 0.065,
  collect: 0.2,
  release: 0.13,
  verify: 0.24,
  success: 0.72,
  retry: 0.34,
  notice: 0.42,
};

// Original desk sounds, generated locally and cached without audio downloads.
export function makeSoundSamples(name: SoundName, sampleRate: number) {
  const samples = new Float32Array(Math.ceil(durations[name] * sampleRate));
  let seed = 73;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };
  const tone = (
    start: number,
    length: number,
    frequency: number,
    gain: number,
  ) => {
    for (let i = 0; i < Math.ceil(length * sampleRate); i++) {
      const index = Math.round(start * sampleRate) + i;
      if (index >= samples.length) break;
      const t = i / sampleRate;
      const envelope =
        Math.min(1, t / 0.006) *
        Math.exp((-t * 6) / length) *
        Math.min(1, (length - t) / 0.025);
      samples[index] +=
        gain *
        envelope *
        (Math.sin(2 * Math.PI * frequency * t) +
          0.12 * Math.sin(2 * Math.PI * frequency * 2 * t));
    }
  };
  const paper = (start: number, length: number, gain: number) => {
    let smooth = 0;
    for (let i = 0; i < Math.ceil(length * sampleRate); i++) {
      const index = Math.round(start * sampleRate) + i;
      if (index >= samples.length) break;
      smooth += 0.22 * (random() - smooth);
      const progress = i / (length * sampleRate);
      samples[index] += smooth * gain * Math.sin(Math.PI * progress) ** 2;
    }
  };
  const tap = (start: number, frequency: number, gain: number) => {
    tone(start, 0.075, frequency, gain);
    paper(start, 0.028, gain * 0.65);
  };
  switch (name) {
    case "open":
      paper(0, 0.17, 0.3);
      tap(0.025, 320, 0.12);
      break;
    case "close":
      tap(0, 220, 0.2);
      break;
    case "select":
      tap(0, 760, 0.17);
      break;
    case "deselect":
      tap(0, 490, 0.15);
      break;
    case "collect":
      tap(0, 180, 0.3);
      tap(0.05, 380, 0.13);
      tone(0.08, 0.12, 660, 0.08);
      break;
    case "release":
      paper(0, 0.12, 0.23);
      tap(0.015, 260, 0.13);
      break;
    case "verify":
      tap(0, 410, 0.13);
      tap(0.105, 490, 0.1);
      break;
    case "success":
      tone(0, 0.58, 440, 0.15);
      tone(0.08, 0.58, 554.37, 0.12);
      tone(0.16, 0.55, 659.25, 0.11);
      break;
    case "retry":
      tone(0, 0.22, 349.23, 0.15);
      tone(0.11, 0.22, 293.66, 0.12);
      break;
    case "notice":
      tone(0, 0.3, 659.25, 0.13);
      tone(0.1, 0.3, 880, 0.09);
      break;
  }
  const fade = Math.max(1, Math.round(sampleRate * 0.004));
  for (let i = 0; i < samples.length; i++)
    samples[i] *= Math.min(1, i / fade, (samples.length - 1 - i) / fade);
  return samples;
}

type SoundHost = {
  createContext: () => AudioContext | null;
  storage: () => Pick<Storage, "getItem" | "setItem">;
  hidden: () => boolean;
  now: () => number;
};
const browserHost: SoundHost = {
  createContext: () =>
    typeof window !== "undefined" && window.AudioContext
      ? new window.AudioContext({ latencyHint: "interactive" })
      : null,
  storage: () => window.localStorage,
  hidden: () =>
    typeof document !== "undefined" && document.visibilityState === "hidden",
  now: () => Date.now(),
};

export function createSoundPlayer(host: SoundHost = browserHost) {
  let settings = DEFAULT_SOUND_SETTINGS;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let resume: Promise<void> | null = null;
  let disposed = false;
  let lastSound = -Infinity;
  let intent = 0;
  let generation = 0;
  const listeners = new Set<() => void>();
  const buffers = new Map<SoundName, AudioBuffer>();
  const voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();
  const stop = () => {
    generation++;
    for (const voice of voices) {
      try {
        const now = context!.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setTargetAtTime(0, now, 0.004);
        voice.source.stop(now + 0.02);
      } catch {
        /* The voice may already have ended. */
      }
    }
    voices.clear();
  };
  const setSettings = (next: SoundSettings, persist: boolean) => {
    settings = next;
    if (!settings.enabled || settings.volume === 0) stop();
    try {
      master?.gain.setTargetAtTime(
        settings.enabled ? settings.volume : 0,
        context!.currentTime,
        0.01,
      );
    } catch {
      /* Sound cannot interrupt play. */
    }
    if (persist) {
      try {
        host.storage().setItem(SOUND_STORAGE_KEY, JSON.stringify(settings));
      } catch {
        /* Controls still work for this visit if storage is unavailable. */
      }
    }
    for (const listener of listeners) listener();
  };
  const restore = () => {
    disposed = false;
    let next = DEFAULT_SOUND_SETTINGS;
    try {
      const saved = JSON.parse(
        host.storage().getItem(SOUND_STORAGE_KEY) ?? "null",
      );
      if (
        saved &&
        typeof saved.enabled === "boolean" &&
        typeof saved.volume === "number" &&
        Number.isFinite(saved.volume)
      )
        next = {
          enabled: saved.enabled,
          volume: Math.max(0, Math.min(1, saved.volume)),
        };
    } catch {
      /* Sound preferences are separate from the game save. */
    }
    setSettings(next, false);
  };
  const unlock = () => {
    if (disposed || !settings.enabled || settings.volume === 0 || host.hidden())
      return;
    try {
      if (!context || context.state === "closed") {
        context = host.createContext();
        if (!context) return;
        buffers.clear();
        master = context.createGain();
        master.gain.setValueAtTime(settings.volume, context.currentTime);
        master.connect(context.destination);
      }
      if (context.state !== "running" && !resume)
        resume = context
          .resume()
          .catch(() => {})
          .finally(() => {
            resume = null;
          });
    } catch {
      /* Unsupported or blocked audio is a silent fallback. */
    }
  };
  const play = (name: SoundName) => {
    intent++;
    if (
      disposed ||
      !settings.enabled ||
      settings.volume === 0 ||
      host.hidden() ||
      !context
    )
      return;
    const requested = host.now();
    const currentGeneration = generation;
    const render = () => {
      if (
        disposed ||
        currentGeneration !== generation ||
        !settings.enabled ||
        settings.volume === 0 ||
        host.hidden() ||
        context?.state !== "running" ||
        !master ||
        host.now() - requested > 180
      )
        return;
      const result = name === "success" || name === "retry";
      if (!result && host.now() - lastSound < 55) return;
      if (result || voices.size >= 3) stop();
      lastSound = host.now();
      try {
        let buffer = buffers.get(name);
        if (!buffer) {
          const samples = makeSoundSamples(name, context.sampleRate);
          buffer = context.createBuffer(1, samples.length, context.sampleRate);
          buffer.getChannelData(0).set(samples);
          buffers.set(name, buffer);
        }
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(master);
        const voice = { source, gain };
        voices.add(voice);
        source.onended = () => {
          voices.delete(voice);
          source.disconnect();
          gain.disconnect();
        };
        source.start();
      } catch {
        /* Playback failures must not fail game actions. */
      }
    };
    if (context.state === "running") render();
    else if (resume) void resume.then(render);
  };
  return {
    play,
    unlock,
    restore,
    stop,
    getIntent: () => intent,
    getSettings: () => settings,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEnabled: (enabled: boolean) =>
      setSettings({ ...settings, enabled }, true),
    setVolume: (volume: number) => {
      if (Number.isFinite(volume))
        setSettings(
          { ...settings, volume: Math.max(0, Math.min(1, volume)) },
          true,
        );
    },
    pause: () => {
      stop();
      if (context?.state === "running") void context.suspend().catch(() => {});
    },
    dispose: () => {
      stop();
      disposed = true;
      if (context && context.state !== "closed")
        void context.close().catch(() => {});
      context = null;
      master = null;
      buffers.clear();
    },
  };
}
export type SoundPlayer = ReturnType<typeof createSoundPlayer>;
