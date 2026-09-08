import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { useState } from "react";
import type { RecordFile } from "../lib/cases";
import {
  applyAction,
  freshProgress,
  gameView,
  type Progress,
} from "../lib/game";
import { communityRecords } from "../lib/world";
import EvidencePicker from "../app/EvidencePicker";
import CommunityBoard from "../app/CommunityBoard";

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
const { render, screen, within, fireEvent, cleanup, waitFor } =
  await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");

afterEach(() => cleanup());

const records: RecordFile[] = [
  {
    id: "1-1",
    title: "주민 게시판 공지",
    author: "관리사무소",
    date: "03.19 09:00",
    board: "공지사항",
    paragraphs: ["현관 게시판을 점검합니다."],
  },
  {
    id: "1-3",
    title: "봉투 안의 회신",
    author: "자료 담당자",
    date: "03.19 09:10",
    board: "회신 자료",
    paragraphs: ["검침 바늘이 멈춘 시각을 적었습니다."],
    comments: [{ author: "회신 확인자", text: "파란 우편함에서 받았습니다." }],
    attachment: {
      title: "점검 명세",
      columns: ["장비 번호"],
      rows: [["ZEBRA-204"]],
    },
  },
  ...Array.from({ length: 17 }, (_, index) => ({
    id: `1-${index + 7}`,
    title: `이웃의 기록 ${index + 1}`,
    author: `이웃 ${index + 1}`,
    date: "03.19 10:00",
    board: "일상 이야기",
    paragraphs: [`오늘 남긴 메모 ${index + 1}`],
  })),
];

function Picker({
  initial = [],
  minimum = 2,
  maximum = minimum,
  disabled = false,
  collection = records,
  onRead = () => {},
  onCollect = () => {},
}: {
  initial?: string[];
  minimum?: number;
  maximum?: number;
  disabled?: boolean;
  collection?: RecordFile[];
  onRead?: (record: RecordFile) => void;
  onCollect?: () => void;
}) {
  const [selected, setSelected] = useState(initial);
  return (
    <EvidencePicker
      records={collection}
      selectedIds={selected}
      minimum={minimum}
      maximum={maximum}
      disabled={disabled}
      onRead={onRead}
      onCollect={onCollect}
      onToggle={(id) =>
        setSelected((current) =>
          current.includes(id)
            ? current.filter((value) => value !== id)
            : [...current, id],
        )
      }
    />
  );
}

const selectedCount = () =>
  screen.queryAllByRole("button", { name: /근거 연결 해제$/ }).length;
const selectValue = (element: HTMLElement) => {
  assert.equal(element.tagName, "SELECT");
  assert.ok("value" in element);
  return element.value;
};

test("evidence picker: saved selections remain visible while the collection is collapsed or filtered out", async () => {
  const opened: string[] = [];
  const user = userEvent.setup({ document: dom.window.document });
  render(
    <Picker initial={["1-3"]} onRead={(record) => opened.push(record.id)} />,
  );
  assert.equal(screen.queryByRole("checkbox"), null);
  assert.equal(selectedCount(), 1);
  await user.click(
    screen.getByRole("button", {
      name: "봉투 안의 회신 선택한 증거 원문 읽기",
    }),
  );
  assert.deepEqual(opened, ["1-3"]);
  await user.click(screen.getByRole("button", { name: "증거 찾기" }));
  assert.equal(screen.getAllByRole("checkbox").length, 8);
  const search = screen.getByRole("searchbox", { name: "수집한 증거 검색" });
  fireEvent.change(search, { target: { value: "검침 바늘" } });
  assert.equal(screen.getAllByRole("checkbox").length, 1);
  await user.selectOptions(
    screen.getByRole("combobox", { name: "증거 출처" }),
    "public",
  );
  assert.equal(screen.queryByRole("checkbox"), null);
  assert.ok(screen.getByText("일치하는 증거가 없습니다."));
  assert.equal(
    selectedCount(),
    1,
    "source filters never conceal selected proof",
  );
  assert.ok(screen.getByRole("list", { name: "연결한 증거" }));
  await user.click(
    screen.getByRole("button", { name: /1-3 .*근거 연결 해제$/ }),
  );
  assert.equal(selectedCount(), 0);
  assert.equal((search as HTMLInputElement).value, "검침 바늘");
  assert.equal(
    document.activeElement,
    screen.getByRole("button", { name: "증거 찾기 접기" }),
  );
  await user.click(screen.getByRole("button", { name: "검색·출처 초기화" }));
  assert.equal(screen.getAllByRole("checkbox").length, 8);
});

