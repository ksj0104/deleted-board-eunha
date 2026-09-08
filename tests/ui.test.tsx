import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import {
  allRecords,
  episodes,
  recordById,
  type RecordFile,
} from "../lib/cases";
import { freshProgress, applyAction, gameView, type Action } from "../lib/game";
import { walkthrough } from "./walkthrough";
import { caseThreads, mainCase } from "../lib/narrative";
import { communityRecords, deliveries, isPublicRecord } from "../lib/world";
import Game from "../app/Game";
import { SOUND_STORAGE_KEY } from "../lib/sound";
import {
  createLocalGameClient,
  LOCAL_SAVE_KEY,
} from "../lib/local-game-client";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3000",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLDialogElement: dom.window.HTMLDialogElement,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle,
});
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
const { render, screen, within, waitFor, cleanup, fireEvent, act } =
  await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
afterEach(() => cleanup());

test("UI: sound controls are reachable, persist volume and mute, and leave the game save intact", async () => {
  dom.window.localStorage.removeItem(SOUND_STORAGE_KEY);
  dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
  const client = createLocalGameClient(() => dom.window.localStorage);
  await client.request({ type: "start" });
  const user = userEvent.setup({ document: dom.window.document });
  const first = render(<Game client={client} />);
  await user.click(await screen.findByRole("button", { name: "효과음 설정" }));
  const dialog = screen.getByRole("dialog", { name: "효과음 설정" });
  fireEvent.change(
    within(dialog).getByRole("slider", { name: "효과음 음량" }),
    { target: { value: "20" } },
  );
  await user.click(
    within(dialog).getByRole("checkbox", { name: "효과음 사용" }),
  );
  assert.equal(
    within(dialog)
      .getByRole("button", { name: "소리 미리 듣기" })
      .hasAttribute("disabled"),
    true,
  );
  await user.click(within(dialog).getByRole("button", { name: "닫기" }));
  assert.ok(screen.getByRole("button", { name: "효과음 켜기" }));
  first.unmount();
  render(
    <Game client={createLocalGameClient(() => dom.window.localStorage)} />,
  );
  assert.ok(await screen.findByRole("button", { name: "효과음 켜기" }));
  assert.deepEqual(
    JSON.parse(dom.window.localStorage.getItem(SOUND_STORAGE_KEY)!),
    { enabled: false, volume: 0.2 },
  );
  assert.equal((await client.request()).progress.started, true);
  dom.window.localStorage.removeItem(SOUND_STORAGE_KEY);
  dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
});

test("UI: CCTV evidence uses image captures with selection and zoom while keeping collection and deductions available", async () => {
  const progress = {
    ...freshProgress(),
    started: true,
    solved: [1],
    active: 2,
    introduced: [1, 2],
  };
  dom.window.localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(progress));
  const client = createLocalGameClient(() => dom.window.localStorage);
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game client={client} />);
  await screen.findByRole("heading", { name: "은하아파트 주민마당" });
  const record = recordById("2-2")!;
  await openSourceRecord(user, record);
  const original = screen.getByRole("dialog", { name: record.title });
  assert.equal(
    original.querySelector(".document-body"),
    null,
    "CCTV is read visually, without the old transcription paragraphs",
  );
  assert.ok(within(original).getByRole("img", { name: /20:21:00/ }));
  await user.click(within(original).getByRole("button", { name: "캡처 02" }));
  assert.ok(within(original).getByRole("img", { name: /20:28:00/ }));
  await user.click(
    within(original).getByRole("button", { name: "선택한 CCTV 캡처 확대" }),
  );
  const zoom = screen.getByRole("dialog", { name: "CCTV 캡처 확대" });
  await user.click(
    within(zoom).getByRole("button", { name: "세부 확대 150%" }),
  );
  assert.ok(zoom.querySelector(".cctv-inspection.zoomed"));
  await user.click(within(zoom).getByRole("button", { name: "캡처 01" }));
  assert.ok(within(zoom).getByRole("img", { name: /20:21:00/ }));
  await user.click(within(zoom).getByRole("button", { name: "닫기" }));
  assert.ok(screen.getByRole("dialog", { name: record.title }));
  await user.click(within(original).getByRole("button", { name: /증거 수집/ }));
  await waitFor(async () =>
    assert.ok((await client.request()).progress.pinned.includes("2-2")),
  );
  dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
});

