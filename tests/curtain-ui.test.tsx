import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import CurtainGame from "../app/curtain/CurtainGame";
import GameCollection from "../app/GameCollection";
import { CURTAIN_SAVE_KEY, type CurtainState } from "../lib/curtain-game";
import {
  LOCAL_SAVE_KEY,
  createLocalGameClient,
} from "../lib/local-game-client";
import { curtainThrough } from "./curtain-walkthrough";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/#curtain-call",
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
const { render, screen, within, fireEvent, cleanup, act, waitFor } =
  await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
const saved = () =>
  JSON.parse(window.localStorage.getItem(CURTAIN_SAVE_KEY)!) as CurtainState;
const range = (name: string, value: number) =>
  fireEvent.change(screen.getByRole("slider", { name: new RegExp(name) }), {
    target: { value },
  });

test("Curtain UI: complete all five chapters through visible controls, restore drafts, and read both endings", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  window.localStorage.setItem(LOCAL_SAVE_KEY, "untouched board save");
  let mounted = render(<CurtainGame />);
  for (const name of [
    "카메라 켜기",
    "마지막 장면 확인하기",
    "내가 찍은 장면 조사하기",
  ])
    await user.click(screen.getByRole("button", { name: new RegExp(name) }));
  assert.equal(
    (screen.getByRole("button", { name: /다음 장으로/ }) as HTMLButtonElement)
      .disabled,
    true,
  );
  for (const name of [/F-07/, /A-02/, /조정실 · 이도윤/]) {
    await user.click(screen.getByRole("button", { name }));
    range("시야 확대", 1.8);
    await user.click(screen.getByRole("button", { name: "이 시야 기록하기" }));
  }
  await user.click(screen.getByRole("button", { name: /다음 장으로/ }));
  await user.click(screen.getByRole("button", { name: "막 걷기" }));
  await user.click(screen.getByRole("button", { name: "작업등 켜기" }));
  assert.ok(screen.getByRole("img", { name: /나무 관절/ }));
  range("의자 위치", 52);
  await user.click(screen.getByRole("button", { name: "막 다시 내리기" }));
  await user.click(screen.getByRole("button", { name: "공연 역광 켜기" }));
  await user.click(screen.getByRole("button", { name: "원본에 겹쳐 보기" }));
  await user.click(screen.getByRole("button", { name: /소리 대조/ }));
  range("녹음 시작점 이동", 1200);
  await user.click(screen.getByRole("button", { name: "두 트랙 대조하기" }));
  assert.equal(saved().findings.includes("audio"), false);
  await user.click(screen.getByRole("button", { name: "테이크 02" }));
  await user.click(screen.getByRole("button", { name: "두 트랙 대조하기" }));
  await user.click(screen.getByRole("button", { name: /다음 장으로/ }));
  await user.click(screen.getByRole("button", { name: "동선: 뒤 통로" }));
  assert.equal(
    (screen.getByRole("button", { name: "동선: 의자" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  await user.click(screen.getByRole("button", { name: "인사 직전 배치" }));
  await user.click(screen.getByRole("button", { name: "동선: 의자" }));
  await user.click(screen.getByRole("button", { name: "동선: 오른쪽 날개막" }));
  await user.click(screen.getByRole("button", { name: "이 동선 재현하기" }));
  await user.click(screen.getByRole("button", { name: /◇ 파편/ }));
  await user.click(screen.getByRole("button", { name: /정서경 황동/ }));
  let fragment = screen.getByRole("button", { name: "회수한 황동 파편" });
  for (let i = 0; i < 3; i++)
    fireEvent.keyDown(fragment, { key: "ArrowRight", shiftKey: true });
  for (let i = 0; i < 3; i++)
    fireEvent.keyDown(fragment, { key: "ArrowUp", shiftKey: true });
  await user.click(screen.getByRole("button", { name: "파편 왼쪽 회전" }));
  const draft = saved();
  mounted.unmount();
  mounted = render(<CurtainGame />);
  assert.deepEqual(saved().fragment, draft.fragment);
  await user.click(screen.getByRole("button", { name: /◇ 파편/ }));
  fragment = screen.getByRole("button", { name: "회수한 황동 파편" });
  assert.match(fragment.getAttribute("style")!, /47%/);
  await user.click(screen.getByRole("button", { name: "파편 왼쪽 회전" }));
  await user.click(screen.getByRole("button", { name: "절단면 맞춰 보기" }));
  assert.equal(saved().claspFit, true);
  assert.deepEqual(saved().fragment, { x: 50, y: 50, angle: 0 });
  await user.click(screen.getByRole("button", { name: "파편 오른쪽 회전" }));
  await user.click(screen.getByRole("button", { name: "절단면 맞춰 보기" }));
  assert.ok(screen.getByText(/아직 원본과 맞지 않습니다/));
  assert.equal(
    saved().claspFit,
    true,
    "previously recorded proof remains available",
  );
  await user.click(screen.getByRole("button", { name: "파편 왼쪽 회전" }));
  assert.equal(saved().findings.includes("contact"), false);
  await user.click(screen.getByRole("button", { name: "공연 전 착용" }));
  await user.click(screen.getByRole("button", { name: "인사 직전 착용" }));
  await user.click(screen.getByRole("button", { name: /↔ 위치/ }));
  range("촬영 구간", 1);
  range("촬영 구간", 2);
  await user.click(screen.getByRole("button", { name: /다음 장으로/ }));
  const drawing = screen.getByRole("button", { name: "옛 도면 조각" });
  for (let i = 0; i < 7; i++) fireEvent.keyDown(drawing, { key: "ArrowRight" });
  for (let i = 0; i < 6; i++) fireEvent.keyDown(drawing, { key: "ArrowUp" });
  await user.click(screen.getByRole("button", { name: "옛 도면 왼쪽 회전" }));
  await user.click(screen.getByRole("button", { name: "두 무대 대조하기" }));
  await user.click(screen.getByRole("button", { name: /계단 서랍/ }));
  assert.equal(screen.queryByRole("slider", { name: /덧붙인/ }), null);
  await user.click(screen.getByRole("button", { name: /세 칸 창문 서랍/ }));
  assert.equal(screen.getByText("정다은 作").getAttribute("aria-hidden"), "true");
  range("덧붙인 표지", 100);
  assert.equal(screen.getByText("정다은 作").getAttribute("aria-hidden"), "false");
  await user.click(screen.getByRole("button", { name: /다음 장으로/ }));
  await user.click(screen.getByRole("button", { name: /이도윤 음향 담당/ }));
  await user.click(
    screen.getByRole("button", { name: "이 인물로 사건 재현하기" }),
  );
  assert.equal(saved().solved, false);
  assert.ok(screen.getByText(/확인한 기록 전체를 설명하지 못합니다/));
  await user.click(screen.getByRole("button", { name: /정서경 무대감독/ }));
  await user.click(
    screen.getByRole("button", { name: "이 인물로 사건 재현하기" }),
  );
  assert.equal(saved().solved, true);
  await user.click(screen.getByRole("button", { name: "무대의 이름들" }));
  assert.equal(document.querySelectorAll("dialog").length, 0);
  assert.ok(screen.getByRole("heading", { name: "무대의 이름들" }));
  await user.click(screen.getByRole("button", { name: "다른 작별 보기" }));
  assert.ok(screen.getByRole("heading", { name: "하지 못한 인사" }));
  mounted.unmount();
  mounted = render(<CurtainGame />);
  assert.ok(screen.getByRole("heading", { name: "하지 못한 인사" }));
  await user.click(screen.getByRole("button", { name: "극장으로 돌아가기" }));
  assert.ok(screen.getByRole("button", { name: "무대의 이름들" }));
  assert.equal(saved().findings.length, 7);
  assert.equal(
    window.localStorage.getItem(LOCAL_SAVE_KEY),
    "untouched board save",
  );
  mounted.unmount();
});

test("Curtain UI: pointer dragging, capture cancellation and bounded movement share the keyboard coordinates", () => {
  window.localStorage.setItem(
    CURTAIN_SAVE_KEY,
    JSON.stringify({ ...curtainThrough(2), chapter: 3 }),
  );
  render(<CurtainGame />);
  fireEvent.click(screen.getByRole("button", { name: /◇ 파편/ }));
  const piece = screen.getByRole("button", { name: "회수한 황동 파편" });
  Object.defineProperty(piece.parentElement, "getBoundingClientRect", {
    value: () => new dom.window.DOMRect(100, 100, 400, 400),
  });
  const pointer = (type: string, x: number, y: number) => {
    const event = new dom.window.Event(type, { bubbles: true });
    Object.assign(event, {
      pointerId: 1,
      clientX: x,
      clientY: y,
      button: 0,
      isPrimary: true,
      pointerType: "touch",
    });
    fireEvent(piece, event);
  };
  pointer("pointerdown", 200, 300);
  pointer("pointermove", 308, 208);
  pointer("pointerup", 308, 208);
  assert.deepEqual(saved().fragment, { x: 50, y: 50, angle: 90 });
  pointer("pointermove", 400, 400);
  assert.equal(saved().fragment.x, 50);
  pointer("pointerdown", 200, 300);
  pointer("pointermove", 5000, -5000);
  pointer("pointercancel", 5000, -5000);
  assert.deepEqual(saved().fragment, { x: 90, y: 10, angle: 90 });
});

test("Curtain UI: unreadable saves are not overwritten, reset is confirmed, and the board key survives", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  window.localStorage.setItem(CURTAIN_SAVE_KEY, "invalid previous record");
  window.localStorage.setItem(LOCAL_SAVE_KEY, "old board");
  render(<CurtainGame />);
  assert.ok(screen.getByRole("alert"));
  assert.equal(screen.queryByRole("button", { name: /카메라 켜기/ }), null);
  await user.click(screen.getByRole("button", { name: "새 조사 시작" }));
  await user.click(
    within(screen.getByRole("dialog", { name: "새 조사 시작 확인" })).getByRole(
      "button",
      { name: "취소" },
    ),
  );
  assert.equal(
    window.localStorage.getItem(CURTAIN_SAVE_KEY),
    "invalid previous record",
  );
  await user.click(screen.getByRole("button", { name: "새 조사 시작" }));
  await user.click(screen.getByRole("button", { name: "진행 초기화" }));
  assert.ok(screen.getByRole("button", { name: /카메라 켜기/ }));
  assert.equal(window.localStorage.getItem(LOCAL_SAVE_KEY), "old board");
});

test("Collection: hash route opens the second game and the existing game keeps its own progress", async () => {
  window.localStorage.setItem(
    CURTAIN_SAVE_KEY,
    JSON.stringify(curtainThrough(1)),
  );
  window.history.replaceState(null, "", "#curtain-call");
  render(<GameCollection client={createLocalGameClient()} />);
  assert.ok(screen.getByRole("heading", { name: "박수가 끝난 자리" }));
  const previous = window.localStorage.getItem(CURTAIN_SAVE_KEY);
  await act(async () => {
    window.location.hash = "";
    window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
  });
  await waitFor(() => assert.ok(document.querySelector(".game-library")));
  assert.equal(window.localStorage.getItem(CURTAIN_SAVE_KEY), previous);
  assert.ok(screen.getByRole("link", { name: "삭제된 게시판" }));
  assert.ok(screen.getByRole("link", { name: "마지막 커튼콜" }));
});
