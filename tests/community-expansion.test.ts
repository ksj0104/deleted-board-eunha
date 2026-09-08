import test from "node:test";
import assert from "node:assert/strict";
import { episodes, recordById } from "../lib/cases";
import { communityHistory } from "../lib/community-history";
import { communityNeighborhood } from "../lib/community-neighborhood";
import { applyAction, freshProgress, grade } from "../lib/game";
import { inquiryDiscovered } from "../lib/narrative";
import {
  matchesRecordSearch,
  recordSearchContexts,
  searchKeywords,
} from "../lib/record-search";
import { canReadRecord, communityRecords, isPublicRecord } from "../lib/world";

const additions = [...communityHistory, ...communityNeighborhood].map((entry) =>
  recordById(entry.id)!,
);

test("community expansion: search trails connect everyday followups and existing case records without revealing future posts", () => {
  const board = communityRecords(freshProgress());
  const search = (query: string) =>
    board.filter((record) =>
      matchesRecordSearch(record, searchKeywords(query)),
    );
  const poems = search("시집").map((record) => record.id);
  assert.ok(poems.includes("1-51"));
  assert.equal(
    poems.includes("2-15"),
    false,
    "the return report has not been published yet",
  );
  const cancellation = search("모임 취소").map((record) => record.id);
  assert.ok(
    cancellation.includes("1-51"),
    "an everyday question references the cancellation",
  );
  assert.ok(
    cancellation.includes("1-4"),
    "the original notice remains discoverable among the expanded board",
  );
  const umbrellas = search("초록 우산").map((record) => record.id);
  for (const id of ["1-58", "1-64", "1-67"])
    assert.ok(umbrellas.includes(id), id);
  const construction = search("동문 공사");
  assert.ok(construction.some((record) => record.id === "4-2"));
  assert.ok(
    construction.length < search("동문").length,
    "a second word narrows the actual corpus",
  );
  const bookRepair = search("책등 종이테이프");
  assert.ok(bookRepair.some((record) => record.id === "1-66"));
  assert.ok(
    recordSearchContexts(
      recordById("1-66")!,
      searchKeywords("책등 종이테이프"),
    ).some(
      (context) =>
        context.source === "첨부" &&
        context.parts.some(
          (part) => part.match && part.text.includes("종이테이프"),
        ),
    ),
  );
});

test("community expansion: past posts can be investigated immediately; later replies wait for the world clock", () => {
  const initial = freshProgress();
  assert.equal(additions.length, 100);
  assert.equal(
    additions.filter((record) => canReadRecord(record, initial)).length,
    80,
  );
  assert.equal(communityRecords(initial).length, 97);
  for (const record of additions) {
    assert.equal(isPublicRecord(record), true, record.id);
    if (canReadRecord(record, initial)) {
      const saved = applyAction(initial, {
        type: "pin",
        record: record.id,
      }).progress;
      assert.ok(saved.pinned.includes(record.id));
      assert.ok(saved.read.includes(record.id));
    } else {
      for (const type of ["read", "pin", "like"])
        assert.throws(
          () => applyAction(initial, { type, record: record.id }),
          record.id,
        );
    }
  }
  const tomorrow = { ...initial, active: 2, solved: [1] };
  assert.equal(canReadRecord(recordById("2-15")!, tomorrow), true);
  assert.equal(canReadRecord(recordById("4-16")!, tomorrow), false);
  const latest = { ...initial, active: 8, solved: [1, 2, 3, 4, 5, 6, 7] };
  assert.equal(communityRecords(latest).length, 180);
  assert.ok(additions.every((record) => canReadRecord(record, latest)));
  assert.deepEqual(
    communityRecords({ ...latest, active: 1 }),
    communityRecords(latest),
  );
});

test("community expansion: old saves remain usable and everyday context cannot substitute for case evidence", () => {
  const saved = freshProgress();
  saved.started = true;
  saved.read = ["1-1", "1-2", "1-7"];
  saved.pinned = ["1-2", "1-3"];
  saved.notes[1] = "고유번호가 같은 두 글을 대조할 것";
  saved.drafts[1] = { alias: { answer: "계단참", evidence: ["1-2", "1-3"] } };
  let updated = JSON.parse(JSON.stringify(saved)) as typeof saved;
  for (const record of additions.filter((entry) =>
    canReadRecord(entry, updated),
  ))
    updated = applyAction(updated, {
      type: "read",
      record: record.id,
    }).progress;
  assert.deepEqual(updated.drafts, saved.drafts);
  assert.deepEqual(updated.notes, saved.notes);
  assert.deepEqual(updated.pinned, saved.pinned);
  assert.equal(
    grade(1, updated.drafts[1], updated.pinned).alias.evidence,
    true,
  );
  const everydayOnly = {
    ...freshProgress(),
    read: additions.map((record) => record.id),
  };
  for (const question of episodes[0].questions)
    assert.equal(inquiryDiscovered(episodes[0], question, everydayOnly), false);
  const unrelated = grade(
    1,
    { alias: { answer: "계단참", evidence: ["1-15", "1-55"] } },
    ["1-15", "1-55"],
  );
  assert.equal(unrelated.alias.answer, true);
  assert.equal(unrelated.alias.evidence, false);
});