test("evidence picker: search covers titles, bodies, authors, comments and attachments without ranking by the question", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  render(<Picker />);
  await user.click(screen.getByRole("button", { name: "증거 찾기" }));
  const search = screen.getByRole("searchbox", { name: "수집한 증거 검색" });
  for (const query of [
    "봉투 안의 회신",
    "검침 바늘",
    "자료 담당자",
    "회신 확인자",
    "파란 우편함",
    "점검 명세",
    "장비 번호",
    "zebra-204",
    "1-3",
  ]) {
    fireEvent.change(search, { target: { value: query } });
    assert.equal(screen.getAllByRole("checkbox").length, 1, query);
    assert.ok(
      screen.getByRole("checkbox", { name: "1-3 봉투 안의 회신" }),
      query,
    );
  }
  fireEvent.change(search, { target: { value: "" } });
  assert.deepEqual(
    screen
      .getAllByRole("checkbox")
      .map((checkbox) => checkbox.getAttribute("aria-label")),
    records.slice(0, 8).map((record) => `${record.id} ${record.title}`),
    "unfiltered results preserve the player's collection order",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "증거 출처" }),
    "inbox",
  );
  assert.equal(screen.getAllByRole("checkbox").length, 1);
  assert.ok(screen.getByRole("checkbox", { name: "1-3 봉투 안의 회신" }));
});

test("evidence picker: immediate selection enforces the maximum while selected proof can still be removed", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  render(<Picker minimum={1} maximum={2} />);
  await user.click(screen.getByRole("button", { name: "증거 찾기" }));
  assert.ok(screen.getByText("1~2개 선택"));
  const checkbox = (id: string) =>
    screen.getByRole("checkbox", {
      name: new RegExp(`^${id} `),
    }) as HTMLInputElement;
  await user.click(checkbox("1-1"));
  assert.equal(checkbox("1-1").checked, true);
  assert.equal(selectedCount(), 1);
  assert.equal(checkbox("1-7").disabled, false);
  await user.click(checkbox("1-3"));
  assert.equal(selectedCount(), 2);
  assert.equal(checkbox("1-7").disabled, true);
  assert.equal(checkbox("1-1").disabled, false);
  await user.click(checkbox("1-7"));
  assert.equal(selectedCount(), 2);
  await user.click(
    screen.getByRole("button", { name: /1-1 .*근거 연결 해제$/ }),
  );
  assert.equal(checkbox("1-1").checked, false);
  assert.equal(checkbox("1-7").disabled, false);
  await user.click(checkbox("1-7"));
  assert.equal(selectedCount(), 2);
  await user.click(screen.getByRole("button", { name: "증거 찾기 접기" }));
  assert.equal(screen.queryByRole("checkbox"), null);
  assert.equal(selectedCount(), 2);
});

test("evidence picker: keyboard disclosure, paging, checkbox and Escape retain usable focus", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  render(<Picker />);
  await user.tab();
  assert.equal(
    document.activeElement,
    screen.getByRole("button", { name: "증거 찾기" }),
  );
  await user.keyboard("{Enter}");
  await user.tab();
  const search = screen.getByRole("searchbox", { name: "수집한 증거 검색" });
  assert.equal(document.activeElement, search);
  await user.click(screen.getByRole("button", { name: "다음 증거 →" }));
  assert.equal(
    document.activeElement,
    screen.getByRole("group", { name: "증거 검색 결과" }),
  );
  assert.ok(screen.getByText("2 / 3 페이지"));
  await user.tab();
  const firstOnPage = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
  assert.equal(document.activeElement, firstOnPage);
  await user.keyboard(" ");
  assert.equal(firstOnPage.checked, true);
  assert.equal(selectedCount(), 1);
  fireEvent.change(search, { target: { value: "1-3" } });
  assert.equal(
    screen.queryByRole("navigation", { name: "증거 검색 결과 페이지" }),
    null,
  );
  search.focus();
  await user.keyboard("{Escape}");
  assert.equal(screen.queryByRole("searchbox"), null);
  assert.equal(
    document.activeElement,
    screen.getByRole("button", { name: "증거 찾기" }),
  );
  assert.equal(selectedCount(), 1);
  await user.keyboard("{Enter}");
  assert.equal(
    (
      screen.getByRole("searchbox", {
        name: "수집한 증거 검색",
      }) as HTMLInputElement
    ).value,
    "1-3",
    "reopening preserves the player's search",
  );
});

