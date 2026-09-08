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
import { walkthrough, restoredPaperOrder, cctvAlignment } from "./walkthrough";
import { investigationActions, investigationWalkthrough } from "./walkthrough";
import { investigationForEpisode } from "../lib/fieldwork";
import { mainCase } from "../lib/narrative";
import {
  documentScans,
  settlementScan,
  settlementPieceSrc,
} from "../lib/document-scans";
import { deliveries, isPublicRecord } from "../lib/world";
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

test("UI: CCTV comparison is discovered from two records, persists drag and keyboard alignment, and unlocks corrected time", async () => {
  const progress = {
    ...freshProgress(),
    started: true,
    solved: [1],
    active: 2,
    introduced: [1, 2],
  };
  dom.window.localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(progress));
  let fail = false;
  const storage = {
    getItem: (key: string) => dom.window.localStorage.getItem(key),
    setItem: (key: string, value: string) => {
      if (fail) throw new Error("quota");
      dom.window.localStorage.setItem(key, value);
    },
  };
  const client = createLocalGameClient(() => storage);
  const user = userEvent.setup({ document: dom.window.document });
  const mounted = render(<Game client={client} />);
  await screen.findByRole("heading", { name: "은하아파트 주민마당" });
  await openSourceRecord(user, recordById("2-2")!);
  let record = screen.getByRole("dialog", { name: recordById("2-2")!.title });
  assert.ok(
    (
      within(record).getByRole("button", {
        name: "기록 대조 열기",
      }) as HTMLButtonElement
    ).disabled,
  );
  assert.equal(
    within(record).queryByRole("button", { name: "보정 시각" }),
    null,
  );
  await user.click(
    within(record).getByRole("button", { name: "점검 중 표지가 있는 장면" }),
  );
  await user.click(within(record).getByRole("button", { name: "캡처 03" }));
  assert.ok(within(record).getByRole("img", { name: /20:00:00/ }));
  await user.click(within(record).getByRole("button", { name: "닫기" }));
  await openSourceRecord(user, recordById("2-1")!);
  record = screen.getByRole("dialog", { name: recordById("2-1")!.title });
  await user.click(
    within(record).getByRole("button", { name: "기록 대조 열기" }),
  );
  let comparison = screen.getByRole("dialog", { name: "기록 대조" });
  await user.click(
    within(comparison).getByRole("button", { name: "점검 캡처 2 확대" }),
  );
  const capture = screen.getByRole("dialog", { name: "점검 캡처 확대" });
  assert.ok(within(capture).getByRole("img", { name: /19:58:00/ }));
  await user.click(
    within(capture).getByRole("button", { name: "세부 확대 150%" }),
  );
  assert.ok(capture.querySelector(".cctv-inspection.zoomed"));
  await user.click(within(capture).getByRole("button", { name: "닫기" }));
  await user.click(
    within(comparison).getByRole("button", { name: "대조 확인" }),
  );
  await waitFor(() =>
    assert.ok(comparison.textContent?.includes("세 동작이 아직")),
  );
  assert.equal((await client.request()).progress.calibration!.confirmed, false);
  const track = within(comparison).getByRole("group", {
    name: "CCTV 시간선 드래그 영역",
  });
  const pointer = (type: string, clientX: number) => {
    const event = new dom.window.Event(type, { bubbles: true });
    Object.defineProperties(event, {
      clientX: { value: clientX },
      button: { value: 0 },
      pointerId: { value: 1 },
    });
    fireEvent(track, event);
  };
  pointer("pointerdown", 300);
  pointer("pointermove", 246);
  pointer("pointerup", 246);
  await within(comparison).findByText("시간선 위치 저장됨");
  assert.equal((await client.request()).progress.calibration!.offset, -3);
  assert.ok(comparison.hasAttribute("open"));
  const before = dom.window.localStorage.getItem(LOCAL_SAVE_KEY);
  fail = true;
  within(comparison)
    .getByRole("button", { name: "영상 줄 1분 왼쪽으로" })
    .focus();
  await user.keyboard("{Enter}");
  await within(comparison).findByText("위치를 저장하지 못했습니다");
  assert.equal(
    (within(comparison).getByRole("slider") as HTMLInputElement).value,
    "-4",
  );
  assert.equal(dom.window.localStorage.getItem(LOCAL_SAVE_KEY), before);
  fail = false;
  await user.click(
    within(comparison).getByRole("button", { name: "위치 다시 저장" }),
  );
  await within(comparison).findByText("시간선 위치 저장됨");
  await user.click(within(comparison).getByRole("button", { name: "닫기" }));
  await user.click(
    within(record).getByRole("button", { name: "기록 대조 열기" }),
  );
  comparison = screen.getByRole("dialog", { name: "기록 대조" });
  assert.equal(
    (within(comparison).getByRole("slider") as HTMLInputElement).value,
    "-4",
  );
  within(comparison)
    .getByRole("button", { name: "영상 줄 1분 왼쪽으로" })
    .focus();
  await user.keyboard("{Enter>3/}");
  await user.click(
    within(comparison).getByRole("button", { name: "대조 확인" }),
  );
  await within(comparison).findByText(/✓ 대조 완료/);
  await user.click(within(comparison).getByRole("button", { name: "닫기" }));
  await user.click(within(record).getByRole("button", { name: "닫기" }));
  await openSourceRecord(user, recordById("2-2")!);
  record = screen.getByRole("dialog", { name: recordById("2-2")!.title });
  assert.ok(within(record).getByText("20:21"));
  await user.click(within(record).getByRole("button", { name: "보정 시각" }));
  assert.ok(within(record).getByText("20:14"));
  assert.ok(
    within(record).getByRole("img", { name: /20:21:00/ }),
    "original capture is preserved",
  );
  mounted.unmount();
  render(<Game client={createLocalGameClient(() => storage)} />);
  await screen.findByRole("heading", { name: "은하아파트 주민마당" });
  await openSourceRecord(user, recordById("2-2")!);
  record = screen.getByRole("dialog", { name: recordById("2-2")!.title });
  await user.click(
    within(record).getByRole("button", { name: "기록 대조 열기" }),
  );
  comparison = screen.getByRole("dialog", { name: "기록 대조" });
  assert.ok(within(comparison).getByText(/✓ 대조 완료/));
  await user.click(
    within(comparison).getByRole("button", { name: "다시 대조하기" }),
  );
  assert.equal(
    (within(comparison).getByRole("slider") as HTMLInputElement).value,
    "0",
  );
  assert.equal((await client.request()).progress.calibration!.confirmed, true);
  dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
});