test("UI: GitHub Pages play saves evidence, answers and notes in browser storage and restores without API calls", async () => {
  dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => {
    requests++;
    throw new Error("No server on GitHub Pages");
  }) as typeof fetch;
  try {
    const client = createLocalGameClient(() => dom.window.localStorage);
    await client.request({ type: "start" });
    const user = userEvent.setup({ document: dom.window.document });
    const first = render(<Game client={client} />);
    await screen.findByRole("heading", { name: "은하아파트 주민마당" });
    const record = recordById("1-2")!;
    await openSourceRecord(user, record);
    const post = screen.getByRole("dialog", { name: record.title });
    await user.click(within(post).getByRole("button", { name: /증거 수집/ }));
    await user.click(within(post).getByRole("button", { name: "닫기" }));
    await user.click(screen.getByRole("button", { name: "추리 노트" }));
    const card = document.getElementById("question-1-alias")!;
    await user.click(within(card).getByRole("radio", { name: /계단참/ }));
    await openEvidencePicker(user, card);
    await user.click(within(card).getByRole("checkbox", { name: /1-2/ }));
    await user.click(
      within(screen.getByRole("dialog", { name: "추리 노트" })).getByRole(
        "button",
        { name: "닫기" },
      ),
    );
    await user.click(screen.getByRole("button", { name: "나의 메모" }));
    fireEvent.change(document.getElementById("notebook")!, {
      target: { value: "작성자 번호를 다시 대조하자" },
    });
    await waitFor(() =>
      assert.match(
        dom.window.localStorage.getItem(LOCAL_SAVE_KEY)!,
        /작성자 번호를 다시 대조하자/,
      ),
    );
    first.unmount();

    const reopened = createLocalGameClient(() => dom.window.localStorage);
    render(<Game client={reopened} />);
    await screen.findByRole("heading", { name: "은하아파트 주민마당" });
    await user.click(screen.getByRole("button", { name: "추리 노트" }));
    const restored = document.getElementById("question-1-alias")!;
    assert.ok(
      within(restored).getByRole("radio", { name: /계단참/, checked: true }),
    );
    assert.equal(
      within(restored).getAllByRole("button", { name: /근거 연결 해제/ })
        .length,
      1,
    );
    await user.click(
      within(screen.getByRole("dialog", { name: "추리 노트" })).getByRole(
        "button",
        { name: "닫기" },
      ),
    );
    await user.click(screen.getByRole("button", { name: "나의 메모" }));
    assert.ok(screen.getByDisplayValue("작성자 번호를 다시 대조하자"));
    const saved = await reopened.request();
    assert.ok(saved.progress.read.includes("1-2"));
    assert.ok(saved.progress.pinned.includes("1-2"));
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = previousFetch;
    dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
  }
});

async function openEvidencePicker(
  user: ReturnType<typeof userEvent.setup>,
  card: HTMLElement,
) {
  const button = within(card).getByRole("button", {
    name: /^증거 찾기(?: 접기)?$/,
  });
  if (button.getAttribute("aria-expanded") !== "true") await user.click(button);
}

async function openSourceRecord(
  user: ReturnType<typeof userEvent.setup>,
  record: RecordFile,
) {
  if (isPublicRecord(record)) {
    await user.click(screen.getByRole("button", { name: "게시판 기록" }));
    const newPosts = screen.queryByRole("button", { name: /새 글 \d+개 반영/ });
    if (newPosts) await user.click(newPosts);
    fireEvent.change(screen.getByRole("searchbox", { name: "기록 검색" }), {
      target: { value: record.title },
    });
    const row = [
      ...document.querySelectorAll<HTMLButtonElement>(".record-row"),
    ].find((el) => el.textContent?.includes(record.title));
    assert.ok(row, record.title);
    await user.click(row);
  } else {
    await user.click(screen.getByRole("button", { name: "받은 자료함" }));
    fireEvent.change(
      screen.getByRole("searchbox", { name: "받은 자료 검색" }),
      { target: { value: record.title } },
    );
    await user.click(
      screen.getByRole("button", { name: `${record.title} 열기` }),
    );
  }
}

function delayedSaves() {
  let state = applyAction(freshProgress(), { type: "start" }).progress;
  for (const r of episodes[0].records)
    state = applyAction(state, { type: "pin", record: r.id }).progress;
  for (const [question, [answer, evidence]] of Object.entries(walkthrough[0]))
    state = applyAction(state, {
      type: "draft",
      question,
      draft: { answer, evidence: question === "alias" ? [] : evidence },
    }).progress;
  const requests: { action: Action; respond: (fail?: boolean) => void }[] = [];
  globalThis.fetch = (async (
    _url: unknown,
    options?: { method?: string; body?: string },
  ) => {
    if (options?.method !== "POST") return Response.json(gameView(state));
    const action = JSON.parse(options.body!) as Action;
    return new Promise<Response>((resolve) =>
      requests.push({
        action,
        respond: (fail = false) => {
          if (fail)
            return resolve(
              Response.json(
                { error: "느린 연결의 저장 실패" },
                { status: 503 },
              ),
            );
          const result = applyAction(state, action);
          state = result.progress;
          resolve(
            Response.json({ ...gameView(state), feedback: result.feedback }),
          );
        },
      }),
    );
  }) as typeof fetch;
  return {
    requests,
    state: () => state,
    release: async (index: number, fail = false) => {
      await waitFor(() => assert.ok(requests[index]));
      await act(async () => requests[index].respond(fail));
    },
  };
}

