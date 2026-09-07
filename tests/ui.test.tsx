import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import { episodes } from "../lib/cases";
import { freshProgress, applyAction, gameView, type Action } from "../lib/game";
import { walkthrough } from "./walkthrough";
import Game from "../app/Game";

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
const { render, screen, within, waitFor, cleanup, fireEvent } =
  await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
afterEach(() => cleanup());

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
    await user.click(
      await screen.findByRole("button", { name: "첫 번째 기록 열기 →" }),
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
    for (const ep of episodes) {
      assert.ok(screen.getByRole("heading", { name: ep.title, level: 1 }));
      const search = screen.getByRole("searchbox", { name: "기록 검색" });
      await user.type(search, "존재하지않는단어xyz");
      assert.ok(screen.getByText("일치하는 기록이 없습니다."));
      await user.clear(search);
      for (const r of ep.records) {
        const row = [
          ...document.querySelectorAll<HTMLButtonElement>(".record-row"),
        ].find((el) => el.textContent?.includes(r.title));
        assert.ok(row);
        await click(row);
        const dialog = screen.getByRole("dialog", { name: r.title });
        for (const paragraph of r.paragraphs)
          assert.ok(within(dialog).getByText(paragraph));
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
      await click(screen.getByRole("button", { name: "나의 메모" }));
      const note = screen.getByRole("textbox", { name: "사건 메모" });
      fireEvent.change(note, {
        target: { value: `화면에서 남긴 ${ep.id}화 메모` },
      });
      await user.click(screen.getByRole("button", { name: "메모 저장" }));
      await idle();
      assert.match(state.notes[ep.id], /화면에서 남긴/);
      await click(screen.getByRole("button", { name: "추리 노트" }));
      await click(screen.getByRole("button", { name: /세 가설 검증하기/ }));
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
        for (const id of evidence) {
          const label = [
            ...card.querySelectorAll<HTMLLabelElement>(".proof-options label"),
          ].find((l) => l.querySelector(".proof-id")?.textContent === id);
          assert.ok(label, `evidence ${id}`);
          await click(within(label).getByRole("checkbox"));
        }
      }
      await click(screen.getByRole("button", { name: /세 가설 검증하기/ }));
      assert.equal(state.solved.length, ep.id);
      const result = screen.getByRole("dialog", { name: "사건 해결" });
      await click(
        within(result).getByRole("button", {
          name:
            ep.id === 8
              ? "기록의 공개 범위 결정하기 →"
              : `사건 ${String(ep.id + 1).padStart(2, "0")} 열기 →`,
        }),
      );
    }
    await click(screen.getByRole("button", { name: /01 \/ 주민 공개/ }));
    assert.ok(screen.getByRole("heading", { name: "다시 열린 게시판" }));
    await click(screen.getByRole("button", { name: "다른 선택의 결말 읽기" }));
    assert.ok(screen.getByRole("heading", { name: "조용히 남은 원본" }));
    cleanup();
    render(<Game />);
    await screen.findByRole("heading", { name: episodes[7].title, level: 1 });
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
