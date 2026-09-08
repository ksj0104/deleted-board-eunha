import test from "node:test";
import assert from "node:assert/strict";
import { episodes, recordById } from "../lib/cases";
import { applyAction, freshProgress, grade } from "../lib/game";
import {
  calibrationFor,
  comparisonMatches,
  inspectionCaptures,
  inspectionEvents,
} from "../lib/calibration";
import {
  createLocalGameClient,
  LOCAL_SAVE_KEY,
} from "../lib/local-game-client";
import { episodeStories } from "../lib/stories";
import { caseThreads } from "../lib/narrative";
import { resolutions } from "../lib/solutions";
import { cctvAlignment, walkthrough } from "./walkthrough";

const stageTwo = () => ({
  ...freshProgress(),
  started: true,
  active: 2,
  solved: [1],
});
function readPair() {
  let p = stageTwo();
  for (const record of ["2-1", "2-2"])
    p = applyAction(p, { type: "read", record }).progress;
  return p;
}

test("calibration: clues expose observations, not the offset, and multiple entrances require a reference", () => {
  const preDiscovery = JSON.stringify([
    episodes[1],
    episodeStories[1],
    caseThreads[1],
    resolutions[1],
  ]);
  assert.doesNotMatch(
    preDiscovery,
    /7분|7분을 빼|시계의 오차가 적혀|정확히 7|시각을 그대로 믿지/,
  );
  assert.equal(inspectionCaptures.length, 3);
  assert.deepEqual(
    inspectionEvents.map((e) => e.event),
    ["문 열림", "문 닫힘", "문 열림"],
  );
  assert.ok(
    recordById("2-3")!.attachment!.rows.filter(
      (row) => row[1] === "관리동 문 열림",
    ).length >= 3,
  );
  assert.equal(
    grade(2, { time: { answer: "20:14", evidence: ["2-2", "2-3"] } }, [
      "2-2",
      "2-3",
    ]).time.evidence,
    false,
  );
  assert.equal(
    grade(
      2,
      {
        timeline: {
          answer: walkthrough[1].timeline[0],
          evidence: ["2-3", "2-4"],
        },
      },
      ["2-3", "2-4"],
    ).timeline.evidence,
    false,
  );
});

test("calibration: all three events must match, both sources must be read, and deduction needs a confirmed comparison", () => {
  assert.throws(
    () =>
      applyAction(freshProgress(), {
        type: "calibrate",
        offset: cctvAlignment,
      }),
    /모두 읽은 뒤/,
  );
  assert.throws(
    () => applyAction(stageTwo(), { type: "calibrate", offset: cctvAlignment }),
    /모두 읽은 뒤/,
  );
  let p = readPair();
  const before = structuredClone(p);
  for (let offset = -12; offset <= 12; offset++) {
    assert.equal(comparisonMatches(offset), offset === cctvAlignment);
    if (offset !== cctvAlignment)
      assert.throws(
        () => applyAction(p, { type: "calibrate", offset }),
        /세 동작/,
      );
  }
  for (const offset of [NaN, Infinity, 0.5, -13, 13])
    assert.throws(() => applyAction(p, { type: "align", offset }), /한 칸씩/);
  assert.deepEqual(p, before);
  for (const record of ["2-1", "2-2", "2-3", "2-4"])
    p = applyAction(p, { type: "pin", record }).progress;
  for (const [question, [answer, evidence]] of Object.entries(walkthrough[1]))
    p = applyAction(p, {
      type: "draft",
      question,
      draft: { answer, evidence },
    }).progress;
  const premature = applyAction(p, { type: "solve" });
  assert.equal(premature.feedback!.time.evidence, false);
  assert.equal(premature.feedback!.timeline.evidence, false);
  assert.equal(premature.progress.solved.length, 1);
  p = applyAction(p, { type: "calibrate", offset: cctvAlignment }).progress;
  assert.ok(applyAction(p, { type: "solve" }).progress.solved.includes(2));
  assert.deepEqual(
    applyAction(p, { type: "align", offset: 0 }).progress.calibration,
    p.calibration,
  );
  assert.deepEqual(applyAction(p, { type: "reset" }).progress.calibration, {
    offset: 0,
    confirmed: false,
  });
});

test("calibration: browser saves retain partial positions, reject false confirmations, retry writes and preserve legacy completion", async () => {
  let raw = JSON.stringify(readPair()),
    fail = false;
  const storage = {
    getItem: (key: string) => (key === LOCAL_SAVE_KEY ? raw : null),
    setItem: (_key: string, value: string) => {
      if (fail) throw new Error("quota");
      raw = value;
    },
  };
  const client = () => createLocalGameClient(() => storage);
  await client().request({ type: "align", offset: -3 });
  assert.deepEqual((await client().request()).progress.calibration, {
    offset: -3,
    confirmed: false,
  });
  const before = raw;
  fail = true;
  await assert.rejects(
    client().request({ type: "calibrate", offset: cctvAlignment }),
    /저장할 수 없/,
  );
  assert.equal(raw, before);
  fail = false;
  await client().request({ type: "calibrate", offset: cctvAlignment });
  assert.equal(
    (await client().request()).progress.calibration!.confirmed,
    true,
  );
  for (const calibration of [
    { offset: 0, confirmed: true },
    { offset: -13, confirmed: false },
    { offset: 0.1, confirmed: false },
  ]) {
    raw = JSON.stringify({ ...stageTwo(), calibration });
    const bad = raw;
    await assert.rejects(client().request(), /기존 기록은 그대로/);
    assert.equal(raw, bad);
  }
  const legacy = { ...stageTwo(), solved: [1, 2] };
  delete legacy.calibration;
  raw = JSON.stringify(legacy);
  assert.deepEqual(calibrationFor((await client().request()).progress), {
    offset: cctvAlignment,
    confirmed: true,
  });
  await client().request({ type: "note", text: "이전 플레이 이어 하기" });
  assert.equal(
    (await client().request()).progress.calibration!.confirmed,
    true,
  );
});
