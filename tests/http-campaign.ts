import assert from "node:assert/strict";
import { episodes } from "../lib/cases";
import { walkthrough } from "./walkthrough";
import { communityImages } from "../lib/community";
import type { Feedback, gameView } from "../lib/game";
const base = process.env.GAME_TEST_URL ?? "http://localhost:3000";
let cookie = "";
async function request(action?: unknown, expected = 200) {
  const r = await fetch(`${base}/api/game`, {
    method: action ? "POST" : "GET",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(action ? { "Content-Type": "application/json", Origin: base } : {}),
    },
    ...(action ? { body: JSON.stringify(action) } : {}),
  });
  const setCookie = r.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const data = (await r.json()) as ReturnType<typeof gameView> & {
    error?: string;
    feedback?: Feedback;
  };
  assert.equal(r.status, expected, JSON.stringify(data));
  return data;
}
let view = await request();
assert.equal(view.progress.solved.length, 0);
assert.ok(cookie);
assert.match(
  (await fetch(`${base}/api/game`)).headers.get("set-cookie")!,
  /HttpOnly; SameSite=Lax/,
);
await request({ type: "visit", episode: 8 }, 400);
await request({ type: "pin", record: "8-1" }, 400);
assert.ok(
  (await request({ type: "read", record: "3-1" })).progress.read.includes(
    "3-1",
  ),
);
await request({ type: "read", record: "3-2" }, 400);
for (const id of ["1-15", "1-55", "1-94"]) {
  const saved = await request({ type: "pin", record: id });
  assert.ok(saved.progress.read.includes(id));
  assert.ok(saved.progress.pinned.includes(id));
}
for (const id of ["2-15", "4-16", "8-16"])
  await request({ type: "read", record: id }, 400);
