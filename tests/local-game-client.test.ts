import test from "node:test";
import assert from "node:assert/strict";
import { episodes } from "../lib/cases";
import { freshProgress } from "../lib/game";
import {
  createLocalGameClient,
  LOCAL_SAVE_KEY,
} from "../lib/local-game-client";
import { walkthrough, cctvAlignment } from "./walkthrough";
import { investigationActions } from "./walkthrough";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test("browser saves: all eight episodes, drafts, evidence, notes and both endings survive new client instances", async () => {
  const storage = memoryStorage();
  let client = createLocalGameClient(() => storage);
  assert.deepEqual((await client.request()).progress, freshProgress());
  await client.request({ type: "start" });
  for (const episode of episodes) {
    await client.request({ type: "visit", episode: episode.id });
    await client.request({ type: "intro" });
    await client.request({ type: "note", text: `${episode.id}화의 기억` });
    await client.request({ type: "hint" });
    const drafts = walkthrough[episode.id - 1];
    const evidence = new Set(Object.values(drafts).flatMap(([, ids]) => ids));
    const saved = (await client.request()).progress;
    for (const record of evidence)
      if (!saved.pinned.includes(record))
        await client.request({ type: "pin", record });
    if (episode.id === 2)
      await client.request({ type: "calibrate", offset: cctvAlignment });
    for (const action of investigationActions(episode.id))
      await client.request(action);
    for (const [question, [answer, ids]] of Object.entries(drafts))
      await client.request({
        type: "draft",
        question,
        draft: { answer, evidence: ids },
      });

    const before = await client.request();
    client = createLocalGameClient(() => storage);
    assert.deepEqual(
      await client.request(),
      before,
      "reopening restores the entire save",
    );
    const solved = await client.request({ type: "solve" });
    assert.ok(solved.progress.solved.includes(episode.id));
    assert.ok(
      Object.values(solved.feedback!).every((f) => f.answer && f.evidence),
    );
    assert.equal(solved.progress.notes[episode.id], `${episode.id}화의 기억`);
    assert.equal(solved.progress.hints[episode.id], 1);
    assert.equal(solved.progress.attempts[episode.id], 1);
  }
  await client.request({ type: "like", record: "1-1" });
  for (const ending of ["public", "audit"] as const) {
    const result = await client.request({ type: "ending", ending });
    const reopened = await createLocalGameClient(() => storage).request();
    assert.equal(reopened.progress.ending, ending);
    assert.deepEqual(reopened.ending, result.ending);
    assert.ok(reopened.progress.liked?.includes("1-1"));
    assert.equal(reopened.progress.introduced?.length, 8);
  }
});

test("browser saves: tabs read current storage before actions and another browser starts independently", async () => {
  const storage = memoryStorage();
  const first = createLocalGameClient(() => storage);
  const second = createLocalGameClient(() => storage);
  await second.request();
  await first.request({ type: "start" });
  await second.request({ type: "note", text: "다른 창의 메모" });
  const result = await first.request({ type: "pin", record: "1-1" });
  assert.equal(result.progress.started, true);
  assert.equal(result.progress.notes[1], "다른 창의 메모");
  assert.ok(result.progress.pinned.includes("1-1"));
  const independent = await createLocalGameClient(() =>
    memoryStorage(),
  ).request();
  assert.deepEqual(independent.progress, freshProgress());
});

test("browser saves: a failed write preserves saved bytes, reports failure and can be retried", async () => {
  const storage = memoryStorage();
  let fail = false;
  const client = createLocalGameClient(() => ({
    getItem: storage.getItem,
    setItem(key, value) {
      if (fail) throw new Error("QuotaExceededError");
      storage.setItem(key, value);
    },
  }));
  await client.request({ type: "start" });
  const original = storage.getItem(LOCAL_SAVE_KEY);
  fail = true;
  await assert.rejects(
    client.request({ type: "note", text: "보존할 메모" }),
    /저장할 수 없습니다/,
  );
  assert.equal(storage.getItem(LOCAL_SAVE_KEY), original);
  fail = false;
  await client.request({ type: "note", text: "보존할 메모" });
  assert.equal((await client.request()).progress.notes[1], "보존할 메모");
});

test("browser saves: corrupt or unsupported saves are preserved and unavailable storage is reported", async () => {
  const storage = memoryStorage();
  const client = createLocalGameClient(() => storage);
  for (const raw of [
    "{broken",
    "null",
    "{}",
    JSON.stringify({ ...freshProgress(), version: 2 }),
    JSON.stringify({ ...freshProgress(), active: 9 }),
  ]) {
    storage.setItem(LOCAL_SAVE_KEY, raw);
    await assert.rejects(client.request(), /기존 기록은 그대로 보관/);
    await assert.rejects(
      client.request({ type: "start" }),
      /기존 기록은 그대로 보관/,
    );
    assert.equal(storage.getItem(LOCAL_SAVE_KEY), raw);
  }
  const denied = createLocalGameClient(() => {
    throw new Error("SecurityError");
  });
  await assert.rejects(denied.request(), /사이트 데이터 저장 허용/);
  const unreadable = createLocalGameClient(() => ({
    ...storage,
    getItem() {
      throw new Error("SecurityError");
    },
  }));
  await assert.rejects(unreadable.request(), /사이트 데이터 저장 허용/);
});

test("browser saves: reset affects only this game and locked actions cannot alter storage", async () => {
  const storage = memoryStorage();
  storage.setItem("another-project", "keep me");
  const client = createLocalGameClient(() => storage);
  await client.request({ type: "start" });
  const original = storage.getItem(LOCAL_SAVE_KEY);
  await assert.rejects(
    client.request({ type: "visit", episode: 8 }),
    /아직 열리지 않은 사건/,
  );
  assert.equal(storage.getItem(LOCAL_SAVE_KEY), original);
  await client.request({ type: "reset" });
  assert.deepEqual(
    (await createLocalGameClient(() => storage).request()).progress,
    freshProgress(),
  );
  assert.equal(storage.getItem("another-project"), "keep me");
});