test("UI: slow saves never block evidence toggles, coalesce changes and verify only the latest saved drafts", async () => {
  const server = delayedSaves();
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game />);
  await user.click(await screen.findByRole("button", { name: "추리 노트" }));
  const card = document.getElementById("question-1-alias")!;
  await openEvidencePicker(user, card);
  const proof = (id: string) =>
    within(card).getByRole("checkbox", {
      name: new RegExp(id),
    }) as HTMLInputElement;
  await user.click(proof("1-2"));
  assert.equal(proof("1-2").checked, true);
  assert.equal(proof("1-3").disabled, false);
  await user.click(proof("1-3"));
  assert.equal(proof("1-3").checked, true);
  assert.equal(
    proof("1-1").disabled,
    (episodes[0].questions[0].evidenceMax ??
      episodes[0].questions[0].evidenceCount) === 2,
    "evidence limit still applies",
  );
  await user.click(proof("1-2"));
  assert.equal(proof("1-2").checked, false);
  await user.click(proof("1-2"));
  await user.click(within(card).getByRole("radio", { name: /우편함/ }));
  await user.click(within(card).getByRole("radio", { name: /계단참/ }));
  const status = document.getElementById("question-1-status")!;
  await openEvidencePicker(user, status);
  const other = within(status).getByRole("checkbox", { name: /1-1/ });
  await user.click(other);
  await user.click(other);
  assert.equal(
    server.requests.length,
    1,
    "one in-flight request; rapid edits stay responsive",
  );
  let notes = screen.getByRole("dialog", { name: "추리 노트" });
  await user.click(within(notes).getByRole("button", { name: "닫기" }));
  await user.click(screen.getByRole("button", { name: "추리 노트" }));
  notes = screen.getByRole("dialog", { name: "추리 노트" });
  const aliasProofs = () =>
    within(document.getElementById("question-1-alias")!).getAllByRole(
      "button",
      { name: /근거 연결 해제/ },
    ).length;
  assert.equal(aliasProofs(), 2, "closing the modal retains unsaved choices");
  await user.click(
    within(notes).getByRole("button", { name: /내 추리 검증하기/ }),
  );
  await server.release(0);
  assert.equal(
    aliasProofs(),
    2,
    "an older response cannot overwrite newer choices",
  );
  await server.release(1);
  await server.release(2);
  await waitFor(() => assert.equal(server.requests[3]?.action.type, "solve"));
  assert.equal(
    server.requests.filter((r) => r.action.type === "draft").length,
    3,
  );
  assert.deepEqual(
    new Set(server.state().drafts[1].alias.evidence),
    new Set(["1-2", "1-3"]),
  );
  assert.equal(server.state().drafts[1].alias.answer, "계단참");
  await server.release(3);
  assert.deepEqual(server.state().solved, [1]);
});

test("UI: failed draft saves keep choices, block stale verification and allow an explicit retry", async () => {
  const server = delayedSaves();
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game />);
  await user.click(await screen.findByRole("button", { name: "추리 노트" }));
  const card = document.getElementById("question-1-alias")!;
  await openEvidencePicker(user, card);
  await user.click(within(card).getByRole("checkbox", { name: /1-2/ }));
  await user.click(within(card).getByRole("checkbox", { name: /1-3/ }));
  const notes = screen.getByRole("dialog", { name: "추리 노트" });
  await user.click(
    within(notes).getByRole("button", { name: /내 추리 검증하기/ }),
  );
  await server.release(0, true);
  assert.equal(
    within(notes).queryByRole("button", { name: "추리 다시 저장" }),
    null,
    "superseded failures do not discard a newer queued edit",
  );
  await server.release(1, true);
  const retry = await within(notes).findByRole("button", {
    name: "추리 다시 저장",
  });
  assert.equal(
    within(card).getAllByRole("checkbox", { checked: true }).length,
    2,
  );
  assert.equal(
    server.requests.some((r) => r.action.type === "solve"),
    false,
  );
  assert.equal(screen.queryByText("자동 저장됨"), null);
  const unload = new dom.window.Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, true);
  await user.click(retry);
  await server.release(2);
  await screen.findByText("자동 저장됨");
  assert.equal(
    within(notes).queryByRole("button", { name: "추리 다시 저장" }),
    null,
  );
  assert.deepEqual(server.state().drafts[1].alias.evidence, ["1-2", "1-3"]);
});

test("UI: a legacy final-episode draft survives and can be completed with the expanded proof requirements", async () => {
  let state = {
    ...freshProgress(),
    active: 8,
    started: true,
    solved: [1, 2, 3, 4, 5, 6, 7],
    introduced: [1, 2, 3, 4, 5, 6, 7, 8],
    read: allRecords.map((record) => record.id),
    pinned: allRecords.map((record) => record.id),
    notes: { 1: "이전에 저장한 모임 메모" },
    drafts: {
      8: {
        money: {
          answer:
            "조민석이 승인한 300만 원이 본인 대표 업체로 지급되고 공개 장부에서 다른 업체로 표시됐다",
          evidence: ["8-1"],
        },
      },
    },
  } as ReturnType<typeof freshProgress>;
  globalThis.fetch = (async (
    _url: unknown,
    options?: { method?: string; body?: string },
  ) => {
    if (options?.method === "POST") {
      const result = applyAction(state, JSON.parse(options.body!));
      state = result.progress;
      return Response.json({ ...gameView(state), feedback: result.feedback });
    }
    return Response.json(gameView(state));
  }) as typeof fetch;
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game />);
  await user.click(await screen.findByRole("button", { name: "추리 노트" }));
  const card = document.getElementById("question-8-money")!;
  assert.equal(within(card).getAllByRole("radio", { checked: true }).length, 1);
  assert.ok(within(card).getByRole("list", { name: "연결한 증거" }));
  assert.deepEqual(state.drafts[8].money.evidence, ["8-1"]);
  await user.click(
    within(card).getByRole("button", { name: /8-1 .* 근거 연결 해제/ }),
  );
  await waitFor(() => assert.deepEqual(state.drafts[8].money.evidence, []));
  await openEvidencePicker(user, card);
  for (const id of ["3-1", "3-3", "3-4"]) {
    fireEvent.change(
      within(card).getByRole("searchbox", { name: "수집한 증거 검색" }),
      {
        target: { value: recordById(id)!.title },
      },
    );
    await user.click(
      within(card).getByRole("checkbox", { name: new RegExp(id) }),
    );
    await waitFor(() => assert.ok(state.drafts[8].money.evidence.includes(id)));
  }
  await user.click(screen.getByRole("button", { name: /내 추리 검증하기/ }));
  await within(card).findByText("입증 완료");
  assert.equal(
    state.solved.length,
    7,
    "other unfinished questions still need proof",
  );
  assert.equal(state.version, 1);
  assert.equal(state.notes[1], "이전에 저장한 모임 메모");
});