test("evidence picker: a blocking action disables edits but leaves source reading available", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  let reads = 0;
  render(<Picker initial={["1-3"]} disabled onRead={() => reads++} />);
  assert.equal(
    (
      screen.getByRole("button", {
        name: /근거 연결 해제$/,
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  await user.click(screen.getByRole("button", { name: "증거 찾기" }));
  assert.ok(
    screen
      .getAllByRole("checkbox")
      .every((element) => (element as HTMLInputElement).disabled),
  );
  await user.click(
    screen.getByRole("button", { name: "봉투 안의 회신 원문 읽기" }),
  );
  assert.equal(reads, 1);
});

test("evidence picker: an empty collection offers a direct return to collecting", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  let collected = false;
  render(
    <Picker
      collection={[]}
      onCollect={() => {
        collected = true;
      }}
    />,
  );
  assert.equal(screen.queryByRole("button", { name: "증거 찾기" }), null);
  await user.click(
    screen.getByRole("button", { name: "게시판에서 증거 수집하기 ↗" }),
  );
  assert.equal(collected, true);
});

const stageOne = (): Progress => ({ ...freshProgress(), started: true });
const rowTitles = (board: HTMLElement) =>
  [...board.querySelectorAll(".record-row strong")].map(
    (row) => row.textContent,
  );
const renderBoard = (progress: Progress) => (
  <CommunityBoard progress={progress} onOpen={() => {}} onStory={() => {}} />
);

test("community board: later stages queue new posts without replacing visible rows, pages or sidebar posts", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  const initial = stageOne();
  const advanced = { ...initial, active: 2, solved: [1] };
  const arrivals =
    communityRecords(advanced).length - communityRecords(initial).length;
  assert.ok(arrivals > 0);
  const view = render(renderBoard(initial));
  const board = screen.getByRole("region", { name: "은하아파트 주민 게시판" });
  await user.selectOptions(
    screen.getByRole("combobox", { name: "글 정렬" }),
    "comments",
  );
  await user.click(screen.getByRole("button", { name: "다음 글 →" }));
  const oldRows = rowTitles(board);
  const oldRail = board.querySelector(".community-rail")!.textContent;
  const oldPage = screen.getByRole("navigation", {
    name: "게시글 페이지",
  }).textContent;
  view.rerender(renderBoard(advanced));
  assert.equal(
    screen.getByRole("region", { name: "은하아파트 주민 게시판" }),
    board,
  );
  assert.deepEqual(rowTitles(board), oldRows);
  assert.equal(board.querySelector(".community-rail")!.textContent, oldRail);
  assert.equal(
    screen.getByRole("navigation", { name: "게시글 페이지" }).textContent,
    oldPage,
  );
  assert.equal(
    selectValue(screen.getByRole("combobox", { name: "글 정렬" })),
    "comments",
  );
  assert.ok(screen.getByRole("button", { name: `새 글 ${arrivals}개 반영` }));
  view.rerender(renderBoard({ ...advanced, active: 1 }));
  assert.deepEqual(
    rowTitles(board),
    oldRows,
    "visiting an earlier case does not accept waiting posts",
  );
  await user.click(
    screen.getByRole("button", { name: `새 글 ${arrivals}개 반영` }),
  );
  assert.ok(screen.getByText(`총 ${communityRecords(advanced).length}개의 글`));
  assert.equal(
    screen.queryByRole("button", { name: /^새 글 \d+개 반영$/ }),
    null,
  );
  assert.match(
    screen.getByRole("navigation", { name: "게시글 페이지" }).textContent!,
    /2 \/ /,
  );
  assert.equal(
    document.activeElement,
    within(board).getByRole("heading", { name: /이웃들의 이야기/ }),
  );
  const acceptedRows = rowTitles(board);
  view.rerender(renderBoard(advanced));
  assert.deepEqual(rowTitles(board), acceptedRows);
  view.rerender(renderBoard({ ...advanced, active: 1 }));
  assert.deepEqual(
    rowTitles(board),
    acceptedRows,
    "accepted posts survive revisiting earlier cases",
  );
});

test("community board: refreshing new posts preserves search, category, photo filtering and sorting", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  const initial = stageOne();
  const oldPhoto = communityRecords(initial).find((record) => record.photo)!;
  assert.ok(oldPhoto);
  const advanced = { ...initial, active: 2, solved: [1] };
  const view = render(renderBoard(initial));
  const board = screen.getByRole("region", { name: "은하아파트 주민 게시판" });
  await user.click(within(board).getByRole("button", { name: oldPhoto.board }));
  fireEvent.change(screen.getByRole("searchbox", { name: "기록 검색" }), {
    target: { value: oldPhoto.title },
  });
  await user.click(screen.getByRole("button", { name: "▧ 사진이 있는 글" }));
  await user.selectOptions(
    screen.getByRole("combobox", { name: "글 정렬" }),
    "oldest",
  );
  const before = rowTitles(board);
  assert.equal(before.length, 1);
  view.rerender(renderBoard(advanced));
  assert.deepEqual(rowTitles(board), before);
  await user.click(screen.getByRole("button", { name: /^새 글 \d+개 반영$/ }));
  assert.deepEqual(rowTitles(board), before);
  assert.equal(
    (screen.getByRole("searchbox", { name: "기록 검색" }) as HTMLInputElement)
      .value,
    oldPhoto.title,
  );
  assert.equal(
    within(board)
      .getByRole("button", { name: oldPhoto.board })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    screen
      .getByRole("button", { name: "▧ 사진이 있는 글" })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    selectValue(screen.getByRole("combobox", { name: "글 정렬" })),
    "oldest",
  );
  assert.ok(screen.getByText("1 / 1 페이지"));
});

