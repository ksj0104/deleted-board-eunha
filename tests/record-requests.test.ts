import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, freshProgress, gameView } from "../lib/game";
import { recordById } from "../lib/cases";
import { canReadRecord, deliveryRecords } from "../lib/world";
import { createLocalGameClient } from "../lib/local-game-client";
import { acquisitionActions } from "./walkthrough";

const initial = () => ({
  ...freshProgress(),
  started: true,
  active: 4,
  solved: [1, 2, 3],
});
test("record requests: chapter four requires identified targets and prior source observations before originals arrive", () => {
  let p = initial();
  assert.equal(deliveryRecords(4, p).length, 0);
  for (const record of ["4-3", "4-4", "4-5"]) {
    assert.equal(canReadRecord(recordById(record)!, p), false);
    assert.throws(() => applyAction(p, { type: "read", record }), /열람/);
    assert.throws(() => applyAction(p, { type: "pin", record }), /열람/);
  }
  assert.throws(
    () =>
      applyAction(p, { type: "request-record", record: "4-3", text: "V03" }),
    /조회 전 원문 확인이 필요합니다:.*3월 18일 동문 외부 보도 폐쇄/,
  );
  assert.throws(
    () =>
      applyAction(freshProgress(), {
        type: "request-record",
        record: "4-3",
        text: "V03",
      }),
    /조회/,
  );
  for (const record of ["2-3", "4-2"])
    p = applyAction(p, { type: "read", record }).progress;
  for (const text of ["K17", "V3", "V03xxx", ""])
    assert.throws(
      () => applyAction(p, { type: "request-record", record: "4-3", text }),
      /조회/,
    );
  p = applyAction(p, {
    type: "request-record",
    record: "4-3",
    text: " v03 ",
  }).progress;
  assert.deepEqual(
    deliveryRecords(4, p).map((r) => r.id),
    ["4-3"],
  );
  assert.throws(
    () =>
      applyAction(p, { type: "request-record", record: "4-4", text: "R09" }),
    /조회/,
  );
  for (const action of acquisitionActions(4))
    p = applyAction(p, action).progress;
  assert.equal(deliveryRecords(4, p).length, 3);
  assert.equal(new Set(p.requested).size, 3);
  assert.deepEqual(
    applyAction(p, { type: "visit", episode: 1 }).progress.requested,
    p.requested,
  );
});

test("record requests: acquisition survives failed saves and reload, while old received originals remain available", async () => {
  let p = initial();
  for (const record of ["2-3", "4-2"])
    p = applyAction(p, { type: "read", record }).progress;
  let raw = JSON.stringify(p),
    fail = true;
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      if (fail) throw new Error("quota");
      raw = value;
    },
  };
  const client = createLocalGameClient(() => storage);
  const before = raw;
  await assert.rejects(
    client.request({ type: "request-record", record: "4-3", text: "V03" }),
    /저장/,
  );
  assert.equal(raw, before);
  fail = false;
  await client.request({ type: "request-record", record: "4-3", text: "V03" });
  assert.deepEqual(
    (await createLocalGameClient(() => storage).request()).progress.requested,
    ["4-3"],
  );
  const legacy = initial();
  delete legacy.requested;
  assert.equal(deliveryRecords(4, gameView(legacy).progress).length, 3);
  const early = freshProgress();
  delete early.requested;
  assert.deepEqual(gameView(early).progress.requested, []);
  for (const requested of [["made-up"], ["4-3", "4-3"], "4-3"]) {
    raw = JSON.stringify({ ...initial(), requested });
    await assert.rejects(client.request(), /저장된 기록/);
  }
});