test("UI: goals appear only in a modal and lead to record-driven questions and focused notes", async () => {
  let state = applyAction(freshProgress(), { type: "start" }).progress;
  globalThis.fetch = (async (
    _url: unknown,
    options?: { method?: string; body?: string },
  ) => {
    if (options?.method === "POST") {
      const result = applyAction(state, JSON.parse(options.body!));
      state = result.progress;
      return Response.json({ ...gameView(state), feedback: result.feedback });
    }
    return Response.json(gameView(state));
  }) as typeof fetch;
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game />);
  await screen.findByRole("heading", { name: "은하아파트 주민마당" });
  const board = document.querySelector(".community-board");
  assert.equal(
    screen.queryByRole("region", { name: "이번 사건의 해결 목표" }),
    null,
  );
  assert.equal(screen.queryByText(episodes[0].objective), null);
  const openGoals = async () => {
    await user.click(screen.getByRole("button", { name: "해결 목표" }));
    const dialog = screen.getByRole("dialog", {
      name: "현재 사건의 해결 목표",
    });
    return within(dialog).getByRole("region", {
      name: "이번 사건의 해결 목표",
    });
  };
  let guide = await openGoals();
  assert.ok(within(guide).getByText(mainCase.question));
  assert.ok(
    within(guide).getByRole("heading", { name: caseThreads[0].question }),
  );
  assert.equal(guide.querySelectorAll(".goal-list li").length, 0);
  for (const q of episodes[0].questions)
    assert.equal(within(guide).queryByText(q.prompt), null);
  assert.ok(
    within(guide).getByText(/모든 일상 글을 읽거나 수집할 필요는 없습니다/),
  );
  await user.click(within(guide).getByRole("button", { name: /먼저 읽을 글/ }));
  const entry = screen.getByRole("dialog", {
    name: episodes[0].records[0].title,
  });
  await waitFor(() => assert.ok(state.read.includes("1-1")));
  assert.ok(within(entry).getByText(caseThreads[0].inquiries.status.because));
  await user.click(within(entry).getByRole("button", { name: "닫기" }));
  guide = await openGoals();
  assert.equal(guide.querySelectorAll(".goal-list li").length, 1);
  await user.click(
    within(guide).getByRole("button", {
      name: `${caseThreads[0].inquiries.status.title} 조사 노트 열기`,
    }),
  );
  const notes = screen.getByRole("dialog", { name: "추리 노트" });
  const section = document.getElementById("question-1-status")!;
  assert.equal(
    document.activeElement,
    section,
    "the selected question receives focus",
  );
  assert.ok(
    within(notes).getByText(/글을 수집한 것만으로는 근거가 연결되지 않습니다/),
  );
  assert.ok(within(section).getByText(caseThreads[0].inquiries.status.leadsTo));
  assert.equal(
    within(notes).queryByRole("heading", {
      name: episodes[0].questions[0].prompt,
    }),
    null,
  );
  await user.click(
    within(section).getByRole("radio", {
      name: new RegExp(episodes[0].questions[1].options![0]),
    }),
  );
  await waitFor(() => assert.ok(state.drafts[1]?.status));
  await user.click(within(notes).getByRole("button", { name: "닫기" }));
  guide = await openGoals();
  const second = guide.querySelectorAll(".goal-list li")[0] as HTMLElement;
  assert.ok(within(second).getByText("근거 선택하기"));
  assert.ok(within(second).getByText("근거 0/2~3개"));
  assert.equal(state.solved.length, 0);
  await user.click(
    within(
      screen.getByRole("dialog", { name: "현재 사건의 해결 목표" }),
    ).getByRole("button", { name: "닫기" }),
  );
  assert.equal(
    screen.queryByRole("region", { name: "이번 사건의 해결 목표" }),
    null,
  );
  for (const id of ["1-2", "1-5"]) {
    const record = recordById(id)!;
    await openSourceRecord(user, record);
    await waitFor(() => assert.ok(state.read.includes(id)));
    await user.click(
      within(screen.getByRole("dialog", { name: record.title })).getByRole(
        "button",
        { name: "닫기" },
      ),
    );
  }
  guide = await openGoals();
  assert.equal(guide.querySelectorAll(".goal-list li").length, 3);
  const goals = screen.getByRole("dialog", { name: "현재 사건의 해결 목표" });
  await user.click(
    within(goals).getByRole("button", {
      name: `${caseThreads[0].inquiries.meeting.title} 조사 노트 열기`,
    }),
  );
  assert.equal(
    screen.queryByRole("dialog", { name: "현재 사건의 해결 목표" }),
    null,
  );
  assert.ok(screen.getByRole("dialog", { name: "추리 노트" }));
  assert.equal(
    document.activeElement,
    document.getElementById("question-1-meeting"),
  );
  assert.equal(document.querySelector(".community-board"), board);
});