test("UI: financial records show scanned invoice, supplier letter and bank confirmation with stacked zoom", async () => {
  const progress = {
    ...freshProgress(),
    started: true,
    solved: [1, 2],
    active: 3,
    introduced: [1, 2, 3],
  };
  dom.window.localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(progress));
  const client = createLocalGameClient(() => dom.window.localStorage);
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game client={client} />);
  await screen.findByRole("heading", { name: "은하아파트 주민마당" });
  const source = recordById("3-2")!;
  await openSourceRecord(user, source);
  const original = screen.getByRole("dialog", { name: source.title });
  assert.equal(
    within(original).getByRole("img").getAttribute("src"),
    documentScans["3-2"][0].src,
  );
  await user.click(
    within(original).getByRole("button", { name: "업체 회신 공문" }),
  );
  assert.equal(
    within(original).getByRole("img").getAttribute("src"),
    documentScans["3-2"][1].src,
  );
  await user.click(
    within(original).getByRole("button", { name: "업체 회신 공문 확대" }),
  );
  const zoom = screen.getByRole("dialog", { name: "문서 원본 확대" });
  await user.click(
    within(zoom).getByRole("button", { name: "세부 확대 150%" }),
  );
  assert.ok(zoom.querySelector(".scan-inspection.zoomed"));
  await user.click(within(zoom).getByRole("button", { name: "세금계산서" }));
  assert.equal(
    within(zoom).getByRole("img").getAttribute("src"),
    documentScans["3-2"][0].src,
  );
  assert.equal(zoom.querySelector(".scan-inspection.zoomed"), null);
  fireEvent(zoom, new dom.window.Event("cancel", { cancelable: true }));
  assert.equal(screen.queryByRole("dialog", { name: "문서 원본 확대" }), null);
  assert.ok(screen.getByRole("dialog", { name: source.title }));
  await user.click(within(original).getByRole("button", { name: "닫기" }));
  const bank = recordById("3-3")!;
  await openSourceRecord(user, bank);
  const bankDialog = screen.getByRole("dialog", { name: bank.title });
  assert.equal(
    within(bankDialog).getByRole("img").getAttribute("src"),
    documentScans["3-3"][0].src,
  );
  await user.click(
    within(bankDialog).getByRole("button", { name: /직접 조사 열기/ }),
  );
  const desk = screen.getByRole("dialog", { name: "지급 전표 대조대" });
  await user.click(
    within(desk).getByRole("button", { name: /3-3.*공동관리비/ }),
  );
  assert.equal(
    within(desk).getByRole("img").getAttribute("src"),
    documentScans["3-3"][0].src,
  );
  dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
});

