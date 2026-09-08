import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, freshProgress } from "../lib/game";
import { episodes } from "../lib/cases";
import { automaticEvidence } from "../lib/automatic-evidence";
import {
  investigations,
  investigationById,
  investigationMatches,
  investigationState,
} from "../lib/fieldwork";
import {
  createLocalGameClient,
  LOCAL_SAVE_KEY,
} from "../lib/local-game-client";
import {
  investigationAction,
  investigationActions,
  investigationWalkthrough,
  walkthrough,
} from "./walkthrough";

const stage = (episode: number) => ({
  ...freshProgress(),
  started: true,
  active: episode,
  solved: Array.from({ length: episode - 1 }, (_, i) => i + 1),
});

test("direct investigations: seven distinct desks require source access and complete observed placements", () => {
  assert.deepEqual(
    investigations.map((d) => d.episode),
    [1, 3, 4, 5, 6, 7, 8],
  );
  for (const desk of investigations) {
    const path = investigationAction(desk.episode);
    let p = stage(desk.episode);
    assert.throws(() => applyAction(p, path), /원문/);
    const reads = investigationActions(desk.episode).slice(0, -1);
    for (const action of reads) p = applyAction(p, action).progress;
    for (const key of Object.keys(path.investigationState.placements)) {
      const partial = structuredClone(path);
      delete partial.investigationState.placements[key];
      assert.throws(() => applyAction(p, partial), /연결/);
    }
    const forged = structuredClone(path);
    forged.investigationState.placements.unknown = "invented";
    assert.throws(() => applyAction(p, forged), /항목/);
    const hidden = structuredClone(path);
    hidden.investigationState.inspected = [];
    assert.throws(() => applyAction(p, hidden), /항목/);
    const keys = Object.keys(path.investigationState.placements);
    const wrong = structuredClone(path);
    [
      wrong.investigationState.placements[keys[0]],
      wrong.investigationState.placements[keys.at(-1)!],
    ] = [
      wrong.investigationState.placements[keys.at(-1)!],
      wrong.investigationState.placements[keys[0]],
    ];
    assert.throws(() => applyAction(p, wrong), /연결/);
    const done = applyAction(p, path).progress;
    assert.equal(done.investigations![desk.id].confirmed, true);
    assert.ok(investigationMatches(desk, done.investigations![desk.id]));
    assert.deepEqual(
      applyAction(done, {
        type: "investigate",
        episode: desk.episode,
        investigation: desk.id,
        investigationState: { placements: {}, inspected: [], confirmed: false },
      }).progress.investigations,
      done.investigations,
      "replay cannot revoke completion",
    );
  }
  assert.throws(
    () => applyAction(freshProgress(), investigationAction(4)),
    /열리지/,
  );
});

test("route: placing the door inspection card is insufficient without the power-off handle experiment", () => {
  const path = investigationAction(4);
  path.investigationState.inspected = path.investigationState.inspected.filter(
    (id) => id !== "door-tested",
  );
  assert.equal(
    investigationMatches(investigationById("route")!, path.investigationState),
    false,
  );
});

test("automatic evidence: alternatives count, padding is ignored, missing facts do not unlock and answers need direct investigation", () => {
  for (const episode of episodes)
    for (const q of episode.questions) {
      const sources = walkthrough[episode.id - 1][q.id][1];
      const found = automaticEvidence(episode, q, [...sources, "1-7", "1-8"]);
      assert.ok(found, `${episode.id}/${q.id}`);
      assert.ok(found.every((id) => sources.includes(id)));
    }
  const locker = episodes[4].questions.find((q) => q.id === "locker")!;
  assert.ok(
    automaticEvidence(episodes[4], locker, ["5-1", "5-2", "5-3", "5-4", "5-5"]),
  );
  assert.ok(automaticEvidence(episodes[4], locker, ["5-1", "5-6", "5-7"]));
  assert.equal(
    automaticEvidence(episodes[4], locker, ["5-1", "5-2", "5-3", "5-4"]),
    null,
  );
  let p = freshProgress();
  for (const id of ["1-2", "1-3", "1-7"])
    p = applyAction(p, { type: "pin", record: id }).progress;
  p = applyAction(p, {
    type: "draft",
    question: "alias",
    draft: { answer: "계단참", evidence: [] },
  }).progress;
  assert.match(
    applyAction(p, { type: "solve" }).feedback!.alias.evidenceMessage!,
    /직접 조사/,
  );
  for (const action of investigationActions(1))
    p = applyAction(p, action).progress;
  const checked = applyAction(p, { type: "solve" });
  assert.deepEqual(checked.feedback!.alias, { answer: true, evidence: true });
  assert.deepEqual(
    new Set(checked.progress.drafts[1].alias.evidence),
    new Set(["1-2", "1-3"]),
  );
});

test("investigation saves: partial work, failed writes, corrupt completion, older saves and reset preserve expected data", async () => {
  let raw: string | null = null,
    fail = false;
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      if (fail) throw new Error("full");
      raw = value;
    },
  };
  const client = () => createLocalGameClient(() => storage);
  for (const action of investigationActions(1).slice(0, -1))
    await client().request(action);
  const partial = {
    type: "investigate",
    episode: 1,
    investigation: "profiles",
    investigationState: {
      placements: { "identity-a": "old-id" },
      inspected: ["old-id"],
      confirmed: false,
    },
  };
  await client().request(partial);
  assert.deepEqual(
    (await client().request()).progress.investigations!.profiles,
    partial.investigationState,
  );
  const before = raw;
  fail = true;
  await assert.rejects(client().request(investigationAction(1)), /저장/);
  assert.equal(raw, before);
  fail = false;
  await client().request(investigationAction(1));
  assert.equal(
    (await client().request()).progress.investigations!.profiles.confirmed,
    true,
  );
  const malformed = JSON.parse(raw!);
  malformed.investigations.profiles.placements["identity-a"] = "old-name";
  raw = JSON.stringify(malformed);
  const corrupt = raw;
  await assert.rejects(client().request(), /저장된 기록/);
  assert.equal(raw, corrupt);
  raw = JSON.stringify({
    ...stage(2),
    investigations: undefined,
    notes: { 1: "keep" },
  });
  const legacy = (await client().request()).progress;
  assert.equal(investigationState(legacy, investigations[0]).confirmed, true);
  assert.equal(legacy.notes[1], "keep");
  await client().request({ type: "reset" });
  assert.deepEqual((await client().request()).progress, freshProgress());
  assert.ok(LOCAL_SAVE_KEY.endsWith("v1"));
  assert.equal(Object.keys(investigationWalkthrough).length, 7);
});