test("UI: keyword trails expose matching comments and attachment rows while preserving a collected article's search", async () => {
  let state = applyAction(freshProgress(), { type: "start" }).progress;
  globalThis.fetch = (async (
    _url: unknown,
    options?: { method?: string; body?: string },
  ) => {
    if (options?.method === "POST") {
      const result = applyAction(state, JSON.parse(options.body!));
      state = result.progress;
      return Response.json({ ...gameView(state), feedback: result.feedback });
    }
    return Response.json(gameView(state));
  }) as typeof fetch;
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game />);
  const search = await screen.findByRole("searchbox", { name: "기록 검색" });
  assert.ok(screen.getByText("총 97개의 글"));
  const findRow = (id: string) => {
    const title = recordById(id)!.title;
    const row = [
      ...document.querySelectorAll<HTMLButtonElement>(".record-row"),
    ].find((node) => node.textContent?.includes(title));
    assert.ok(row, title);
    return row;
  };
  const marks = (row: HTMLElement) =>
    [...row.querySelectorAll("mark")].map((mark) => mark.textContent);
  fireEvent.change(search, { target: { value: "시집" } });
  await user.click(findRow("1-51"));
  const neighbor = screen.getByRole("dialog", {
    name: recordById("1-51")!.title,
  });
  assert.ok(within(neighbor).getByText(/수요일 모임이 취소/));
  await user.click(within(neighbor).getByRole("button", { name: "닫기" }));
  fireEvent.change(search, { target: { value: "모임 취소" } });
  assert.ok(findRow("1-4"));
  fireEvent.change(search, { target: { value: "우편함 독서모임" } });
  const table = findRow("1-2");
  assert.ok(within(table).getByText("댓글"));
  assert.ok(marks(table).includes("우편함"));
  assert.ok(marks(table).includes("독서모임"));
  fireEvent.change(search, { target: { value: "동문 용접 고정" } });
  const works = findRow("4-2");
  assert.ok(within(works).getByText("본문"));
  assert.ok(marks(works).includes("용접"));
  assert.ok(marks(works).includes("고정"));
  const category = screen.getByRole("combobox", { name: "게시판 분류" });
  await user.selectOptions(category, "공사안내");
  await user.click(works);
  const article = screen.getByRole("dialog", {
    name: recordById("4-2")!.title,
  });
  await user.click(
    within(article).getByRole("button", { name: "⌑ 증거 수집" }),
  );
  await waitFor(() => assert.ok(state.pinned.includes("4-2")));
  await user.click(within(article).getByRole("button", { name: "닫기" }));
  assert.equal((search as HTMLInputElement).value, "동문 용접 고정");
  assert.equal(category.tagName, "SELECT");
  assert.ok("value" in category);
  assert.equal(category.value, "공사안내");
  assert.ok(within(findRow("4-2")).getByLabelText("수집한 증거"));
  await user.selectOptions(category, "전체");
  fireEvent.change(search, { target: { value: "R07 비상문" } });
  const map = findRow("4-1");
  assert.ok(within(map).getByText("첨부"));
  assert.ok(marks(map).includes("R07"));
  assert.ok(marks(map).includes("비상문"));
  fireEvent.change(search, { target: { value: "동문 존재하지않는검색어" } });
  assert.equal(document.querySelectorAll(".record-row").length, 0);
  assert.ok(screen.getByText("일치하는 기록이 없습니다."));
});