test("community board: several arrivals accumulate, and only accessible public posts are accepted", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  const initial = stageOne();
  const view = render(renderBoard(initial));
  const board = screen.getByRole("region", { name: "은하아파트 주민 게시판" });
  const firstRows = rowTitles(board);
  view.rerender(renderBoard({ ...initial, active: 2, solved: [1] }));
  const latest = { ...initial, active: 3, solved: [1, 2] };
  view.rerender(renderBoard(latest));
  const count =
    communityRecords(latest).length - communityRecords(initial).length;
  assert.deepEqual(rowTitles(board), firstRows);
  await user.click(
    screen.getByRole("button", { name: `새 글 ${count}개 반영` }),
  );
  assert.ok(screen.getByText(`총 ${communityRecords(latest).length}개의 글`));
  fireEvent.change(screen.getByRole("searchbox", { name: "기록 검색" }), {
    target: { value: "3-2" },
  });
  assert.equal(
    rowTitles(board).length,
    0,
    "private reply records are never part of public arrivals",
  );
});

test("community board: an actual game reset clears the previous session's list, filters and page", async () => {
  const { default: Game } = await import("../app/Game");
  const user = userEvent.setup({ document: dom.window.document });
  let progress: Progress = {
    ...stageOne(),
    active: 1,
    solved: [1],
    introduced: [1, 2],
  };
  globalThis.fetch = (async (
    _url: unknown,
    options?: { method?: string; body?: string },
  ) => {
    if (options?.method === "POST") {
      const result = applyAction(progress, JSON.parse(options.body!));
      progress = result.progress;
      return Response.json({
        ...gameView(progress),
        feedback: result.feedback,
      });
    }
    return Response.json(gameView(progress));
  }) as typeof fetch;
  render(<Game />);
  const original = await screen.findByRole("region", {
    name: "은하아파트 주민 게시판",
  });
  await user.selectOptions(
    screen.getByRole("combobox", { name: "글 정렬" }),
    "oldest",
  );
  await user.click(screen.getByRole("button", { name: "다음 글 →" }));
  assert.match(
    screen.getByRole("navigation", { name: "게시글 페이지" }).textContent!,
    /2 \/ /,
  );
  fireEvent.change(screen.getByRole("searchbox", { name: "기록 검색" }), {
    target: { value: "남길 검색" },
  });
  const category = communityRecords(progress)[0].board;
  await user.click(within(original).getByRole("button", { name: category }));
  await user.click(screen.getByRole("button", { name: "▧ 사진이 있는 글" }));
  await user.click(screen.getByRole("button", { name: "사건 목록" }));
  await user.click(screen.getByRole("button", { name: "처음부터 다시 시작" }));
  const reset = screen.getByRole("dialog", { name: "새 게임 시작 확인" });
  await user.click(
    within(reset).getByRole("button", { name: "초기화하고 시작" }),
  );
  await waitFor(() => assert.equal(progress.started, false));
  const fresh = await screen.findByRole("region", {
    name: "은하아파트 주민 게시판",
  });
  assert.notEqual(fresh, original);
  assert.equal(
    (
      within(fresh).getByRole("searchbox", {
        name: "기록 검색",
      }) as HTMLInputElement
    ).value,
    "",
  );
  assert.equal(
    selectValue(within(fresh).getByRole("combobox", { name: "글 정렬" })),
    "newest",
  );
  assert.equal(
    within(fresh)
      .getByRole("button", { name: "전체" })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    within(fresh)
      .getByRole("button", { name: "▧ 사진이 있는 글" })
      .getAttribute("aria-pressed"),
    "false",
  );
  assert.match(
    within(fresh).getByRole("navigation", { name: "게시글 페이지" })
      .textContent!,
    /1 \/ /,
  );
  assert.ok(
    within(fresh).getByText(
      `총 ${communityRecords(freshProgress()).length}개의 글`,
    ),
  );
  assert.equal(
    within(fresh).queryByRole("button", { name: /^새 글 \d+개 반영$/ }),
    null,
  );
});
