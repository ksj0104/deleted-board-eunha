import test from "node:test";
import assert from "node:assert/strict";
import { episodes, allRecords, recordById } from "../lib/cases";
import {
  applyAction,
  freshProgress,
  grade,
  gameView,
  unlocked,
} from "../lib/game";
import { walkthrough, restoredPaperOrder, cctvAlignment } from "./walkthrough";
import { communityPosts } from "../lib/community";
import { episodeStories } from "../lib/stories";
import { existsSync } from "node:fs";
import {
  evidenceLimit,
  evidenceSelectionLabel,
  investigationGuides,
  questionPreparation,
} from "../lib/investigation";
import { caseThreads, inquiryDiscovered } from "../lib/narrative";
import {
  canReadRecord,
  communityRecords,
  deliveries,
  deliveryRecords,
  isPublicRecord,
  worldDate,
} from "../lib/world";

test("the community is a persistent dated world; private sources arrive separately and never rewind on case revisits", () => {
  const initial = freshProgress();
  assert.ok(
    communityRecords(initial).some((r) => r.id === "3-1"),
    "an old public ledger is available before its deduction stage",
  );
  assert.equal(
    canReadRecord(recordById("3-2")!, initial),
    false,
    "an old private original still needs its source's reply",
  );
  assert.equal(
    canReadRecord(recordById("8-7")!, initial),
    false,
    "future public posts wait for their publication time",
  );
  assert.equal(
    isPublicRecord(recordById("1-3")!),
    false,
    "the deleted post arrives as an email restoration",
  );
  assert.ok(
    applyAction(initial, {
      type: "read",
      record: "3-1",
    }).progress.read.includes("3-1"),
  );
  let previous: string[] = [];
  const privateIds: string[] = [];
  for (const ep of episodes) {
    const progress = {
      ...freshProgress(),
      active: ep.id,
      solved: episodes.slice(0, ep.id - 1).map((e) => e.id),
    };
    const board = communityRecords(progress);
    assert.ok(
      previous.every((id) => board.some((r) => r.id === id)),
      "old posts never disappear",
    );
    assert.ok(board.every((r) => r.date <= worldDate(progress)));
    for (const record of board)
      for (const comment of record.comments ?? [])
        if (comment.date) {
          assert.ok(
            comment.date >= record.date,
            `${record.id}: comment precedes post`,
          );
          assert.ok(
            comment.date <= worldDate(progress),
            `${record.id}: future comment`,
          );
        }
    assert.deepEqual(
      communityRecords({ ...progress, active: 1 }),
      board,
      "revisiting an earlier deduction keeps the same world",
    );
    assert.equal(deliveries[ep.id - 1].episode, ep.id);
    for (const record of deliveryRecords(ep.id)) {
      assert.equal(canReadRecord(record, progress), true);
      assert.equal(board.includes(record), false);
      privateIds.push(record.id);
    }
    previous = board.map((r) => r.id);
  }
  assert.equal(previous.length, 180);
  assert.equal(privateIds.length, 32);
  assert.equal(new Set([...previous, ...privateIds]).size, allRecords.length);
});