test("UI: shredded paper supports keyboard, drag, save retry, reopening, reconstruction and collection", async () => {
  const progress = {
    ...freshProgress(),
    started: true,
    solved: [1, 2],
    active: 3,
    introduced: [1, 2, 3],
  };
  dom.window.localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(progress));
  let fail = false;
  const storage = {
    getItem: (key: string) => dom.window.localStorage.getItem(key),
    setItem: (key: string, value: string) => {
      if (fail) throw new Error("quota");
      dom.window.localStorage.setItem(key, value);
    },
  };
  const client = createLocalGameClient(() => storage);
  const user = userEvent.setup({ document: dom.window.document });
  const record = recordById("3-5")!;
  const mounted = render(<Game client={client} />);
  await screen.findByRole("heading", { name: "은하아파트 주민마당" });
  await openSourceRecord(user, record);
  let dialog = screen.getByRole("dialog", { name: record.title });
  assert.equal(dialog.querySelectorAll(".shred-image img").length, 6);
  assert.equal(dialog.querySelector(".shred-fragment"), null);
  assert.equal(
    dialog.querySelector(`img[src="${settlementScan.src}"]`),
    null,
    "the intact image stays hidden before reconstruction",
  );
  for (const strip of dialog.querySelectorAll<HTMLButtonElement>(
    ".shred-strip",
  ))
    assert.equal(
      strip.querySelector("img")!.getAttribute("src"),
      settlementPieceSrc(strip.dataset.piece!),
    );
  assert.ok(
    (
      within(dialog).getByRole("button", {
        name: /증거 수집/,
      }) as HTMLButtonElement
    ).disabled,
  );
  assert.equal(
    within(dialog).queryByText(record.shredded!.transcript[0]),
    null,
  );
  assert.equal(dialog.querySelector(".record-inquiries"), null);
  await user.click(within(dialog).getByRole("button", { name: "복원 확인" }));
  await waitFor(() =>
    assert.ok(dialog.textContent?.includes("아직 글줄이 이어지지 않습니다")),
  );
  assert.equal(
    (await client.request()).progress.restorations?.[record.id]?.complete,
    undefined,
  );

  const before = dom.window.localStorage.getItem(LOCAL_SAVE_KEY);
  fail = true;
  let slots = [...dialog.querySelectorAll<HTMLButtonElement>(".shred-strip")];
  slots[0].focus();
  await user.keyboard("{Enter}");
  slots[2].focus();
  await user.keyboard("{Enter}");
  await within(dialog).findByText("배치 저장 실패 · 다시 저장해 주세요");
  assert.equal(dom.window.localStorage.getItem(LOCAL_SAVE_KEY), before);
  assert.equal(
    dialog.querySelector<HTMLButtonElement>(".shred-strip")!.dataset.piece,
    "cedar",
    "keyboard movement is immediate even if saving fails",
  );
  fail = false;
  await user.click(
    within(dialog).getByRole("button", { name: "배치 다시 저장" }),
  );
  await within(dialog).findByText("배치 저장됨");
  const partial = (await client.request()).progress.restorations![record.id]
    .order;
  await user.click(within(dialog).getByRole("button", { name: "닫기" }));
  await openSourceRecord(user, record);
  dialog = screen.getByRole("dialog", { name: record.title });
  slots = [...dialog.querySelectorAll<HTMLButtonElement>(".shred-strip")];
  assert.deepEqual(
    slots.map((el) => el.dataset.piece),
    partial,
  );
  const dataTransfer = { effectAllowed: "move", setData: () => {} };
  fireEvent.dragStart(slots[1], { dataTransfer });
  fireEvent.dragOver(slots[4], { dataTransfer });
  fireEvent.drop(slots[4], { dataTransfer });
  fireEvent.dragEnd(slots[1], { dataTransfer });
  await within(dialog).findByText("배치 저장됨");
  const dragged = [...partial];
  [dragged[1], dragged[4]] = [dragged[4], dragged[1]];
  assert.deepEqual(
    (await client.request()).progress.restorations![record.id].order,
    dragged,
  );
  assert.ok(
    screen.getByRole("dialog", { name: record.title }).hasAttribute("open"),
  );
  await user.click(within(dialog).getByRole("button", { name: "닫기" }));
  await openSourceRecord(user, record);
  dialog = screen.getByRole("dialog", { name: record.title });
  await reconstructPaper(user, dialog);
  assert.ok(within(dialog).getByText(record.shredded!.transcript[0]));
  await user.click(
    within(dialog).getByRole("button", { name: "복원한 결산 수정 쪽지 확대" }),
  );
  const enlarged = screen.getByRole("dialog", { name: "문서 원본 확대" });
  assert.equal(
    within(enlarged).getByRole("img").getAttribute("src"),
    settlementScan.src,
  );
  await user.click(within(enlarged).getByRole("button", { name: "닫기" }));
  assert.ok(screen.getByRole("dialog", { name: record.title }));
  assert.equal(
    dialog.querySelector(".record-inquiries"),
    null,
    "one restored record is not yet sufficient to unlock a question",
  );
  await user.click(within(dialog).getByRole("button", { name: /증거 수집/ }));
  await waitFor(async () =>
    assert.ok((await client.request()).progress.pinned.includes(record.id)),
  );
  mounted.unmount();
  render(<Game client={createLocalGameClient(() => storage)} />);
  await screen.findByRole("heading", { name: "은하아파트 주민마당" });
  await openSourceRecord(user, record);
  dialog = screen.getByRole("dialog", { name: record.title });
  assert.ok(within(dialog).getByText("✓ 복원된 단서"));
  await user.click(
    within(dialog).getByRole("button", { name: "조각 다시 맞춰보기" }),
  );
  assert.equal(
    within(dialog).queryByText(record.shredded!.transcript[0]),
    null,
  );
  assert.ok((await client.request()).progress.pinned.includes(record.id));
  await reconstructPaper(user, dialog);
  assert.equal(
    (await client.request()).progress.restorations![record.id].complete,
    true,
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
    await openSourceRecord(user, recordById("1-3")!);
    const counterpart = screen.getByRole("dialog", {
      name: recordById("1-3")!.title,
    });
    await user.click(
      within(counterpart).getByRole("button", { name: "⌑ 증거 수집" }),
    );
    await user.click(within(counterpart).getByRole("button", { name: "닫기" }));
    await user.click(screen.getByRole("button", { name: "추리 노트" }));
    const card = document.getElementById("question-1-alias")!;
    await user.click(within(card).getByRole("radio", { name: /계단참/ }));
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
    assert.equal(within(restored).queryByRole("checkbox"), null);
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

test("UI: investigation keyboard placement and drag survive modal closing, save failures, retry and reload", async () => {
  let raw: string | null = null,
    fail = false;
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      if (fail) throw new Error("full");
      raw = value;
    },
  };
  const client = createLocalGameClient(() => storage);
  await client.request({ type: "start" });
  for (const action of investigationActions(1).slice(0, -1))
    await client.request(action);
  const user = userEvent.setup({ document: dom.window.document });
  const root = render(<Game client={client} />);
  await user.click(await screen.findByRole("button", { name: "추리 노트" }));
  let notes = screen.getByRole("dialog", { name: "추리 노트" });
  await user.click(
    within(notes).getByRole("button", { name: "직접 조사 열기 ↗" }),
  );
  let bench = screen.getByRole("dialog", { name: "삭제 전 알림 대조" });
  const tab = (id: string) =>
    [
      ...bench.querySelectorAll<HTMLButtonElement>(
        ".investigation-source-tabs button",
      ),
    ].find((button) => button.textContent!.includes(`· ${id}`))!;
  await user.click(tab("1-2"));
  fail = true;
  within(bench).getByRole("button", { name: "작성자 정보 펼치기" }).focus();
  await user.keyboard("{Enter}");
  await within(bench).findByRole("button", { name: "조사 저장 재시도" });
  within(bench)
    .getByRole("button", { name: "예전 글의 변하지 않는 식별 정보에 놓기" })
    .focus();
  await user.keyboard("{Enter}");
  await within(bench).findByRole("button", { name: "조사 저장 재시도" });
  await user.click(within(bench).getByRole("button", { name: "닫기" }));
  await user.click(
    within(notes).getByRole("button", { name: "직접 조사 열기 ↗" }),
  );
  bench = screen.getByRole("dialog", { name: "삭제 전 알림 대조" });
  assert.match(
    bench.querySelector('[data-slot="identity-a"]')!.textContent!,
    /P042/,
  );
  fail = false;
  await user.click(
    within(bench).getByRole("button", { name: "조사 저장 재시도" }),
  );
  await waitFor(() =>
    assert.equal(
      JSON.parse(raw!).investigations.profiles.placements["identity-a"],
      "old-id",
    ),
  );
  await user.click(tab("1-3"));
  const newId = within(bench).getByRole("button", {
    name: "알림 원본 정보 펼치기",
  });
  await user.click(newId);
  fireEvent.dragStart(newId, {
    dataTransfer: { setData: () => {}, effectAllowed: "" },
  });
  fireEvent.dragOver(bench.querySelector('[data-slot="identity-b"]')!);
  fireEvent.drop(bench.querySelector('[data-slot="identity-b"]')!);
  assert.ok(screen.getByRole("dialog", { name: "삭제 전 알림 대조" }));
  await waitFor(() =>
    assert.equal(
      JSON.parse(raw!).investigations.profiles.placements["identity-b"],
      "new-id",
    ),
  );
  root.unmount();
  render(<Game client={createLocalGameClient(() => storage)} />);
  await user.click(await screen.findByRole("button", { name: "추리 노트" }));
  notes = screen.getByRole("dialog", { name: "추리 노트" });
  await user.click(
    within(notes).getByRole("button", { name: "직접 조사 열기 ↗" }),
  );
  bench = screen.getByRole("dialog", { name: "삭제 전 알림 대조" });
  assert.match(
    bench.querySelector('[data-slot="identity-b"]')!.textContent!,
    /P042/,
  );
  await user.click(
    within(bench).getByRole("button", { name: "조사 결과 확인" }),
  );
  await within(bench).findByText(/연결되지 않거나 원문과 대응하지 않는 항목/);
  assert.equal(
    (await client.request()).progress.investigations!.profiles.confirmed,
    false,
  );
  await user.click(within(bench).getByRole("button", { name: "닫기" }));
  await investigateCase(user, 1);
  assert.ok(
    (await client.request()).progress.investigations!.profiles.confirmed,
  );
  assert.equal(
    notes.querySelectorAll(".deduction-card").length,
    3,
    "verified investigation automatically collects the source documents",
  );
});

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