test(
  "UI: community pagination, reactions and stacked investigation windows preserve the board and saved drafts",
  { timeout: 45000 },
  async () => {
    let state = applyAction(freshProgress(), { type: "start" }).progress;
    state = applyAction(state, { type: "read", record: "1-2" }).progress;
    globalThis.fetch = (async (
      _url: unknown,
      options?: { method?: string; body?: string },
    ) => {
      if (options?.method === "POST") {
        const result = applyAction(state, JSON.parse(options.body!));
        state = result.progress;
        return Response.json({ ...gameView(state), feedback: result.feedback });
      }
      return Response.json(gameView(state));
    }) as typeof fetch;
    const user = userEvent.setup({ document: dom.window.document });
    const idle = () =>
      waitFor(() => assert.ok(screen.getByText("자동 저장됨")));
    const click = async (el: HTMLElement) => {
      await user.click(el);
      await idle();
    };
    render(<Game />);
    await screen.findByRole("heading", { name: "은하아파트 주민마당" });
    assert.equal(document.querySelectorAll(".record-row").length, 12);
    await user.click(screen.getByRole("button", { name: "다음 글 →" }));
    assert.equal(document.querySelectorAll(".record-row").length, 12);
    const boardNode = document.querySelector(".community-board");
    await user.click(screen.getByRole("button", { name: /^증거 보관함/ }));
    let cabinet = screen.getByRole("dialog", { name: "증거 보관함" });
    assert.ok(within(cabinet).getByText("아직 수집한 증거가 없습니다."));
    assert.equal(document.body.style.overflow, "hidden");
    await user.click(within(cabinet).getByRole("button", { name: "닫기" }));
    assert.equal(document.body.style.overflow, "");
    assert.equal(document.querySelector(".community-board"), boardNode);
    assert.ok(
      screen.getByText(
        `2 / ${Math.ceil(communityRecords(state).length / 12)} 페이지`,
      ),
    );
    const search = screen.getByRole("searchbox", { name: "기록 검색" });
    const post = recordById("1-7")!;
    fireEvent.change(search, { target: { value: post.title } });
    assert.ok(screen.getByText("1 / 1 페이지"));
    await click(document.querySelector<HTMLButtonElement>(".record-row")!);
    let article = screen.getByRole("dialog", { name: post.title });
    assert.ok(within(article).getByRole("img", { name: post.photo!.alt }));
    assert.ok(within(article).getByText(post.comments![0].text));
    await click(within(article).getByRole("button", { name: /♡ 공감/ }));
    assert.equal(
      within(article)
        .getByRole("button", { name: /♡ 공감/ })
        .getAttribute("aria-pressed"),
      "true",
    );
    await click(within(article).getByRole("button", { name: "⌑ 증거 수집" }));
    await user.click(
      within(article).getByRole("button", { name: "추리 노트 열기 ↗" }),
    );
    const notes = screen.getByRole("dialog", { name: "추리 노트" });
    const first = episodes[0].questions[0];
    const card = within(notes)
      .getByRole("heading", { name: first.prompt })
      .closest("section")!;
    await click(
      within(card).getByRole("radio", { name: new RegExp(first.options![0]) }),
    );
    const savedAnswer = state.drafts[1][first.id].answer;
    await openEvidencePicker(user, card);
    await user.click(
      within(card).getByRole("button", { name: post.title + " 원문 읽기" }),
    );
    const reopened = screen.getByRole("dialog", { name: post.title });
    assert.notEqual(
      reopened,
      article,
      "reopening the same article creates a new top-layer dialog",
    );
    assert.equal(screen.getByRole("dialog", { name: "추리 노트" }), notes);
    fireEvent(reopened, new dom.window.Event("cancel", { cancelable: true }));
    assert.equal(screen.queryByRole("dialog", { name: post.title }), null);
    assert.equal(document.body.style.overflow, "hidden");
    assert.equal(state.drafts[1][first.id].answer, savedAnswer);
    await user.click(
      within(notes).getByRole("button", { name: "증거 보관함으로 전환 ↗" }),
    );
    cabinet = screen.getByRole("dialog", { name: "증거 보관함" });
    await click(
      within(cabinet).getByRole("button", {
        name: new RegExp(post.title.replace(/[?]/g, "\\?")),
      }),
    );
    article = screen.getByRole("dialog", { name: post.title });
    await user.click(within(article).getByRole("button", { name: "닫기" }));
    assert.ok(screen.getByRole("dialog", { name: "증거 보관함" }));
    await user.click(within(cabinet).getByRole("button", { name: "닫기" }));
    assert.equal(document.body.style.overflow, "");
    assert.equal(document.querySelector(".community-board"), boardNode);
    assert.equal((search as HTMLInputElement).value, post.title);
    fireEvent.change(search, { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "▧ 사진이 있는 글" }));
    const photoCount = Math.min(
      12,
      communityRecords(state).filter((record) => record.photo).length,
    );
    assert.equal(document.querySelectorAll(".record-row").length, photoCount);
    assert.equal(
      document.querySelectorAll(".record-row img").length,
      photoCount,
    );
    await user.click(
      screen.getByRole("button", { name: "도입 이야기 다시 보기 ↗" }),
    );
    const replay = screen.getByRole("dialog", { name: "사건 01 프롤로그" });
    assert.ok(within(replay).getByText(episodes[0].objective));
    await user.click(
      within(replay).getByRole("button", { name: "조사 이어가기 →" }),
    );
    cleanup();
    render(<Game />);
    await screen.findByRole("heading", { name: "은하아파트 주민마당" });
    assert.equal(
      screen.queryByRole("dialog"),
      null,
      "seen prologue stays dismissed after reload",
    );
    assert.deepEqual(state.liked, ["1-7"]);
    assert.equal(state.drafts[1][first.id].answer, savedAnswer);
    cleanup();
    for (const r of episodes[0].records)
      state = applyAction(state, { type: "pin", record: r.id }).progress;
    for (const [question, [answer, evidence]] of Object.entries(walkthrough[0]))
      state = applyAction(state, {
        type: "draft",
        question,
        draft: { answer, evidence },
      }).progress;
    state = applyAction(state, { type: "solve" }).progress;
    state = applyAction(state, { type: "visit", episode: 2 }).progress;
    render(<Game />);
    const next = await screen.findByRole("dialog", {
      name: "사건 02 프롤로그",
    });
    await click(within(next).getByRole("button", { name: "조사 이어가기 →" }));
    assert.equal(screen.queryByRole("combobox", { name: "보관 범위" }), null);
    assert.ok(screen.getByText(`총 ${communityRecords(state).length}개의 글`));
    fireEvent.change(screen.getByRole("searchbox", { name: "기록 검색" }), {
      target: { value: recordById("3-2")!.title },
    });
    assert.equal(
      document.querySelectorAll(".record-row").length,
      0,
      "private originals never appear as public posts",
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "기록 검색" }), {
      target: { value: post.title },
    });
    assert.equal(
      document.querySelectorAll(".record-row").length,
      1,
      "previous everyday posts remain searchable",
    );
    await user.click(screen.getByRole("button", { name: "받은 자료함" }));
    assert.ok(screen.getByRole("article", { name: deliveries[1].subject }));
    assert.ok(
      screen.getByRole("button", { name: /서윤 씨가 남긴 기록을 읽어 주세요/ }),
    );
    await user.click(screen.getByRole("button", { name: "게시판 기록" }));
    assert.equal(
      (screen.getByRole("searchbox", { name: "기록 검색" }) as HTMLInputElement)
        .value,
      post.title,
    );
  },
);