test("inquiries emerge from relevant records, preserve existing drafts and remain reachable throughout the campaign", () => {
  const ep = episodes[0];
  const visible = (p: ReturnType<typeof freshProgress>) =>
    ep.questions.filter((q) => inquiryDiscovered(ep, q, p)).map((q) => q.id);
  let p = applyAction(freshProgress(), { type: "start" }).progress;
  assert.deepEqual(visible(p), []);
  p = applyAction(p, { type: "read", record: "1-7" }).progress;
  assert.deepEqual(
    visible(p),
    [],
    "everyday posts do not invent case questions",
  );
  p = applyAction(p, { type: "read", record: "1-1" }).progress;
  assert.deepEqual(visible(p), ["status"]);
  p = applyAction(p, { type: "read", record: "1-2" }).progress;
  assert.deepEqual(visible(p), ["alias", "status"]);
  p = applyAction(p, { type: "read", record: "1-5" }).progress;
  assert.deepEqual(visible(p), ["alias", "status", "meeting"]);
  const legacy = freshProgress();
  legacy.drafts[1] = { meeting: { answer: "302호", evidence: [] } };
  assert.deepEqual(visible(legacy), ["meeting"], "old work is never hidden");
  legacy.solved = [1];
  assert.equal(visible(legacy).length, 3);

  assert.equal(caseThreads.length, episodes.length);
  for (const episode of episodes) {
    const thread = caseThreads[episode.id - 1];
    assert.deepEqual(
      Object.keys(thread.inquiries).sort(),
      episode.questions.map((q) => q.id).sort(),
    );
    const untouched = freshProgress();
    const readAll = { ...untouched, read: episode.records.map((r) => r.id) };
    for (const q of episode.questions) {
      const inquiry = thread.inquiries[q.id];
      assert.ok(inquiry.because && inquiry.leadsTo);
      assert.ok(inquiry.discoveredBy.length);
      for (const id of inquiry.discoveredBy) {
        assert.ok(
          episode.records.some((r) => r.id === id),
          `${episode.id}/${q.id}: ${id}`,
        );
        assert.equal(
          inquiryDiscovered(episode, q, { ...untouched, read: [id] }),
          !recordById(id)?.shredded,
        );
      }
      assert.equal(inquiryDiscovered(episode, q, untouched), false);
      assert.equal(inquiryDiscovered(episode, q, readAll), true);
    }
  }
});

test("investigation guidance covers all questions and distinguishes prepared answers from verified conclusions", () => {
  for (const ep of episodes) {
    const guide = investigationGuides[ep.id - 1];
    assert.ok(guide.situation.length > 30);
    assert.deepEqual(
      Object.keys(guide.tips).sort(),
      ep.questions.map((q) => q.id).sort(),
    );
    for (const q of ep.questions) assert.ok(guide.tips[q.id].length > 20);
  }
  const ep = episodes[0],
    q = ep.questions[0];
  let p = freshProgress();
  assert.equal(questionPreparation(ep, q, p).label, "답 찾는 중");
  p = applyAction(p, {
    type: "draft",
    question: q.id,
    draft: { answer: walkthrough[0].alias[0], evidence: [] },
  }).progress;
  assert.equal(questionPreparation(ep, q, p).label, "근거 선택하기");
  for (const id of ["1-2", "1-3"])
    p = applyAction(p, { type: "pin", record: id }).progress;
  p = applyAction(p, {
    type: "draft",
    question: q.id,
    draft: { answer: walkthrough[0].alias[0], evidence: ["1-2", "1-3"] },
  }).progress;
  const prepared = questionPreparation(ep, q, p);
  assert.equal(prepared.ready, true);
  assert.equal(prepared.confirmed, false);
  const wrong = questionPreparation(ep, q, p, {
    alias: { answer: true, evidence: false },
  });
  assert.equal(wrong.label, "근거 다시 검토");
  assert.equal(wrong.needsReview, true);
  assert.equal(
    questionPreparation(ep, q, p, { alias: { answer: true, evidence: true } })
      .confirmed,
    true,
  );
  p = applyAction(p, { type: "pin", record: "1-2" }).progress;
  assert.equal(questionPreparation(ep, q, p).ready, false);
  assert.equal(questionPreparation(ep, q, p).evidenceCount, 1);
});