async function compareCctv(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
) {
  await user.click(
    within(dialog).getByRole("button", { name: "기록 대조 열기" }),
  );
  const comparison = screen.getByRole("dialog", { name: "기록 대조" });
  const left = within(comparison).getByRole("button", {
    name: "영상 줄 1분 왼쪽으로",
  });
  left.focus();
  await user.keyboard(`{Enter>${Math.abs(cctvAlignment)}/}`);
  await user.click(
    within(comparison).getByRole("button", { name: "대조 확인" }),
  );
  await within(comparison).findByText(/✓ 대조 완료/);
  await user.click(within(comparison).getByRole("button", { name: "닫기" }));
}

async function investigateCase(
  user: ReturnType<typeof userEvent.setup>,
  episode: number,
) {
  const desk = investigationForEpisode(episode)!;
  const path = investigationWalkthrough[episode];
  await user.click(
    within(screen.getByRole("dialog", { name: "추리 노트" })).getByRole(
      "button",
      { name: "직접 조사 열기 ↗" },
    ),
  );
  const bench = screen.getByRole("dialog", { name: desk.title });
  for (const [slot, id] of Object.entries(path.placements)) {
    const clue = desk.clues.find((c) => c.id === id)!;
    const tab = [
      ...bench.querySelectorAll<HTMLButtonElement>(
        ".investigation-source-tabs button",
      ),
    ].find((button) => button.textContent!.includes(`· ${clue.source}`))!;
    await user.click(tab);
    await user.click(within(bench).getByRole("button", { name: clue.label }));
    if (
      desk.id === "route" &&
      ["management", "courtyard", "tunnel", "archive"].includes(slot)
    ) {
      const label = {
        management: "관리동",
        courtyard: "동문 안뜰",
        tunnel: "지하 연결통로",
        archive: "구 세탁실",
      }[slot];
      await user.click(
        within(bench).getByRole("button", { name: `${label}에 기록 놓기` }),
      );
    } else
      await user.click(
        within(bench).getByRole("button", {
          name: `${desk.slots.find((s) => s.id === slot)!.label}에 놓기`,
        }),
      );
  }
  if (desk.id === "route") {
    await user.click(
      within(bench).getByRole("checkbox", { name: "전원 공급" }),
    );
    await user.click(
      within(bench).getByRole("button", { name: "내부 손잡이 누르기" }),
    );
  }
  await user.click(
    within(bench).getByRole("button", { name: "조사 결과 확인" }),
  );
  await within(bench).findByText("✓ 직접 조사 완료");
  await user.click(within(bench).getByRole("button", { name: "닫기" }));
}

