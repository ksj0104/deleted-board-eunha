import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import { renderToString } from "react-dom/server";
import GameCollection, { collectionRoute } from "../app/GameCollection";
import {
  createLocalGameClient,
  LOCAL_SAVE_KEY,
} from "../lib/local-game-client";
import { freshProgress } from "../lib/game";
import { CURTAIN_SAVE_KEY } from "../lib/curtain-game";
import { curtainThrough } from "./curtain-walkthrough";
import type { GameClient } from "../lib/game-client";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/",
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
  window.history.replaceState(null, "", "/");
});
const card = (title: string) =>
  within(screen.getByRole("link", { name: title }));

test("Collection: fresh visitors choose either game, can return during either prologue, and keep partial progress", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  render(<GameCollection client={createLocalGameClient()} />);
  assert.ok(
    screen.getByRole("heading", { name: "어떤 사건부터 열어 볼까요?" }),
  );
  await waitFor(() => assert.ok(card("삭제된 게시판").getByText("시작하기")));
  assert.ok(card("마지막 커튼콜").getByText("시작하기"));
  assert.equal(window.localStorage.getItem(LOCAL_SAVE_KEY), null);
  assert.equal(window.localStorage.getItem(CURTAIN_SAVE_KEY), null);
  await user.click(screen.getByRole("link", { name: "삭제된 게시판" }));
  await waitFor(() => assert.ok(document.querySelector(".story-prologue")));
  assert.equal(window.location.hash, "#deleted-board");
  await user.click(await screen.findByRole("link", { name: "다른 게임 선택" }));
  await waitFor(() => assert.ok(document.querySelector(".game-library")));
  assert.equal(window.localStorage.getItem(LOCAL_SAVE_KEY), null);
  await user.click(screen.getByRole("link", { name: "마지막 커튼콜" }));
  await waitFor(() => assert.ok(document.querySelector(".cc-intro")));
  await user.click(screen.getByRole("button", { name: /카메라 켜기/ }));
  const save = window.localStorage.getItem(CURTAIN_SAVE_KEY);
  await user.click(screen.getByRole("link", { name: /게임 선택 화면/ }));
  await waitFor(() => assert.ok(card("마지막 커튼콜").getByText("이어하기")));
  assert.ok(card("마지막 커튼콜").getByText("프롤로그 진행 중"));
  await user.click(screen.getByRole("link", { name: "마지막 커튼콜" }));
  await waitFor(() =>
    assert.ok(screen.getByRole("button", { name: /마지막 장면 확인하기/ })),
  );
  assert.equal(window.localStorage.getItem(CURTAIN_SAVE_KEY), save);
  assert.equal(window.localStorage.getItem(LOCAL_SAVE_KEY), null);
});

test("Collection: both existing saves resume, summaries refresh on return, and the board skip link keeps the same game mounted", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  const boardSave = JSON.stringify({
    ...freshProgress(),
    started: true,
    active: 3,
    solved: [1, 2],
    introduced: [1, 2, 3],
    notes: { 3: "이전 조사 메모" },
  });
  const curtainSave = JSON.stringify(curtainThrough(2));
  window.localStorage.setItem(LOCAL_SAVE_KEY, boardSave);
  window.localStorage.setItem(CURTAIN_SAVE_KEY, curtainSave);
  render(<GameCollection client={createLocalGameClient()} />);
  await waitFor(() =>
    assert.ok(card("삭제된 게시판").getByText(/2 \/ 8 사건 해결/)),
  );
  assert.ok(card("마지막 커튼콜").getByText(/2 \/ 5장 조사 완료/));
  await user.click(screen.getByRole("link", { name: "삭제된 게시판" }));
  await waitFor(() => assert.ok(document.querySelector(".community-board")));
  const board = document.querySelector(".community-board");
  await act(async () => {
    window.location.hash = "#main";
    window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
  });
  assert.equal(document.querySelector(".community-board"), board);
  await user.click(screen.getByRole("link", { name: /게임 선택 화면/ }));
  await waitFor(() => assert.ok(document.querySelector(".game-library")));
  await user.click(screen.getByRole("link", { name: "마지막 커튼콜" }));
  await waitFor(() =>
    assert.ok(screen.getByRole("heading", { name: "인사한 것은 누구인가" })),
  );
  assert.equal(window.localStorage.getItem(LOCAL_SAVE_KEY), boardSave);
  assert.equal(window.localStorage.getItem(CURTAIN_SAVE_KEY), curtainSave);
  await user.click(screen.getByRole("link", { name: /게임 선택 화면/ }));
  await waitFor(() => assert.ok(document.querySelector(".game-library")));
  await act(async () => {
    window.history.back();
  });
  await waitFor(() =>
    assert.ok(screen.getByRole("heading", { name: "인사한 것은 누구인가" })),
  );
  await act(async () => {
    window.history.forward();
  });
  await waitFor(() => assert.ok(document.querySelector(".game-library")));
  assert.match(document.title, /추리 게임 모음/);
});

