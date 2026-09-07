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
import { walkthrough } from "./walkthrough";
import { communityPosts } from "../lib/community";
import { episodeStories } from "../lib/stories";
import { existsSync } from "node:fs";
import { investigationGuides, questionPreparation } from "../lib/investigation";
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
  assert.equal(previous.length, 80);
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
          true,
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

test("the complete campaign has 8 stories, 48 core records, 64 community posts, and 24 reachable deductions", () => {
  assert.equal(episodes.length, 8);
  assert.equal(episodes.flatMap((e) => e.records).length, 48);
  assert.equal(allRecords.length, 112);
  assert.equal(new Set(allRecords.map((r) => r.id)).size, 112);
  assert.equal(communityPosts.length, 64);
  assert.equal(episodeStories.length, 8);
  assert.equal(new Set(episodes.map((e) => e.mechanic)).size, 8);
  for (const ep of episodes) {
    const neighbors = communityPosts.filter((r) =>
      r.id.startsWith(`${ep.id}-`),
    );
    assert.equal(neighbors.length, 8);
    assert.ok(new Set(neighbors.map((r) => r.board)).size >= 4);
    assert.ok(neighbors.some((r) => r.photo));
    for (const r of neighbors) {
      assert.ok(r.comments?.length);
      assert.ok(r.date.slice(0, 5) <= ep.date);
      if (r.photo) assert.ok(existsSync("public" + r.photo.src), r.photo.src);
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
      assert.equal(ids.length, q.evidenceCount);
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

test("full campaign: mistakes, exact supporting evidence, hints, reopen, persistence roundtrip, both endings, reset", () => {
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
    for (const r of ep.records)
      p = applyAction(p, { type: "pin", record: r.id }).progress;
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
