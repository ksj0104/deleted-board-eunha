import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { useState } from "react";
import { Dialog } from "../app/components";

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
const { render, screen, within, cleanup, fireEvent } =
  await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
afterEach(() => cleanup());

function TestWindow({ label = "기록 창" }: { label?: string }) {
  const [open, setOpen] = useState(true);
  return open ? (
    <Dialog label={label} onClose={() => setOpen(false)}>
      <p>드래그해서 읽을 기록</p>
      <p>대조할 두 번째 문장</p>
      <textarea aria-label="임시 메모" defaultValue="보관할 메모" />
    </Dialog>
  ) : null;
}

function windowElements(label = "기록 창") {
  const dialog = screen.getByRole("dialog", { name: label });
  // jsdom has no layout; model the border box, including padding/scrollbar.
  Object.defineProperty(dialog, "getBoundingClientRect", {
    value: () => new dom.window.DOMRect(100, 100, 400, 300),
  });
  return {
    dialog,
    text: within(dialog).getByText("드래그해서 읽을 기록"),
    second: within(dialog).getByText("대조할 두 번째 문장"),
  };
}

function point(clientX: number, clientY: number, pointerType = "mouse") {
  return {
    clientX,
    clientY,
    pointerType,
    pointerId: 1,
    isPrimary: true,
    button: 0,
  };
}

test("dialog: selecting text across content or dragging out of the window keeps the window and memo open", () => {
  for (const pointerType of ["mouse", "touch", "pen"]) {
    for (const finish of ["content", "backdrop"]) {
      render(<TestWindow />);
      const { dialog, text, second } = windowElements();
      const end = point(finish === "backdrop" ? 550 : 250, 220, pointerType);
      fireEvent.pointerDown(text, point(180, 180, pointerType));
      fireEvent.pointerMove(finish === "backdrop" ? dialog : second, end);
      fireEvent.pointerUp(finish === "backdrop" ? dialog : second, end);
      // The compatibility click can target the common ancestor of down/up.
      fireEvent.click(dialog, end);
      assert.equal(screen.queryByRole("dialog", { name: "기록 창" }), dialog);
      const memo = within(dialog).getByRole("textbox", { name: "임시 메모" });
      assert.ok("value" in memo);
      assert.equal(memo.value, "보관할 메모");
      assert.equal(document.body.style.overflow, "hidden");
      cleanup();
    }
  }
});

test("dialog: padding, scrollbar drags and gestures that cross into the window are not backdrop clicks", () => {
  const gestures = [
    { start: point(110, 110), moves: [], end: point(110, 110) },
    { start: point(499, 130), moves: [point(499, 280)], end: point(499, 280) },
    { start: point(550, 180), moves: [point(490, 180)], end: point(490, 180) },
    { start: point(550, 180), moves: [point(600, 220)], end: point(600, 220) },
    { start: point(550, 180), moves: [point(600, 220)], end: point(550, 180) },
  ];
  for (const { start, moves, end } of gestures) {
    render(<TestWindow />);
    const { dialog } = windowElements();
    fireEvent.pointerDown(dialog, start);
    for (const move of moves) fireEvent.pointerMove(dialog, move);
    fireEvent.pointerUp(dialog, end);
    fireEvent.click(dialog, end);
    assert.equal(screen.queryByRole("dialog", { name: "기록 창" }), dialog);
    cleanup();
  }
});

test("dialog: cancelled, native drag and non-primary gestures cannot close the window", () => {
  for (const interruption of ["cancel", "drag", "secondary", "other-pointer"]) {
    render(<TestWindow />);
    const { dialog } = windowElements();
    const outside = point(550, 180);
    fireEvent.pointerDown(
      dialog,
      interruption === "secondary" ? { ...outside, button: 2 } : outside,
    );
    if (interruption === "cancel") fireEvent.pointerCancel(dialog, outside);
    if (interruption === "drag") fireEvent.dragStart(dialog);
    if (interruption === "other-pointer")
      fireEvent.pointerDown(dialog, {
        ...outside,
        pointerId: 2,
        isPrimary: false,
      });
    fireEvent.pointerUp(dialog, outside);
    fireEvent.click(dialog, outside);
    assert.equal(screen.queryByRole("dialog", { name: "기록 창" }), dialog);
    cleanup();
  }
});

test("dialog: a deliberate backdrop click closes only the top window and restores scrolling after the last close", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  document.body.style.overflow = "auto";
  render(
    <>
      <TestWindow label="추리 노트" />
      <TestWindow label="증거 원문" />
    </>,
  );
  const { dialog } = windowElements("증거 원문");
  const outside = point(550, 180);
  fireEvent.pointerDown(dialog, outside);
  fireEvent.pointerMove(dialog, point(552, 181));
  fireEvent.pointerUp(dialog, point(552, 181));
  fireEvent.click(dialog, point(552, 181));
  assert.equal(screen.queryByRole("dialog", { name: "증거 원문" }), null);
  const notes = screen.getByRole("dialog", { name: "추리 노트" });
  assert.equal(document.body.style.overflow, "hidden");
  await user.click(within(notes).getByRole("button", { name: "닫기" }));
  assert.equal(screen.queryByRole("dialog"), null);
  assert.equal(document.body.style.overflow, "auto");
  document.body.style.overflow = "";
});

test("dialog: keyboard close and Escape still dismiss the window", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  render(<TestWindow />);
  screen.getByRole("button", { name: "닫기" }).focus();
  await user.keyboard("{Enter}");
  assert.equal(screen.queryByRole("dialog"), null);
  cleanup();
  render(<TestWindow />);
  fireEvent(
    screen.getByRole("dialog"),
    new dom.window.Event("cancel", { cancelable: true }),
  );
  assert.equal(screen.queryByRole("dialog"), null);
});