async function reconstructPaper(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
) {
  for (let target = 0; target < restoredPaperOrder.length; target++) {
    const slots = [
      ...dialog.querySelectorAll<HTMLButtonElement>(".shred-strip"),
    ];
    const source = slots.findIndex(
      (button) => button.dataset.piece === restoredPaperOrder[target],
    );
    if (source !== target) {
      await user.click(slots[source]);
      await user.click(slots[target]);
    }
  }
  await user.click(within(dialog).getByRole("button", { name: "복원 확인" }));
  await within(dialog).findByText("✓ 복원된 단서");
}

function delayedSaves() {
  let state = applyAction(freshProgress(), { type: "start" }).progress;
  for (const r of episodes[0].records)
    state = applyAction(state, { type: "pin", record: r.id }).progress;
  for (const action of investigationActions(1))
    state = applyAction(state, action).progress;
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

test("UI: answer edits stay immediate through slow saves and verification uses the latest answer with automatic evidence", async () => {
  const server = delayedSaves();
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game />);
  await user.click(await screen.findByRole("button", { name: "추리 노트" }));
  const card = document.getElementById("question-1-alias")!;
  assert.equal(within(card).queryByRole("checkbox"), null);
  assert.equal(within(card).queryByText("가설을 뒷받침하는 증거"), null);
  await user.click(within(card).getByRole("radio", { name: /우편함/ }));
  await user.click(within(card).getByRole("radio", { name: /계단참/ }));
  await user.click(within(card).getByRole("radio", { name: /햇살주방/ }));
  await user.click(within(card).getByRole("radio", { name: /계단참/ }));
  assert.ok(within(card).getByRole("radio", { name: /계단참/, checked: true }));
  assert.equal(server.requests.length, 1);
  await user.click(screen.getByRole("button", { name: /내 추리 검증하기/ }));
  await server.release(0);
  await server.release(1);
  await waitFor(() => assert.equal(server.requests[2]?.action.type, "solve"));
  await server.release(2);
  assert.deepEqual(server.state().solved, [1]);
  assert.deepEqual(
    new Set(server.state().drafts[1].alias.evidence),
    new Set(["1-2", "1-3"]),
  );
});

