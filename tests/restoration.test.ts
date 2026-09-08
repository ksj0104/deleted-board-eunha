import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { documentScans } from "../lib/document-scans";
import { applyAction, freshProgress, grade } from "../lib/game";
import { recordById } from "../lib/cases";
import { readableParagraphs, restorationFor } from "../lib/restoration";
import {
  createLocalGameClient,
  LOCAL_SAVE_KEY,
} from "../lib/local-game-client";
import { restoredPaperOrder } from "./walkthrough";

const record = recordById("3-5")!;
const initial = () => ({
  ...freshProgress(),
  started: true,
  active: 3,
  solved: [1, 2],
});

test("document scans: all originals are readable-size assets and six actual crops reconstruct the exact memo pixels", async () => {
  for (const page of Object.values(documentScans).flat()) {
    const bytes = await readFile(`public/${page.src}`);
    const image = await sharp(bytes).metadata();
    assert.equal(image.format, "webp");
    assert.ok(image.width! >= 1024 && image.height! >= 1024);
    assert.ok(bytes.length > 10000);
  }
  const doc = record.shredded!;
  const original = await sharp(`public/${doc.scan!.src}`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = original.info;
  const layers = [];
  let left = 0;
  for (const id of restoredPaperOrder) {
    const piece = doc.pieces.find((piece) => piece.id === id)!;
    const image = await sharp(`public/${piece.src}`).metadata();
    assert.equal(image.height, height);
    layers.push({ input: `public/${piece.src}`, left, top: 0 });
    left += image.width!;
  }
  assert.equal(
    left,
    width,
    "every column of the generated image must be present exactly once",
  );
  const assembled = await sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .composite(layers)
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.deepEqual(
    assembled,
    original.data,
    "the puzzle uses real image crops, without retyped or omitted pixels",
  );
});

test("restoration: only complete, valid and accessible paper can become deduction evidence", () => {
  assert.throws(
    () =>
      applyAction(freshProgress(), {
        type: "restore",
        record: record.id,
        pieces: restoredPaperOrder,
      }),
    /복원할 수 없는/,
  );
  let p = applyAction(initial(), { type: "read", record: record.id }).progress;
  assert.equal(restorationFor(record, p).complete, false);
  assert.equal(
    readableParagraphs(record, p).includes(record.shredded!.transcript[0]),
    false,
  );
  assert.throws(
    () => applyAction(p, { type: "pin", record: record.id }),
    /복원한 뒤/,
  );
  const before = structuredClone(p);
  for (const pieces of [
    [],
    [...restoredPaperOrder, "cedar"],
    restoredPaperOrder.map(() => "cedar"),
    ["unknown", ...restoredPaperOrder.slice(1)],
  ])
    assert.throws(
      () => applyAction(p, { type: "arrange", record: record.id, pieces }),
      /빠짐없이/,
    );
  assert.throws(
    () =>
      applyAction(p, {
        type: "restore",
        record: record.id,
        pieces: record.shredded!.initial,
      }),
    /아직 글줄/,
  );
  assert.deepEqual(
    p,
    before,
    "failed restoration never mutates saved progress",
  );
  p = applyAction(p, {
    type: "arrange",
    record: record.id,
    pieces: restoredPaperOrder,
  }).progress;
  assert.equal(
    restorationFor(record, p).complete,
    false,
    "placing strips does not silently confirm the reconstruction",
  );
  p = applyAction(p, {
    type: "restore",
    record: record.id,
    pieces: restoredPaperOrder,
  }).progress;
  p = applyAction(p, { type: "pin", record: record.id }).progress;
  p = applyAction(p, { type: "pin", record: "3-4" }).progress;
  assert.ok(
    readableParagraphs(record, p).includes(record.shredded!.transcript[0]),
  );
  assert.equal(
    grade(
      3,
      { approver: { answer: "조민석", evidence: ["3-5", "3-4"] } },
      p.pinned,
    ).approver.evidence,
    true,
  );
  const replayed = applyAction(p, {
    type: "arrange",
    record: record.id,
    pieces: record.shredded!.initial,
  }).progress;
  assert.deepEqual(
    replayed,
    p,
    "replaying never revokes a collected, verified original",
  );
});

test("restoration: legacy originals stay available while previously unread paper still requires reconstruction", () => {
  const legacy = initial();
  delete legacy.restorations;
  legacy.read = [record.id];
  legacy.pinned = [record.id];
  const migrated = applyAction(legacy, {
    type: "note",
    text: "기존 플레이 기록",
  }).progress;
  assert.equal(restorationFor(record, migrated).complete, true);
  assert.deepEqual(migrated.pinned, [record.id]);
  const unopened = { ...legacy, read: [], pinned: [] };
  const opened = applyAction(unopened, {
    type: "read",
    record: record.id,
  }).progress;
  assert.equal(restorationFor(record, opened).complete, false);
  assert.equal(
    applyAction(migrated, { type: "reset" }).progress.restorations?.[record.id],
    undefined,
  );
});

test("restoration: partial arrangements and completion survive reload; failed or malformed saves preserve bytes", async () => {
  let raw = JSON.stringify(initial()),
    fail = false;
  const storage = {
    getItem: (key: string) => (key === LOCAL_SAVE_KEY ? raw : null),
    setItem: (_key: string, value: string) => {
      if (fail) throw new Error("quota");
      raw = value;
    },
  };
  const client = () => createLocalGameClient(() => storage);
  const order = [...record.shredded!.initial].reverse();
  await client().request({ type: "arrange", record: record.id, pieces: order });
  assert.deepEqual(
    restorationFor(record, (await client().request()).progress).order,
    order,
  );
  const before = raw;
  fail = true;
  await assert.rejects(
    client().request({
      type: "restore",
      record: record.id,
      pieces: restoredPaperOrder,
    }),
    /저장할 수 없/,
  );
  assert.equal(raw, before);
  fail = false;
  await client().request({
    type: "restore",
    record: record.id,
    pieces: restoredPaperOrder,
  });
  assert.equal(
    restorationFor(record, (await client().request()).progress).complete,
    true,
  );
  for (const saved of [
    { order: ["cedar"], complete: false },
    { order, complete: true },
    { order, complete: "yes" },
  ]) {
    raw = JSON.stringify({
      ...initial(),
      restorations: { [record.id]: saved },
    });
    const bad = raw;
    await assert.rejects(client().request(), /기존 기록은 그대로/);
    assert.equal(raw, bad);
  }
});