test(
  "UI: complete all 8 episodes through visible controls, search, pin, order, code, proof, hints, notes, endings, reload, reset",
  { timeout: 120000 },
  async () => {
    let state = freshProgress();
    const actions: Action[] = [];
    globalThis.fetch = (async (
      _url: unknown,
      options?: { method?: string; body?: string },
    ) => {
      await new Promise((r) => setTimeout(r, 2));
      if (options?.method === "POST") {
        const action = JSON.parse(options.body!) as Action;
        actions.push(action);
        const result = applyAction(state, action);
        state = result.progress;
        return Response.json({ ...gameView(state), feedback: result.feedback });
      }
      return Response.json(gameView(state));
    }) as typeof fetch;
    const user = userEvent.setup({ document: dom.window.document });
    render(<Game />);
    const intro = await screen.findByRole("dialog", {
      name: "기록자에게 도착한 의뢰",
    });
    assert.ok(within(intro).getByText(mainCase.question));
    for (const q of episodes[0].questions)
      assert.equal(within(intro).queryByText(q.prompt), null);
    await user.click(
      within(intro).getByRole("button", { name: "첫 번째 기록 열기 →" }),
    );
    const idle = () =>
      waitFor(() => assert.ok(screen.getByText("자동 저장됨")), {
        timeout: 4000,
      });
    const click = async (el: HTMLElement) => {
      await user.click(el);
      await idle();
    };
    await idle();
    const persistentBoard = document.querySelector(".community-board");
    for (const ep of episodes) {
      if (ep.id > 1) {
        const prologue = screen.getByRole("dialog", {
          name: `사건 ${String(ep.id).padStart(2, "0")} 프롤로그`,
        });
        assert.ok(within(prologue).getByText(ep.objective));
        assert.ok(within(prologue).getByRole("img"));
        await click(
          within(prologue).getByRole("button", {
            name: "조사 이어가기 →",
          }),
        );
      }
      if (ep.id > 1)
        assert.ok(
          screen.getByRole("article", { name: deliveries[ep.id - 1].subject }),
        );
      await user.click(screen.getByRole("button", { name: "게시판 기록" }));
      assert.ok(screen.getByRole("heading", { name: "주민마당", level: 1 }));
      assert.equal(
        document.querySelector(".community-board"),
        persistentBoard,
        "the same board survives every stage",
      );
      const search = screen.getByRole("searchbox", { name: "기록 검색" });
      await user.type(search, "존재하지않는단어xyz");
      assert.ok(screen.getByText("일치하는 기록이 없습니다."));
      await user.clear(search);
      for (const r of ep.records) {
        await openSourceRecord(user, r);
        await idle();
        const dialog = screen.getByRole("dialog", { name: r.title });
        if (!isPublicRecord(r))
          assert.equal(
            within(dialog).queryByRole("button", { name: /♡ 공감/ }),
            null,
            "private files are documents, not social posts",
          );
        if (r.surveillance) {
          const capture = within(dialog).getByRole("img", {
            name: r.surveillance.frames[0].alt,
          });
          assert.equal(
            capture.getAttribute("src"),
            r.surveillance.frames[0].src,
          );
        } else {
          for (const paragraph of r.paragraphs)
            assert.ok(within(dialog).getByText(paragraph));
        }
        if (r.attachment)
          assert.equal(
            within(dialog).getAllByRole("row").length,
            r.attachment.rows.length + 1,
          );
        await click(
          within(dialog).getByRole("button", { name: "⌑ 증거 수집" }),
        );
        await user.click(within(dialog).getByRole("button", { name: "닫기" }));
      }
      fireEvent.change(search, { target: { value: "" } });
      await click(screen.getByRole("button", { name: "나의 메모" }));
      const note = screen.getByRole("textbox", { name: "사건 메모" });
      fireEvent.change(note, {
        target: { value: `화면에서 남긴 ${ep.id}화 메모` },
      });
      await user.click(screen.getByRole("button", { name: "메모 저장" }));
      await idle();
      assert.match(state.notes[ep.id], /화면에서 남긴/);
      await click(screen.getByRole("button", { name: "추리 노트" }));
      await click(screen.getByRole("button", { name: /내 추리 검증하기/ }));
      assert.equal(document.querySelectorAll(".verdict").length, 3);
      assert.equal(state.solved.length, ep.id - 1);
      await user.click(screen.getByRole("button", { name: /힌트 \d\/3/ }));
      await click(screen.getByRole("button", { name: "1단계 힌트 열기" }));
      assert.ok(screen.getByText(ep.hints[0]));
      await user.click(
        within(screen.getByRole("dialog", { name: "사건 힌트" })).getByRole(
          "button",
          { name: "닫기" },
        ),
      );
      for (const q of ep.questions) {
        const [answer, evidence] = walkthrough[ep.id - 1][q.id];
        const heading = screen.getByRole("heading", { name: q.prompt });
        const card = heading.closest("section")!;
        if (q.kind === "choice")
          await click(
            within(card).getByRole("radio", {
              name: new RegExp(
                (answer as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              ),
            }),
          );
        else if (q.kind === "code") {
          const input = within(card).getByRole("textbox", { name: q.prompt });
          await user.type(input, answer as string);
          await click(within(card).getByRole("button", { name: "입력 적용" }));
        } else {
          for (let target = 0; target < (answer as string[]).length; target++) {
            const item = answer[target];
            while (
              [...card.querySelectorAll(".order-list li")].findIndex((el) =>
                el.textContent?.includes(item),
              ) > target
            )
              await click(
                within(card).getByRole("button", { name: `${item} 위로` }),
              );
          }
        }
        await openEvidencePicker(user, card);
        for (const id of evidence) {
          fireEvent.change(
            within(card).getByRole("searchbox", { name: "수집한 증거 검색" }),
            { target: { value: recordById(id)!.title } },
          );
          await click(
            within(card).getByRole("checkbox", {
              name: `${id} ${recordById(id)!.title}`,
            }),
          );
        }
      }
      await click(
        within(screen.getByRole("dialog", { name: "추리 노트" })).getByRole(
          "button",
          { name: /내 추리 검증하기/ },
        ),
      );
      assert.equal(state.solved.length, ep.id);
      const result = screen.getByRole("dialog", { name: "사건 해결" });
      await click(
        within(result).getByRole("button", {
          name:
            ep.id === 8
              ? "기록의 공개 범위 결정하기 →"
              : "도착한 회신 확인하기 →",
        }),
      );
    }
    await click(screen.getByRole("button", { name: /01 \/ 주민 공개/ }));
    assert.ok(screen.getByRole("heading", { name: "다시 열린 게시판" }));
    await click(screen.getByRole("button", { name: "다른 선택의 결말 읽기" }));
    assert.ok(screen.getByRole("heading", { name: "조용히 남은 원본" }));
    cleanup();
    render(<Game />);
    await screen.findByRole("heading", { name: "주민마당", level: 1 });
    assert.equal(state.ending, "audit");
    await click(screen.getByRole("button", { name: "사건 목록" }));
    await click(screen.getByRole("button", { name: /결말 다시 읽기/ }));
    assert.ok(screen.getByRole("heading", { name: "조용히 남은 원본" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "마지막 기록" })).getByRole(
        "button",
        { name: "닫기" },
      ),
    );
    await user.click(
      screen.getByRole("button", { name: "처음부터 다시 시작" }),
    );
    assert.equal(state.solved.length, 8, "confirmation is reversible");
    await click(screen.getByRole("button", { name: "초기화하고 시작" }));
    assert.equal(state.solved.length, 0);
    assert.ok(screen.getByRole("dialog", { name: "기록자에게 도착한 의뢰" }));
    assert.equal(actions.filter((a) => a.type === "pin").length, 48);
    assert.equal(actions.filter((a) => a.type === "solve").length, 16);
  },
);

