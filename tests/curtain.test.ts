import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AUDIO_RATE, curtainSamples } from "../lib/curtain-audio";
import {
  CURTAIN_SAVE_KEY,
  initialCurtainState,
  curtainReducer,
  loadCurtain,
  saveCurtain,
  decodeCurtainSave,
  chapterDone,
  canRoute,
} from "../lib/curtain-game";
import { LOCAL_SAVE_KEY } from "../lib/local-game-client";
import { curtainThrough } from "./curtain-walkthrough";

test("Curtain: all five chapters lead to both endings, with independent saves", () => {
  const state = curtainThrough(5);
  for (const chapter of [1, 2, 3, 4, 5] as const)
    assert.equal(chapterDone(state, chapter), true);
  assert.equal(state.findings.length, 7);
  assert.equal(decodeCurtainSave(JSON.stringify(state)).solved, true);
  let ending = curtainReducer(state, { type: "ending", value: "names" });
  assert.equal(ending.ending, "names");
  ending = curtainReducer(ending, { type: "ending", value: "voices" });
  assert.equal(ending.ending, "voices");
  ending = curtainReducer(ending, { type: "ending", value: null });
  assert.equal(ending.solved, true);
  const data = new Map([[LOCAL_SAVE_KEY, "board progress"]]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  assert.equal(saveCurtain(storage, ending), "");
  assert.deepEqual(loadCurtain(storage).state, ending);
  assert.equal(data.get(LOCAL_SAVE_KEY), "board progress");
  assert.notEqual(CURTAIN_SAVE_KEY, LOCAL_SAVE_KEY);
});

test("Curtain: visible prerequisites protect the final reveal and chapter progression", () => {
  const state = initialCurtainState();
  assert.equal(
    curtainReducer(state, { type: "chapter", chapter: 5 }).chapter,
    1,
  );
  assert.equal(
    curtainReducer(
      { ...state, accused: "seokyung" },
      { type: "check", puzzle: "final" },
    ).solved,
    false,
  );
  assert.equal(
    curtainReducer(state, { type: "ending", value: "names" }).ending,
    null,
  );
  assert.equal(curtainReducer(state, { type: "observe" }).observed.length, 0);
  const withSight = curtainThrough(1);
  assert.equal(
    curtainReducer(
      { ...withSight, chair: 52 },
      { type: "check", puzzle: "shadow" },
    ).findings.includes("shadow"),
    false,
    "must inspect under work lights before reconstructing",
  );
  for (const person of ["doyun", "yuri", "eunju"] as const)
    assert.equal(
      curtainReducer(
        { ...curtainThrough(4), accused: person },
        { type: "check", puzzle: "final" },
      ).solved,
      false,
    );
});

test("Curtain: wrong waveform, broken route, unmatched fracture and wrong archive stay incomplete", () => {
  const second = curtainThrough(1);
  assert.equal(
    curtainReducer(
      { ...second, take: "a", offset: 1200 },
      { type: "check", puzzle: "audio" },
    ).findings.includes("audio"),
    false,
  );
  assert.equal(
    curtainReducer(
      { ...second, take: "b", offset: 1600 },
      { type: "check", puzzle: "audio" },
    ).findings.includes("audio"),
    false,
  );
  const third = { ...curtainThrough(2), route: ["room", "rear"] };
  assert.equal(canRoute(third, "chair"), false);
  assert.equal(
    curtainReducer(third, { type: "route", node: "chair" }).route.length,
    2,
  );
  const exposedRoute = {
    ...third,
    panel: 78,
    route: ["room", "rear", "chair", "front", "wing"],
  };
  assert.equal(
    curtainReducer(exposedRoute, {
      type: "check",
      puzzle: "route",
    }).findings.includes("route"),
    false,
  );
  assert.equal(
    curtainReducer(
      { ...third, clasp: "yuri", fragment: { x: 50, y: 50, angle: 0 } },
      { type: "check", puzzle: "clasp" },
    ).claspFit,
    false,
  );
  assert.equal(
    curtainReducer(
      { ...third, clasp: "seokyung", fragment: { x: 50, y: 50, angle: 45 } },
      { type: "check", puzzle: "clasp" },
    ).claspFit,
    false,
  );
  const fitOnly = curtainReducer(
    { ...third, clasp: "seokyung", fragment: { x: 50, y: 50, angle: 0 } },
    { type: "check", puzzle: "clasp" },
  );
  assert.equal(fitOnly.claspFit, true);
  assert.equal(
    fitOnly.findings.includes("contact"),
    false,
    "must compare costume before and after",
  );
  const fourth = { ...curtainThrough(3), sketchFit: true, drawer: "stairs" };
  assert.equal(
    curtainReducer(fourth, { type: "peel", value: 100 }).findings.includes(
      "author",
    ),
    false,
  );
});

test("Curtain: movement tolerances support touch and keyboard, and backtracking cannot corrupt a save", () => {
  const state = {
    ...curtainThrough(2),
    clasp: "seokyung" as const,
    fragment: { x: 47, y: 53, angle: 0 },
  };
  assert.equal(
    curtainReducer(state, { type: "check", puzzle: "clasp" }).claspFit,
    true,
  );
  let route: ReturnType<typeof initialCurtainState> = { ...state, panel: 78 };
  for (let i = 0; i < 80; i++)
    route = curtainReducer(route, {
      type: "route",
      node: i % 2 === 0 ? "rear" : "room",
    });
  assert.deepEqual(route.route, ["room"]);
  assert.doesNotThrow(() => decodeCurtainSave(JSON.stringify(route)));
});

test("Curtain: invalid and inaccessible storage stays intact; a failed write is retryable", () => {
  let value = "{ broken existing save";
  const storage = {
    getItem: () => value,
    setItem: (_: string, next: string) => {
      value = next;
    },
  };
  const load = loadCurtain(storage);
  assert.equal(load.blocked, true);
  assert.match(load.error, /보존/);
  assert.equal(value, "{ broken existing save");
  assert.equal(
    loadCurtain(() => {
      throw new Error("SecurityError");
    }).blocked,
    true,
  );
  const state = curtainThrough(2);
  assert.match(
    saveCurtain(() => {
      throw new Error("SecurityError");
    }, state),
    /저장되지/,
  );
  assert.match(
    saveCurtain(
      {
        ...storage,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
      state,
    ),
    /저장되지/,
  );
  assert.equal(saveCurtain(storage, state), "");
  assert.equal(loadCurtain(storage).state.findings.length, 3);
  for (const change of [
    { chapter: 5 },
    { offset: -1 },
    { fragment: { x: null, y: 50, angle: 0 } },
    { frames: [0, 4] },
    { findings: ["unknown"] },
  ])
    assert.throws(() =>
      decodeCurtainSave(
        JSON.stringify({ ...initialCurtainState(), ...change }),
      ),
    );
});

test("Curtain: shipped WAV is the waveform PCM; the matching take is unique", async () => {
  const recording = curtainSamples("recording");
  const match = curtainSamples("b");
  const offset = AUDIO_RATE * 1.2;
  assert.deepEqual(recording.slice(offset, offset + match.length), match);
  for (const take of ["a", "c"] as const)
    assert.notDeepEqual(curtainSamples(take), match);
  for (const take of ["a", "b", "c", "recording"] as const) {
    const wav = await readFile(`public/curtain/${take}.wav`);
    assert.equal(wav.subarray(0, 4).toString(), "RIFF");
    assert.equal(wav.readUInt32LE(24), AUDIO_RATE);
    const samples = curtainSamples(take);
    assert.equal(wav.length, 44 + samples.length * 2);
    for (let i = 0; i < samples.length; i++)
      assert.equal(
        wav.readInt16LE(44 + i * 2),
        Math.round(samples[i] * 32767) || 0,
      );
  }
});