await request({ type: "start" });
await request({ type: "like", record: "8-7" }, 400);
await request({ type: "like", record: "1-7" });
await request({ type: "pin", record: "1-7" });
assert.ok((await request()).progress.liked?.includes("1-7"));
assert.ok((await request()).progress.pinned.includes("1-7"));
await request({ type: "pin", record: "1-7" });
for (const ep of episodes) {
  await request({ type: "visit", episode: ep.id });
  await request({ type: "intro", episode: ep.id });
  assert.ok((await request()).progress.introduced?.includes(ep.id));
  const incorrect = await request({ type: "solve" });
  assert.equal(incorrect.progress.solved.length, ep.id - 1);
  for (const r of ep.records) {
    await request({ type: "read", record: r.id });
    await request({ type: "pin", record: r.id });
  }
  // Concrete alternative readings and counterexamples, independent of the
  // server's proof rules. Other questions remain empty during these probes.
  const proofProbes: Record<number, [string, string[], boolean][]> = {
    2: [
      ["timeline", ["2-3", "2-6"], true],
      ["timeline", ["2-1", "2-6"], false],
    ],
    5: [
      ["locker", ["5-1", "5-2", "5-3", "5-4", "5-5"], true],
      ["locker", ["5-1", "5-2", "5-3", "5-4"], false],
      ["locker", ["5-1", "5-6", "5-7"], false],
    ],
    8: [
      ["money", ["3-1", "3-3", "3-4"], true],
      ["money", ["8-1", "3-1", "3-4"], true],
      ["money", ["8-1", "3-1", "3-2"], false],
      ["money", ["8-1", "3-1", "3-4", "8-6"], false],
    ],
  };
  if (ep.id === 5) await request({ type: "pin", record: "5-7" });
  for (const [question, evidence, sufficient] of proofProbes[ep.id] ?? []) {
    const [answer] = walkthrough[ep.id - 1][question];
    await request({ type: "draft", question, draft: { answer, evidence } });
    const result = await request({ type: "solve" });
    assert.equal(result.feedback?.[question].answer, true);
    assert.equal(
      result.feedback?.[question].evidence,
      sufficient,
      `${ep.id}/${question}: ${evidence.join(",")}`,
    );
    assert.equal(result.progress.solved.length, ep.id - 1);
    if (!sufficient) assert.ok(result.feedback?.[question].evidenceMessage);
    assert.deepEqual(
      (await request()).progress.drafts[ep.id][question].evidence,
      evidence,
    );
  }
  if (ep.id === 2) {
    const [answer] = walkthrough[1].timeline;
    await request(
      {
        type: "draft",
        question: "timeline",
        draft: { answer, evidence: ep.records.map((record) => record.id) },
      },
      400,
    );
  }
  if (proofProbes[ep.id])
    console.log(
      `PASS HTTP episode ${ep.id}: alternative evidence, missing facts, persisted drafts and unrelated records`,
    );
  await request({ type: "note", text: `HTTP ${ep.id}: 서버에 저장한 메모` });
  await request({ type: "hint" });
  for (const [question, [answer, evidence]] of Object.entries(
    walkthrough[ep.id - 1],
  ))
    await request({ type: "draft", question, draft: { answer, evidence } });
  view = await request({ type: "solve" });
  assert.equal(view.progress.solved.length, ep.id);
  if (ep.id === 1) {
    const afterReply = await request({ type: "read", record: "2-15" });
    assert.ok(afterReply.progress.read.includes("2-15"));
    assert.ok(afterReply.progress.pinned.includes("1-15"));
    view = afterReply;
  }
  assert.ok(view.resolutions[ep.id]);
  const reloaded = await request();
  assert.deepEqual(reloaded.progress, view.progress);
  assert.ok(reloaded.progress.notes[ep.id]);
  console.log(
    `PASS HTTP episode ${ep.id}: all records, hints, note, wrong answer, solve and reload`,
  );
}
assert.ok(
  (await request({ type: "pin", record: "8-16" })).progress.pinned.includes(
    "8-16",
  ),
);
console.log(
  "PASS HTTP: new historical posts preserve saves; later community posts obey publication dates",
);
view = await request({ type: "ending", ending: "public" });
assert.equal(view.ending?.title, "다시 열린 게시판");
view = await request({ type: "ending", ending: "audit" });
assert.equal(view.ending?.title, "조용히 남은 원본");
const firstCookie = cookie;
cookie = "";
assert.equal((await request()).progress.solved.length, 0);
assert.notEqual(cookie, firstCookie);
cookie = firstCookie;
assert.equal((await request()).progress.solved.length, 8);
const forged = await fetch(`${base}/api/game`, {
  method: "POST",
  headers: {
    Cookie: cookie,
    Origin: "https://unrelated.example",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ type: "reset" }),
});
assert.equal(forged.status, 403, await forged.text());
const malformed = await fetch(`${base}/api/game`, {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: "{oops",
});
assert.equal(malformed.status, 400, await malformed.text());
const oversized = await fetch(`${base}/api/game`, {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: " ".repeat(13000),
});
assert.equal(oversized.status, 413, await oversized.text());
await request({ type: "reset" });
assert.equal((await request()).progress.solved.length, 0);
console.log(
  "PASS HTTP: both endings, independent sessions, reload, cross-origin rejection, malformed/oversized requests and reset",
);

const home = await fetch(base);
assert.equal(home.status, 200);
const html = await home.text();
assert.match(html, /삭제된 게시판/);
assert.match(html, /lang="ko"/);
assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
assert.match(html, /property="og:image"/);
assert.match(html, /212개 기록/);
const card = await fetch(`${base}/og.png`);
assert.equal(card.status, 200);
assert.match(card.headers.get("content-type") ?? "", /image\/png/);
for (const path of [
  ...Object.values(communityImages).map((a) => a.src),
  ...episodes.map((e) => `/story/${String(e.id).padStart(2, "0")}.webp`),
]) {
  const img = await fetch(`${base}/${path.replace(/^\//, "")}`);
  assert.equal(img.status, 200, path);
  assert.match(img.headers.get("content-type") ?? "", /image\/webp/);
  assert.ok((await img.arrayBuffer()).byteLength > 10000, path);
}
console.log(
  "PASS HTTP: all 14 community/prologue images and persisted introduction/reaction state",
);
const assets = [
  ...html.matchAll(
    /<(?:script|link)\b[^>]*\b(?:src|href)="(\/(?:assets|app|@id)\/[^"?#]+)"/g,
  ),
].map((m) => m[1]);
assert.ok(
  assets.length >= 2,
  "HTML references the client JavaScript and stylesheet",
);
for (const path of new Set(assets))
  assert.equal((await fetch(base + path)).status, 200, path);
console.log(
  "PASS HTTP: Korean HTML, social metadata, generated card, stylesheet and client scripts",
);