test("UI: network load failure and retry are visible and recoverable", async () => {
  let failed = true;
  globalThis.fetch = (async () =>
    failed
      ? Response.json({ error: "연결 실패 테스트" }, { status: 503 })
      : Response.json(gameView(freshProgress()))) as typeof fetch;
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game />);
  assert.ok(await screen.findByRole("alert"));
  failed = false;
  await user.click(screen.getByRole("button", { name: "다시 연결하기" }));
  assert.ok(
    await screen.findByRole("dialog", { name: "기록자에게 도착한 의뢰" }),
  );
});

test("UI: failed save is reported inside the open dialog and retry preserves the game", async () => {
  let state = freshProgress(),
    failed = true;
  globalThis.fetch = (async (
    _url: unknown,
    options?: { method?: string; body?: string },
  ) => {
    if (options?.method === "POST") {
      if (failed)
        return Response.json({ error: "저장 실패 테스트" }, { status: 503 });
      state = applyAction(state, JSON.parse(options.body!)).progress;
    }
    return Response.json(gameView(state));
  }) as typeof fetch;
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game />);
  const intro = await screen.findByRole("dialog", {
    name: "기록자에게 도착한 의뢰",
  });
  await user.click(
    within(intro).getByRole("button", { name: "첫 번째 기록 열기 →" }),
  );
  assert.ok(await within(intro).findByRole("alert"));
  assert.equal(state.started, false);
  failed = false;
  await user.click(
    within(intro).getByRole("button", { name: "첫 번째 기록 열기 →" }),
  );
  await waitFor(() => assert.equal(screen.queryByRole("dialog"), null));
  assert.equal(state.started, true);
});
