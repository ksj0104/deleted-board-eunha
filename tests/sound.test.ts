import test from "node:test";
import assert from "node:assert/strict";
import {
  createSoundPlayer,
  makeSoundSamples,
  SOUND_STORAGE_KEY,
  type SoundName,
} from "../lib/sound";

function audioHarness() {
  let now = 1000;
  let hidden = false;
  let contexts = 0;
  let bufferCount = 0;
  let resumeAudio: (() => void) | undefined;
  const storage = new Map<string, string>([
    ["eunha.deleted-board.progress.v1", "keep game progress"],
  ]);
  const sources: {
    started: boolean;
    stopped: boolean;
    buffer: unknown;
    onended: (() => void) | null;
    connect: () => void;
    disconnect: () => void;
    start: () => void;
    stop: () => void;
  }[] = [];
  const gains: number[] = [];
  const context = {
    state: "running" as AudioContextState,
    sampleRate: 22050,
    currentTime: 0,
    destination: {},
    createGain: () => ({
      gain: {
        setValueAtTime: (value: number) => {
          gains.push(value);
        },
        setTargetAtTime: (value: number) => {
          gains.push(value);
        },
        cancelScheduledValues: () => {},
      },
      connect: () => {},
      disconnect: () => {},
    }),
    createBuffer: (_channels: number, length: number) => {
      bufferCount++;
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
    createBufferSource: () => {
      const source = {
        started: false,
        stopped: false,
        buffer: null as unknown,
        onended: null as (() => void) | null,
        connect: () => {},
        disconnect: () => {},
        start: () => {
          source.started = true;
        },
        stop: () => {
          source.stopped = true;
          source.onended?.();
        },
      };
      sources.push(source);
      return source;
    },
    resume: () =>
      new Promise<void>((resolve) => {
        resumeAudio = () => {
          context.state = "running";
          resolve();
        };
      }),
    suspend: async () => {
      context.state = "suspended";
    },
    close: async () => {
      context.state = "closed";
    },
  };
  const player = createSoundPlayer({
    createContext: () => {
      contexts++;
      return context as unknown as AudioContext;
    },
    storage: () => ({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value);
      },
    }),
    hidden: () => hidden,
    now: () => now,
  });
  return {
    player,
    context,
    storage,
    sources,
    gains,
    contexts: () => contexts,
    buffers: () => bufferCount,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
    hide: (value: boolean) => {
      hidden = value;
    },
    resume: async () => {
      resumeAudio?.();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test("sound: all original effects are short, audible, bounded and faded without clipping", () => {
  const names: SoundName[] = [
    "open",
    "close",
    "select",
    "deselect",
    "collect",
    "release",
    "verify",
    "success",
    "retry",
    "notice",
  ];
  for (const name of names) {
    const wave = makeSoundSamples(name, 44100);
    assert.ok(wave.length >= 2000 && wave.length < 44100, name);
    assert.equal(Math.abs(wave[0]), 0);
    assert.equal(Math.abs(wave[wave.length - 1]), 0);
    assert.ok(wave.every(Number.isFinite), name);
    const peak = Math.max(...wave.map(Math.abs));
    const rms = Math.sqrt(
      wave.reduce((sum, value) => sum + value * value, 0) / wave.length,
    );
    assert.ok(peak > 0.03 && peak < 0.4, `${name}: peak ${peak}`);
    assert.ok(rms > 0.005 && rms < 0.12, `${name}: rms ${rms}`);
  }
});

test("sound: loading is silent, preferences persist separately and mute stops current effects", () => {
  const h = audioHarness();
  h.player.restore();
  h.player.play("open");
  assert.equal(
    h.contexts(),
    0,
    "no AudioContext or playback before user interaction",
  );
  h.player.unlock();
  h.player.play("open");
  assert.equal(h.contexts(), 1);
  assert.equal(h.sources.length, 1);
  h.player.setVolume(0.2);
  h.player.setEnabled(false);
  assert.ok(h.sources[0].stopped);
  h.advance(100);
  h.player.play("success");
  assert.equal(h.sources.length, 1);
  assert.deepEqual(JSON.parse(h.storage.get(SOUND_STORAGE_KEY)!), {
    enabled: false,
    volume: 0.2,
  });
  assert.equal(
    h.storage.get("eunha.deleted-board.progress.v1"),
    "keep game progress",
  );
  h.player.restore();
  assert.deepEqual(h.player.getSettings(), { enabled: false, volume: 0.2 });
  h.player.dispose();
  h.player.unlock();
  assert.equal(h.contexts(), 1);
  assert.equal(h.context.state, "closed");
});

test("sound: rapid inputs are throttled, buffers are reused and result sounds replace overlapping clicks", () => {
  const h = audioHarness();
  h.player.unlock();
  for (let i = 0; i < 20; i++) h.player.play("select");
  assert.equal(h.sources.length, 1);
  h.advance(60);
  h.player.play("select");
  assert.equal(h.buffers(), 1);
  h.advance(60);
  h.player.play("collect");
  assert.equal(h.sources.filter((source) => !source.stopped).length, 3);
  h.player.play("success");
  assert.equal(h.sources.filter((source) => !source.stopped).length, 1);
  h.hide(true);
  h.advance(100);
  h.player.play("retry");
  assert.equal(h.sources.length, 4);
  h.player.pause();
  assert.ok(h.sources.every((source) => source.stopped));
  h.player.dispose();
});

test("sound: pending browser resume cannot replay muted or stale actions later", async () => {
  for (const cancel of ["mute", "stale"] as const) {
    const h = audioHarness();
    h.context.state = "suspended";
    h.player.unlock();
    h.player.play("collect");
    if (cancel === "mute") h.player.setEnabled(false);
    else h.advance(250);
    await h.resume();
    assert.equal(h.sources.length, 0, cancel);
    h.player.dispose();
  }
  const unavailable = createSoundPlayer({
    createContext: () => {
      throw new Error("unsupported");
    },
    storage: () => {
      throw new Error("blocked");
    },
    hidden: () => false,
    now: () => 0,
  });
  assert.doesNotThrow(() => {
    unavailable.restore();
    unavailable.unlock();
    unavailable.play("open");
    unavailable.setVolume(0);
    unavailable.setEnabled(false);
    unavailable.dispose();
  });
});