test("legacy saves gain prologue history and reactions without losing progress; everyday posts obey locks and cannot replace proof", () => {
  let p = freshProgress();
  delete p.liked;
  delete p.introduced;
  p.started = true;
  p.notes[1] = "이전 버전의 메모";
  p = applyAction(p, { type: "intro", episode: 1 }).progress;
  p = applyAction(p, { type: "intro", episode: 1 }).progress;
  assert.deepEqual(p.introduced, [1]);
  p = applyAction(p, { type: "like", record: "1-7" }).progress;
  assert.deepEqual(p.liked, ["1-7"]);
  assert.ok(p.read.includes("1-7"));
  p = JSON.parse(JSON.stringify(p));
  p = applyAction(p, { type: "like", record: "1-7" }).progress;
  assert.deepEqual(p.liked, []);
  assert.equal(p.notes[1], "이전 버전의 메모");
  for (const type of ["read", "pin", "like"])
    assert.throws(() => applyAction(p, { type, record: "2-7" }));
  assert.throws(() => applyAction(p, { type: "intro", episode: 2 }));
  p = applyAction(p, { type: "pin", record: "1-7" }).progress;
  p = applyAction(p, { type: "pin", record: "1-8" }).progress;
  const [answer] = walkthrough[0].alias;
  const result = grade(
    1,
    { alias: { answer, evidence: ["1-7", "1-8"] } },
    p.pinned,
  ).alias;
  assert.equal(result.answer, true);
  assert.equal(result.evidence, false);
  assert.deepEqual(applyAction(p, { type: "reset" }).progress, freshProgress());
});