test("Collection: completion badges and cross-tab changes refresh without changing either save", async () => {
  const boardSave = JSON.stringify({
    ...freshProgress(),
    started: true,
    active: 8,
    solved: [1, 2, 3, 4, 5, 6, 7, 8],
    ending: "public",
  });
  const curtainSave = JSON.stringify(curtainThrough(5));
  render(<GameCollection client={createLocalGameClient()} />);
  await waitFor(() => assert.ok(card("삭제된 게시판").getByText("시작하기")));
  window.localStorage.setItem(LOCAL_SAVE_KEY, boardSave);
  window.localStorage.setItem(CURTAIN_SAVE_KEY, curtainSave);
  act(() =>
    window.dispatchEvent(
      new dom.window.StorageEvent("storage", { key: CURTAIN_SAVE_KEY }),
    ),
  );
  await waitFor(() =>
    assert.ok(card("삭제된 게시판").getByText("기록 다시 열기")),
  );
  assert.ok(card("마지막 커튼콜").getByText("극장 다시 열기"));
  assert.equal(
    document.querySelectorAll(".library-board .library-progress .done").length,
    8,
  );
  assert.equal(
    document.querySelectorAll(".library-curtain .library-progress .done")
      .length,
    5,
  );
  assert.equal(window.localStorage.getItem(LOCAL_SAVE_KEY), boardSave);
  assert.equal(window.localStorage.getItem(CURTAIN_SAVE_KEY), curtainSave);
});

test("Collection: malformed saves show a recoverable state and remain intact when returning from the game's error screen", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  window.localStorage.setItem(LOCAL_SAVE_KEY, "board damaged save");
  window.localStorage.setItem(CURTAIN_SAVE_KEY, "curtain damaged save");
  render(<GameCollection client={createLocalGameClient()} />);
  await waitFor(() =>
    assert.ok(card("삭제된 게시판").getByText(/저장 확인 필요/)),
  );
  assert.ok(card("마지막 커튼콜").getByText(/저장 확인 필요/));
  await user.click(screen.getByRole("link", { name: "삭제된 게시판" }));
  await waitFor(() => assert.ok(screen.getByRole("alert")));
  await user.click(screen.getByRole("link", { name: /게임 선택 화면/ }));
  await waitFor(() => assert.ok(document.querySelector(".game-library")));
  assert.equal(
    window.localStorage.getItem(LOCAL_SAVE_KEY),
    "board damaged save",
  );
  assert.equal(
    window.localStorage.getItem(CURTAIN_SAVE_KEY),
    "curtain damaged save",
  );
});

test("Collection: leaving the board waits for a pending memo write before showing the library", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  window.history.replaceState(null, "", "#deleted-board");
  window.localStorage.setItem(
    LOCAL_SAVE_KEY,
    JSON.stringify({ ...freshProgress(), started: true, introduced: [1] }),
  );
  const base = createLocalGameClient();
  let release!: () => void;
  let saving = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const client: GameClient = {
    storage: "browser",
    async request(action) {
      if (action?.type === "note") {
        saving = true;
        await gate;
      }
      return base.request(action);
    },
  };
  render(<GameCollection client={client} />);
  await waitFor(() => assert.ok(document.querySelector(".community-board")));
  await user.click(screen.getByRole("button", { name: /나의 메모/ }));
  fireEvent.change(screen.getByRole("textbox", { name: /메모/ }), {
    target: { value: "게임을 바꿔도 남아야 할 기록" },
  });
  await waitFor(() => assert.equal(saving, true));
  await user.click(screen.getByRole("link", { name: /게임 선택 화면/ }));
  assert.equal(window.location.hash, "#deleted-board");
  await act(async () => {
    release();
    await gate;
  });
  await waitFor(() => assert.ok(document.querySelector(".game-library")));
  assert.equal(
    JSON.parse(window.localStorage.getItem(LOCAL_SAVE_KEY)!).notes[1],
    "게임을 바꿔도 남아야 할 기록",
  );
});

test("Collection: direct routes and server rendering keep the landing page deterministic", () => {
  assert.equal(collectionRoute(""), "library");
  assert.equal(collectionRoute("#unknown"), "library");
  assert.equal(collectionRoute("#deleted-board"), "board");
  assert.equal(collectionRoute("#main"), "board");
  assert.equal(collectionRoute("#curtain-call"), "curtain");
  const html = renderToString(
    <GameCollection client={createLocalGameClient()} />,
  );
  assert.match(html, /game-library/);
  assert.match(html, /href="#deleted-board"/);
  assert.match(html, /href="#curtain-call"/);
  assert.doesNotMatch(html, /story-prologue|cc-intro/);
});