test("UI: failed answer saves retain the latest answer and retry before verification", async () => {
  const server = delayedSaves();
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game />);
  await user.click(await screen.findByRole("button", { name: "추리 노트" }));
  const card = document.getElementById("question-1-alias")!;
  await user.click(within(card).getByRole("radio", { name: /우편함/ }));
  await server.release(0, true);
  assert.ok(within(card).getByRole("radio", { name: /우편함/, checked: true }));
  const notes = screen.getByRole("dialog", { name: "추리 노트" });
  assert.equal(
    (
      within(notes).getByRole("button", {
        name: /내 추리 검증하기/,
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  await user.click(
    within(notes).getByRole("button", { name: "추리 다시 저장" }),
  );
  await server.release(1);
  await screen.findByText("자동 저장됨");
  assert.equal(server.state().drafts[1].alias.answer, "우편함");
  assert.equal(
    within(notes).queryByRole("button", { name: "추리 다시 저장" }),
    null,
  );
});

test("UI: legacy answers remain while the notebook automatically links the collected proof", async () => {
  let state = {
    ...freshProgress(),
    active: 8,
    started: true,
    solved: [1, 2, 3, 4, 5, 6, 7],
    introduced: [1, 2, 3, 4, 5, 6, 7, 8],
    read: allRecords.map((r) => r.id),
    pinned: allRecords.map((r) => r.id),
    notes: { 1: "이전 메모" },
    drafts: {
      8: { money: { answer: walkthrough[7].money[0], evidence: ["8-1"] } },
    },
  };
  globalThis.fetch = (async (
    _url: unknown,
    options?: { method?: string; body?: string },
  ) => {
    if (options?.method === "POST") {
      const result = applyAction(state, JSON.parse(options.body!));
      state = result.progress as typeof state;
      return Response.json({ ...gameView(state), feedback: result.feedback });
    }
    return Response.json(gameView(state));
  }) as typeof fetch;
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game />);
  await user.click(await screen.findByRole("button", { name: "추리 노트" }));
  const card = document.getElementById("question-8-money")!;
  assert.equal(within(card).getAllByRole("radio", { checked: true }).length, 1);
  assert.equal(within(card).queryByRole("checkbox"), null);
  await investigateCase(user, 8);
  await user.click(screen.getByRole("button", { name: /내 추리 검증하기/ }));
  await screen.findByText(
    "아직 사건을 해결하지 못했습니다. 모은 단서와 추리를 다시 검토해 주세요.",
  );
  assert.equal(within(card).queryByText("입증 완료"), null);
  assert.equal(state.solved.length, 7);
  assert.ok(state.drafts[8].money.evidence.length >= 3);
  assert.equal(state.notes[1], "이전 메모");
});

test("UI: failed verification reveals neither wrong questions nor partial success in the notebook and goals", async () => {
  dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
  const client = createLocalGameClient(() => dom.window.localStorage);
  await client.request({ type: "start" });
  for (const action of investigationActions(1)) await client.request(action);
  for (const [question, [answer]] of Object.entries(walkthrough[0]))
    await client.request({
      type: "draft",
      question,
      draft: {
        answer: question === "alias" ? "우편함" : answer,
        evidence: [],
      },
    });
  await client.request({
    type: "note",
    text: "내 가설은 스스로 다시 검토한다",
  });
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game client={client} />);
  await user.click(await screen.findByRole("button", { name: "해결 목표" }));
  const goalSnapshot = () =>
    screen
      .getByRole("dialog", { name: "현재 사건의 해결 목표" })
      .querySelector(".investigation-guide")!.innerHTML;
  const initialGoals = goalSnapshot();
  await user.click(
    within(
      screen.getByRole("dialog", { name: "현재 사건의 해결 목표" }),
    ).getByRole("button", { name: "닫기" }),
  );
  await user.click(screen.getByRole("button", { name: "추리 노트" }));
  const failure =
    "아직 사건을 해결하지 못했습니다. 모은 단서와 추리를 다시 검토해 주세요.";
  const notebook = () => screen.getByRole("dialog", { name: "추리 노트" });
  const cards = () =>
    [...notebook().querySelectorAll(".deduction-card")].map(
      (card) => card.outerHTML,
    );
  const verifyFailure = async () => {
    const before = cards();
    const prepared = notebook()
      .querySelector(".submit-row p")!
      .textContent!.split("·")[0];
    await user.click(
      within(notebook()).getByRole("button", { name: /내 추리 검증하기/ }),
    );
    await within(notebook()).findByText(failure);
    assert.deepEqual(
      cards(),
      before,
      "question markup cannot disclose even a correct answer",
    );
    assert.equal(
      notebook().querySelector(".submit-row p")!.textContent!.split("·")[0],
      prepared,
    );
    assert.equal(
      notebook().querySelectorAll(".verdict, .deduction-card .feedback").length,
      0,
    );
    assert.equal(notebook().querySelectorAll(".feedback").length, 1);
    assert.equal(screen.queryByRole("dialog", { name: "사건 해결" }), null);
    await user.click(within(notebook()).getByRole("button", { name: "닫기" }));
    await user.click(screen.getByRole("button", { name: "해결 목표" }));
    assert.equal(
      goalSnapshot(),
      initialGoals,
      "goals and recommended question cannot identify a wrong answer",
    );
    await user.click(
      within(
        screen.getByRole("dialog", { name: "현재 사건의 해결 목표" }),
      ).getByRole("button", { name: "닫기" }),
    );
    await user.click(screen.getByRole("button", { name: "추리 노트" }));
  };
  await verifyFailure();
  const alias = document.getElementById("question-1-alias")!;
  const meeting = document.getElementById("question-1-meeting")!;
  await user.click(within(alias).getByRole("radio", { name: /계단참/ }));
  assert.equal(within(notebook()).queryByText(failure), null);
  const otherPlace = episodes[0].questions
    .find((q) => q.id === "meeting")!
    .options!.find((option) => option !== walkthrough[0].meeting[0])!;
  await user.click(
    within(meeting).getByRole("radio", { name: new RegExp(otherPlace) }),
  );
  await verifyFailure();
  assert.equal((await client.request()).progress.attempts[1], 2);
  await user.click(
    within(document.getElementById("question-1-meeting")!).getByRole("radio", {
      name: /동문 건너편 달빛세탁소/,
    }),
  );
  await user.click(
    within(notebook()).getByRole("button", { name: /내 추리 검증하기/ }),
  );
  const resolution = await screen.findByRole("dialog", { name: "사건 해결" });
  await user.click(within(resolution).getByRole("button", { name: "닫기" }));
  assert.equal(notebook().querySelectorAll(".verdict.correct").length, 3);
  assert.equal(within(notebook()).queryByText(failure), null);
  const saved = (await client.request()).progress;
  assert.deepEqual(saved.solved, [1]);
  assert.equal(saved.notes[1], "내 가설은 스스로 다시 검토한다");
  dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
});

test("UI: goals stay in a modal and notebook questions appear only after sufficient evidence is collected", async () => {
  dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
  const client = createLocalGameClient(() => dom.window.localStorage);
  await client.request({ type: "start" });
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game client={client} />);
  await screen.findByRole("heading", { name: "은하아파트 주민마당" });
  assert.equal(
    screen.queryByRole("region", { name: "이번 사건의 해결 목표" }),
    null,
  );
  assert.equal(screen.queryByText(episodes[0].objective), null);
  await user.click(screen.getByRole("button", { name: "추리 노트" }));
  let notes = screen.getByRole("dialog", { name: "추리 노트" });
  assert.equal(notes.querySelectorAll(".deduction-card").length, 0);
  await user.click(within(notes).getByRole("button", { name: "닫기" }));
  for (const id of ["1-2", "1-7", "1-3"]) {
    await openSourceRecord(user, recordById(id)!);
    const record = screen.getByRole("dialog", { name: recordById(id)!.title });
    await waitFor(() => assert.ok(document.querySelector(".document-footer")));
    await user.click(
      within(record).getByRole("button", { name: "⌑ 증거 수집" }),
    );
    await waitFor(() =>
      assert.ok(within(record).getByRole("button", { name: "수집 해제" })),
    );
    await user.click(within(record).getByRole("button", { name: "닫기" }));
    await user.click(screen.getByRole("button", { name: "추리 노트" }));
    notes = screen.getByRole("dialog", { name: "추리 노트" });
    assert.equal(
      notes.querySelectorAll(".deduction-card").length,
      id === "1-3" ? 1 : 0,
    );
    assert.equal(within(notes).queryByRole("checkbox"), null);
    if (id !== "1-3")
      await user.click(within(notes).getByRole("button", { name: "닫기" }));
  }
  const card = document.getElementById("question-1-alias")!;
  await user.click(within(card).getByRole("radio", { name: /계단참/ }));
  await screen.findByText("자동 저장됨");
  await user.click(within(notes).getByRole("button", { name: "닫기" }));
  await openSourceRecord(user, recordById("1-2")!);
  let record = screen.getByRole("dialog", { name: recordById("1-2")!.title });
  await user.click(within(record).getByRole("button", { name: "수집 해제" }));
  await waitFor(() =>
    assert.ok(within(record).getByRole("button", { name: "⌑ 증거 수집" })),
  );
  await user.click(within(record).getByRole("button", { name: "닫기" }));
  await user.click(screen.getByRole("button", { name: "추리 노트" }));
  notes = screen.getByRole("dialog", { name: "추리 노트" });
  assert.equal(notes.querySelectorAll(".deduction-card").length, 0);
  assert.equal(
    (await client.request()).progress.drafts[1].alias.answer,
    "계단참",
  );
  await user.click(within(notes).getByRole("button", { name: "닫기" }));
  await openSourceRecord(user, recordById("1-2")!);
  record = screen.getByRole("dialog", { name: recordById("1-2")!.title });
  await user.click(within(record).getByRole("button", { name: "⌑ 증거 수집" }));
  await screen.findByText("자동 저장됨");
  await user.click(within(record).getByRole("button", { name: "닫기" }));
  await user.click(screen.getByRole("button", { name: "추리 노트" }));
  assert.ok(
    within(document.getElementById("question-1-alias")!).getByRole("radio", {
      name: /계단참/,
      checked: true,
    }),
  );
  await user.click(
    within(screen.getByRole("dialog", { name: "추리 노트" })).getByRole(
      "button",
      { name: "닫기" },
    ),
  );
  await user.click(screen.getByRole("button", { name: "해결 목표" }));
  const guide = screen.getByRole("dialog", { name: "현재 사건의 해결 목표" });
  assert.ok(within(guide).getByText(mainCase.question));
  assert.equal(guide.querySelectorAll(".goal-list li").length, 1);
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

test("UI: community search and pagination survive stacked workbench and original windows", async () => {
  dom.window.localStorage.removeItem(LOCAL_SAVE_KEY);
  const client = createLocalGameClient(() => dom.window.localStorage);
  await client.request({ type: "start" });
  const user = userEvent.setup({ document: dom.window.document });
  render(<Game client={client} />);
  await screen.findByRole("heading", { name: "은하아파트 주민마당" });
  await user.click(screen.getByRole("button", { name: "다음 글 →" }));
  const board = document.querySelector(".community-board");
  await user.click(screen.getByRole("button", { name: /^증거 보관함/ }));
  let cabinet = screen.getByRole("dialog", { name: "증거 보관함" });
  assert.ok(within(cabinet).getByText("아직 수집한 증거가 없습니다."));
  await user.click(within(cabinet).getByRole("button", { name: "닫기" }));
  assert.ok(screen.getByText(/2 \/ .* 페이지/));
  const post = recordById("1-7")!;
  await openSourceRecord(user, post);
  let record = screen.getByRole("dialog", { name: post.title });
  await user.click(within(record).getByRole("button", { name: /♡ 공감/ }));
  await screen.findByText("자동 저장됨");
  await user.click(within(record).getByRole("button", { name: "⌑ 증거 수집" }));
  await screen.findByText("자동 저장됨");
  await user.click(within(record).getByRole("button", { name: "닫기" }));
  await openSourceRecord(user, recordById("1-2")!);
  record = screen.getByRole("dialog", { name: recordById("1-2")!.title });
  await user.click(
    within(record).getByRole("button", { name: "직접 조사 열기 ↗" }),
  );
  const bench = screen.getByRole("dialog", { name: "삭제 전 알림 대조" });
  await user.click(
    within(bench).getByRole("button", { name: "원문 창에서 대조 ↗" }),
  );
  const reopened = screen.getByRole("dialog", {
    name: recordById("1-2")!.title,
  });
  assert.notEqual(record, reopened);
  await user.click(within(reopened).getByRole("button", { name: "닫기" }));
  assert.ok(screen.getByRole("dialog", { name: "삭제 전 알림 대조" }));
  await user.click(within(bench).getByRole("button", { name: "닫기" }));
  assert.equal(document.querySelector(".community-board"), board);
  assert.equal(
    (screen.getByRole("searchbox", { name: "기록 검색" }) as HTMLInputElement)
      .value,
    recordById("1-2")!.title,
  );
  await user.click(screen.getByRole("button", { name: /^증거 보관함/ }));
  cabinet = screen.getByRole("dialog", { name: "증거 보관함" });
  assert.ok(within(cabinet).getByRole("heading", { name: post.title }));
  assert.ok((await client.request()).progress.liked?.includes(post.id));
});

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
        if (r.id === "2-2") await compareCctv(user, dialog);
        if (r.shredded) {
          await reconstructPaper(user, dialog);
          assert.ok(within(dialog).getByText(r.shredded.transcript[0]));
        } else if (r.surveillance) {
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
      if (investigationWalkthrough[ep.id]) await investigateCase(user, ep.id);
      await click(screen.getByRole("button", { name: /내 추리 검증하기/ }));
      assert.equal(document.querySelectorAll(".verdict").length, 0);
      assert.ok(
        screen.getByText(
          "아직 사건을 해결하지 못했습니다. 모은 단서와 추리를 다시 검토해 주세요.",
        ),
      );
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
        const [answer] = walkthrough[ep.id - 1][q.id];
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
        assert.equal(within(card).queryByRole("checkbox"), null);
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