test("the complete campaign has 8 stories, 48 core records, 164 community posts, and 24 reachable deductions", () => {
  assert.equal(episodes.length, 8);
  assert.equal(episodes.flatMap((e) => e.records).length, 48);
  assert.equal(allRecords.length, 212);
  assert.equal(new Set(allRecords.map((r) => r.id)).size, 212);
  assert.equal(communityPosts.length, 164);
  assert.equal(episodeStories.length, 8);
  assert.equal(new Set(episodes.map((e) => e.mechanic)).size, 8);
  for (const ep of episodes) {
    const neighbors = communityPosts.filter((r) =>
      r.id.startsWith(`${ep.id}-`),
    );
    assert.ok(neighbors.length >= 8);
    assert.ok(new Set(neighbors.map((r) => r.board)).size >= 4);
    assert.ok(neighbors.some((r) => r.photo));
    for (const r of neighbors) {
      assert.ok(Array.isArray(r.comments));
      assert.ok(r.date.slice(0, 5) <= ep.date);
      if (r.photo)
        assert.ok(
          existsSync("public/" + r.photo.src.replace(/^\//, "")),
          r.photo.src,
        );
    }
    assert.ok(episodeStories[ep.id - 1].paragraphs.join("").length > 180);
    assert.ok(
      existsSync(`public/story/${String(ep.id).padStart(2, "0")}.webp`),
    );
    assert.ok(ep.intro.length > 70);
    assert.equal(ep.questions.length, 3);
    assert.equal(ep.hints.length, 3);
    for (const r of ep.records) {
      assert.ok(r.paragraphs.join("").length > 45, r.id);
      assert.ok(r.title && r.author && r.date);
      if (r.attachment)
        for (const row of r.attachment.rows)
          assert.equal(row.length, r.attachment.columns.length);
    }
    for (const q of ep.questions) {
      const [answer, ids] = walkthrough[ep.id - 1][q.id];
      assert.ok(
        ids.length >= q.evidenceCount && ids.length <= evidenceLimit(q),
      );
      for (const id of ids) {
        assert.ok(recordById(id), id);
        assert.ok(Number(id.split("-")[0]) <= ep.id);
      }
      if (q.kind === "choice") assert.ok(q.options!.includes(answer as string));
      if (q.kind === "order")
        assert.deepEqual(
          [...q.options!].sort(),
          [...(answer as string[])].sort(),
        );
    }
  }
});

test("full campaign: mistakes, complete supporting evidence, hints, reopen, persistence roundtrip, both endings, reset", () => {
  let p = freshProgress();
  assert.deepEqual(gameView(p).resolutions, {});
  assert.throws(() => applyAction(p, { type: "visit", episode: 8 }));
  assert.throws(() => applyAction(p, { type: "pin", record: "8-1" }));
  assert.throws(() => applyAction(p, { type: "ending", ending: "public" }));
  p = applyAction(p, { type: "start" }).progress;
  for (const ep of episodes) {
    p = applyAction(p, { type: "visit", episode: ep.id }).progress;
    const failed = applyAction(p, { type: "solve" });
    assert.equal(failed.progress.solved.length, ep.id - 1);
    assert.ok(
      Object.values(failed.feedback!).every((f) => !f.answer && !f.evidence),
    );
    p = failed.progress;
    for (let i = 0; i < 4; i++) p = applyAction(p, { type: "hint" }).progress;
    assert.equal(p.hints[ep.id], 3);
    for (const r of ep.records) {
      if (r.shredded)
        p = applyAction(p, {
          type: "restore",
          record: r.id,
          pieces: restoredPaperOrder,
        }).progress;
      p = applyAction(p, { type: "pin", record: r.id }).progress;
    }
    if (ep.id === 2)
      p = applyAction(p, { type: "calibrate", offset: cctvAlignment }).progress;
    for (const [question, [answer, evidence]] of Object.entries(
      walkthrough[ep.id - 1],
    )) {
      p = applyAction(p, {
        type: "draft",
        question,
        draft: { answer, evidence },
      }).progress;
      const modified = structuredClone(p.drafts[ep.id]);
      modified[question].evidence = [];
      assert.equal(grade(ep.id, modified, p.pinned)[question].evidence, false);
      modified[question].answer = Array.isArray(answer)
        ? [...answer].reverse()
        : "명백한 오답";
      assert.equal(grade(ep.id, modified, p.pinned)[question].answer, false);
    }
    p = applyAction(p, {
      type: "note",
      text: `사건 ${ep.id} 메모: 확인된 사실만 기록.`,
    }).progress;
    const result = applyAction(p, { type: "solve" });
    p = JSON.parse(JSON.stringify(result.progress));
    assert.equal(p.solved.length, ep.id);
    assert.ok(
      Object.values(result.feedback!).every((f) => f.answer && f.evidence),
    );
    assert.ok(gameView(p).resolutions[ep.id].text.length > 90);
    assert.equal(unlocked(p), Math.min(8, ep.id + 1));
    p = applyAction(p, { type: "solve" }).progress;
    assert.equal(
      p.solved.length,
      ep.id,
      "replays cannot unlock extra episodes",
    );
  }
  p = applyAction(p, { type: "ending", ending: "public" }).progress;
  assert.equal(gameView(p).ending?.title, "다시 열린 게시판");
  p = applyAction(p, { type: "ending", ending: "audit" }).progress;
  assert.equal(gameView(p).ending?.title, "조용히 남은 원본");
  p = applyAction(p, { type: "visit", episode: 1 }).progress;
  assert.ok(p.notes[1]);
  assert.equal(p.read.length, 48);
  assert.deepEqual(applyAction(p, { type: "reset" }).progress, freshProgress());
});

test("input validation and removing evidence preserve playable drafts", () => {
  let p = freshProgress();
  assert.throws(() =>
    applyAction(p, {
      type: "draft",
      question: "alias",
      draft: { answer: "계단참", evidence: ["1-2", "1-3"] },
    }),
  );
  p = applyAction(p, { type: "pin", record: "1-2" }).progress;
  p = applyAction(p, { type: "pin", record: "1-3" }).progress;
  assert.throws(() =>
    applyAction(p, {
      type: "draft",
      question: "alias",
      draft: { answer: "계단참", evidence: ["1-2", "1-2"] },
    }),
  );
  p = applyAction(p, {
    type: "draft",
    question: "alias",
    draft: { answer: "계단참", evidence: ["1-2", "1-3"] },
  }).progress;
  const before = structuredClone(p);
  p = applyAction(p, { type: "pin", record: "1-2" }).progress;
  assert.deepEqual(p.drafts[1].alias.evidence, ["1-3"]);
  assert.equal(before.pinned.length, 2, "actions are immutable");
  assert.throws(() => applyAction(p, { type: "note", text: "x".repeat(3001) }));
  for (const episode of [0, 9, NaN, -1, 1.2])
    assert.throws(() => applyAction(p, { type: "visit", episode }));
  assert.throws(() => applyAction(p, { type: "invalid" }));
});

test("numeric answers preserve leading zeroes and require complete values", () => {
  const ids = ["5-1", "5-6"];
  assert.equal(
    grade(5, { locker: { answer: "318", evidence: ids } }, ids).locker.answer,
    false,
  );
  assert.equal(
    grade(5, { locker: { answer: "０３１８", evidence: ids } }, ids).locker
      .answer,
    true,
  );
  assert.equal(
    grade(2, { time: { answer: "20:14 extra", evidence: ["2-1", "2-2"] } }, [
      "2-1",
      "2-2",
    ]).time.answer,
    false,
  );
});

// These counterarguments were written from the documents, independently of the
// server's proof definition. A plausible conclusion still needs every link.
const counterarguments: [
  number,
  string,
  string | string[],
  string[],
  string,
][] = [
  [
    1,
    "alias",
    "우편함",
    ["1-2", "1-5"],
    "an invitation does not link the old and new account IDs",
  ],
  [
    1,
    "status",
    "관리소장이 우편물을 수거했다",
    ["1-1", "1-2"],
    "a pre-announcement plan is not a later direct denial",
  ],
  [
    1,
    "meeting",
    "작은도서관",
    ["1-5"],
    "the earlier invitation needs the later cancellation exception",
  ],
  [
    2,
    "time",
    "20:28",
    ["2-1", "2-3"],
    "the clock offset and reader still need the target camera scene",
  ],
  [
    2,
    "timeline",
    ["관리동 문 열림", "정전 시작", "자료 복사 완료", "동문 출구 통과"],
    ["2-1", "2-6"],
    "an offset and an outage witness omit copy and exit timestamps",
  ],
  [
    2,
    "claim",
    "회색 외투를 입은 사람이 있었다",
    ["2-4", "2-6"],
    "two outage sources cannot establish when copying finished",
  ],
  [
    3,
    "difference",
    "4800000",
    ["3-1", "3-3"],
    "a payment amount is not proof that no further construction charge exists",
  ],
  [
    3,
    "recipient",
    "한결설비",
    ["3-2", "3-4"],
    "an invoice and vendor registration cannot establish an executed transfer",
  ],
  [
    3,
    "approver",
    "오유진",
    ["3-1", "3-3"],
    "payment approval alone does not identify the recipient company's director",
  ],
  [
    4,
    "route",
    ["관리동", "동문 안뜰", "구 세탁실", "지하 연결통로"],
    ["4-1", "4-5"],
    "a planned route is not observed movement",
  ],
  [
    4,
    "destination",
    "달빛세탁소",
    ["4-1", "4-5"],
    "a map plus intent cannot establish actual arrival",
  ],
  [
    4,
    "trapped",
    "그렇다, 모든 문이 전기로만 열린다",
    ["4-2", "4-4"],
    "external road closure cannot identify the visitor's final entrance",
  ],
  [
    5,
    "fragments",
    ["A", "B", "C", "D"],
    ["5-2", "5-3", "5-4"],
    "the missing paper leaves an unverified link",
  ],
  [
    5,
    "locker",
    "0138",
    ["5-1", "5-2", "5-3", "5-4"],
    "knowing the reading rule does not supply the missing digit",
  ],
  [
    5,
    "original",
    "E24",
    ["5-5", "5-6"],
    "classification and intake history omit the candidates' seal mapping",
  ],
  [
    6,
    "editor",
    "오유진",
    ["6-1", "6-3"],
    "a public byline and account directory do not show the final editor",
  ],
  [
    6,
    "deletion",
    "장터 사진 전체",
    ["6-1", "6-5"],
    "raw table identifiers need the data dictionary",
  ],
  [
    6,
    "vote",
    "글이 9시에 게시되었다",
    ["6-1", "6-6"],
    "a resident's memory of equipment is not a certified vote record",
  ],
  [
    7,
    "safe",
    "정전으로 기록실에 갇혀 있다",
    ["7-3", "7-6"],
    "an intermediary's public post does not replace the subject's current statement",
  ],
  [
    7,
    "sender",
    "윤해진",
    ["7-5", "3-5"],
    "a similar job description does not map an authenticated account to a name",
  ],
  [
    7,
    "instruction",
    "직접 차단기를 내렸다는 사실까지 확정된다",
    ["7-1", "2-4"],
    "entry and an anonymous manual operation do not establish the instruction",
  ],
  [
    8,
    "money",
    "480만 원 전액이 현금으로 사라졌다",
    ["8-1", "3-1", "3-2"],
    "the invoice cannot establish the account holder and director relationship",
  ],
  [
    8,
    "purpose",
    "주민 전원 합의에 따른 전체 게시글 삭제",
    ["6-1", "6-2", "8-2"],
    "more audit data does not supply the meaning of raw table identifiers",
  ],
  [
    8,
    "remaining",
    "예약 삭제가 중지됐다는 사실",
    ["7-1", "7-2", "8-5"],
    "entry confirmation cannot replace the limits of the actual operation log",
  ],
];

test("all 24 deductions reject a plausible wrong conclusion and an incomplete argument", async (t) => {
  assert.equal(counterarguments.length, 24);
  assert.equal(
    new Set(counterarguments.map(([ep, id]) => `${ep}/${id}`)).size,
    24,
  );
  for (const [ep, id, wrongAnswer, incomplete, reason] of counterarguments) {
    await t.test(`${ep}/${id}: ${reason}`, () => {
      const [answer, complete] = walkthrough[ep - 1][id];
      const question = episodes[ep - 1].questions.find((q) => q.id === id)!;
      if (question.kind === "choice")
        assert.ok(question.options!.includes(wrongAnswer as string));
      if (question.kind === "order")
        assert.deepEqual(
          [...question.options!].sort(),
          [...wrongAnswer].sort(),
        );
      const wrong = grade(
        ep,
        { [id]: { answer: wrongAnswer, evidence: complete } },
        complete,
      )[id];
      assert.equal(wrong.answer, false);
      assert.equal(
        wrong.evidence,
        true,
        "answer correctness is independent of complete source coverage",
      );
      const missing = grade(
        ep,
        { [id]: { answer, evidence: incomplete } },
        incomplete,
      )[id];
      assert.equal(missing.answer, true);
      assert.equal(missing.evidence, false, reason);
      assert.ok(missing.evidenceMessage);
      assert.doesNotMatch(
        missing.evidenceMessage!,
        /\b[1-8]-\d+\b/,
        "feedback must not reveal an answer-key document ID",
      );
    });
  }
});

const alternativeArguments: [number, string, string[], string][] = [
  [
    1,
    "status",
    ["1-1", "1-2", "1-3"],
    "identity corroboration may accompany the contradiction",
  ],
  [
    2,
    "time",
    ["2-1", "2-2"],
    "matching inspection events establish the camera's relation to server time",
  ],
  [
    2,
    "time",
    ["2-1", "2-2", "2-3"],
    "clock calibration and event correlation may be used together",
  ],
  [
    2,
    "timeline",
    ["2-1", "2-2", "2-3", "2-4", "2-6"],
    "independent eyewitness timing can date the outage",
  ],
  [
    2,
    "timeline",
    ["2-1", "2-2", "2-3", "2-6"],
    "calibrated footage may corroborate the complete timeline",
  ],
  [
    2,
    "claim",
    ["2-3", "2-5", "2-6"],
    "the announcement can accompany the reader and eyewitness contradiction",
  ],
  [
    3,
    "difference",
    ["3-2", "3-5"],
    "the original author's correction request independently states the public combined total",
  ],
  [
    3,
    "recipient",
    ["3-2", "3-3", "3-4", "3-5"],
    "extra relevant accounting sources do not invalidate the transfer-to-owner proof",
  ],
  [
    3,
    "approver",
    ["3-4", "3-5"],
    "a signed acknowledgement of both approvals can replace the public approval field",
  ],
  [
    4,
    "route",
    ["4-1", "4-2", "4-3", "4-5"],
    "construction and intent may corroborate authenticated movement",
  ],
  [
    5,
    "fragments",
    ["5-2", "5-3", "5-4", "5-5"],
    "the four physical pieces replace the transcribed table",
  ],
  [
    5,
    "fragments",
    ["5-1", "5-2", "5-3", "5-4", "5-5", "5-6"],
    "all relevant sources fit the documented maximum",
  ],
  [
    5,
    "locker",
    ["5-1", "5-2", "5-3", "5-4", "5-5"],
    "the rule plus every physical digit is a complete original-source proof",
  ],
  [
    8,
    "money",
    ["3-1", "3-3", "3-4"],
    "the retained original accounting packet still proves the final claim",
  ],
  [
    8,
    "money",
    ["3-3", "3-4", "3-5"],
    "the correction request proves the public misstatement and acknowledgement",
  ],
  [
    8,
    "money",
    ["8-1", "3-4", "3-5"],
    "the new bank confirmation works with retained ownership and publication sources",
  ],
  [
    8,
    "purpose",
    ["6-1", "6-3", "6-5"],
    "the original schedule remains a valid source of the planned operation",
  ],
  [
    8,
    "purpose",
    ["6-1", "6-2", "6-3", "6-5", "8-2"],
    "a full audit trail may corroborate promise, dictionary and actual targets",
  ],
  [
    8,
    "remaining",
    ["2-4", "7-1", "7-2", "8-5"],
    "entry proof may accompany the explicit limits of execution attribution",
  ],
];

test("alternative and corroborating proofs remain valid through draft validation and preparation", () => {
  for (const [ep, id, evidence, reason] of alternativeArguments) {
    const [answer] = walkthrough[ep - 1][id];
    let p = {
      ...freshProgress(),
      active: ep,
      solved: episodes.slice(0, ep - 1).map((e) => e.id),
    };
    for (const source of evidence) {
      if (recordById(source)?.shredded)
        p = applyAction(p, {
          type: "restore",
          record: source,
          pieces: restoredPaperOrder,
        }).progress;
      p = applyAction(p, { type: "pin", record: source }).progress;
    }
    if (ep === 2 && id !== "claim")
      p = applyAction(p, { type: "calibrate", offset: cctvAlignment }).progress;
    p = applyAction(p, {
      type: "draft",
      question: id,
      draft: { answer, evidence },
    }).progress;
    const q = episodes[ep - 1].questions.find(
      (question) => question.id === id,
    )!;
    assert.equal(
      questionPreparation(episodes[ep - 1], q, p).ready,
      true,
      reason,
    );
    const result = applyAction(p, { type: "solve" }).feedback![id];
    assert.equal(result.answer, true, reason);
    assert.equal(result.evidence, true, reason);
  }
});

test("relevant but incomplete fact collections and unrelated padding cannot pass proof coverage", () => {
  const incomplete: [number, string, string[]][] = [
    [8, "money", ["3-1", "3-4", "3-5"]], // No bank execution evidence.
    [8, "money", ["3-3", "3-4", "8-1"]], // No public presentation of the payment.
    [8, "purpose", ["6-1", "6-2", "6-3"]], // No actual scheduled operation.
    [8, "purpose", ["6-1", "6-5", "8-2"]], // Two schedules but no table dictionary.
    [5, "locker", ["5-1", "5-6", "5-7"]], // Complete proof plus unrelated community content.
    [8, "money", ["8-1", "3-1", "3-4", "8-6"]], // Complete proof plus unrelated community content.
  ];
  for (const [ep, id, evidence] of incomplete) {
    const [answer] = walkthrough[ep - 1][id];
    assert.equal(
      grade(ep, { [id]: { answer, evidence } }, evidence)[id].evidence,
      false,
    );
  }
  const [answer, evidence] = walkthrough[4].locker;
  assert.equal(
    grade(
      5,
      { locker: { answer, evidence: [...evidence, evidence[0]] } },
      evidence,
    ).locker.evidence,
    false,
  );
  assert.equal(
    grade(5, { locker: { answer, evidence } }, [evidence[0]]).locker.evidence,
    false,
  );
});

test("version-one solved episodes and old incomplete drafts survive the stronger proof requirements", () => {
  const legacy = {
    ...freshProgress(),
    started: true,
    active: 8,
    solved: [1, 2, 3, 4, 5, 6, 7],
    read: ["1-5", "8-1"],
    pinned: ["1-5", "8-1"],
    notes: { 1: "예전 약속 메모", 8: "공개 범위는 아직 결정하지 않음" },
    drafts: {
      1: { meeting: { answer: "동문 건너편 달빛세탁소", evidence: ["1-5"] } },
      8: { money: { answer: walkthrough[7].money[0], evidence: ["8-1"] } },
    },
  };
  const before = structuredClone(legacy);
  const restored = applyAction(JSON.parse(JSON.stringify(legacy)), {
    type: "visit",
    episode: 8,
  }).progress;
  assert.deepEqual(restored, before);
  assert.equal(restored.version, 1);
  const first = episodes[0].questions.find((q) => q.id === "meeting")!;
  assert.equal(
    questionPreparation(episodes[0], first, restored).confirmed,
    true,
    "a completed old case is never revoked",
  );
  const final = episodes[7].questions.find((q) => q.id === "money")!;
  const preparation = questionPreparation(episodes[7], final, restored);
  assert.equal(preparation.answered, true);
  assert.equal(preparation.ready, false);
  assert.equal(preparation.evidenceCount, 1);
  assert.equal(evidenceSelectionLabel(final), "3~5개");
  const failed = applyAction(restored, { type: "solve", episode: 8 });
  assert.deepEqual(failed.progress.solved, before.solved);
  assert.deepEqual(failed.progress.notes, before.notes);
  assert.deepEqual(failed.progress.drafts, before.drafts);
  assert.equal(failed.feedback!.money.answer, true);
  assert.equal(failed.feedback!.money.evidence, false);
  assert.match(failed.feedback!.money.evidenceMessage!, /3~5개/);
});

test("numeric formats accept real amounts without silently deleting arbitrary currency text from codes", () => {
  for (const amount of [
    "3,000,000원",
    "₩3,000,000",
    "300만 원",
    "３００００００",
    "03000000",
  ]) {
    assert.equal(
      grade(3, { difference: { answer: amount, evidence: ["3-1", "3-2"] } }, [
        "3-1",
        "3-2",
      ]).difference.answer,
      true,
      amount,
    );
  }
  for (const amount of [
    "3원000000",
    "3,00,0000",
    "3000000원원",
    "-3000000",
    "3000000원 extra",
  ]) {
    assert.equal(
      grade(3, { difference: { answer: amount, evidence: [] } }, []).difference
        .answer,
      false,
      amount,
    );
  }
  for (const answer of ["0318원", "0,318", "318", "0318 extra"]) {
    assert.equal(
      grade(5, { locker: { answer, evidence: [] } }, []).locker.answer,
      false,
      answer,
    );
  }
  for (const answer of ["20:14원", "20:1,4", "20:14 extra", "27:14"]) {
    assert.equal(
      grade(2, { time: { answer, evidence: [] } }, []).time.answer,
      false,
      answer,
    );
  }
});

test("case hints guide a method without publishing answer strings, evidence IDs, or choice positions", () => {
  const hints = episodes.flatMap((ep) => ep.hints);
  assert.equal(hints.length, 24);
  for (const hint of hints) {
    assert.doesNotMatch(
      hint,
      /\b[1-8]-\d+\b|첫 번째 선택|세 번째 선택|C\s*→\s*A|0318|E42|3000000/,
    );
  }
});
