import test from "node:test";
import assert from "node:assert/strict";
import type { RecordFile } from "../lib/cases";
import {
  highlightSearchText,
  matchesRecordSearch,
  recordSearchContexts,
  searchKeywords,
  type SearchPart,
} from "../lib/record-search";

const record = (update: Partial<RecordFile> = {}): RecordFile => ({
  id: "2-14",
  title: "동문 안내",
  author: "시설 담당자",
  board: "생활 정보",
  date: "03.20 10:00",
  paragraphs: ["공사는 다음 주에 시작합니다."],
  comments: [{ author: "세탁소", text: "우산을 맡겨 두었습니다." }],
  attachment: {
    title: "점검 명세",
    columns: ["장비", "상태"],
    rows: [["C2", "교체 대기"]],
  },
  ...update,
});
const plain = (parts: SearchPart[]) => parts.map((part) => part.text).join("");
const marked = (parts: SearchPart[]) =>
  parts.filter((part) => part.match).map((part) => part.text);

test("record search: blank queries preserve all records and whitespace/case/NFKC normalize into unique terms", () => {
  assert.deepEqual(searchKeywords(" \t\n　"), []);
  assert.equal(matchesRecordSearch(record(), searchKeywords("　")), true);
  assert.deepEqual(recordSearchContexts(record(), []), []);
  assert.deepEqual(searchKeywords("　Ｃ２ \t 동문\n c2　공사  "), [
    "c2",
    "동문",
    "공사",
  ]);
  assert.deepEqual(highlightSearchText("원래 글", []), [
    { text: "원래 글", match: false },
  ]);
});

test("record search: every keyword must occur, including when words are in different fields", () => {
  const value = record();
  for (const query of [
    "동문 공사",
    "공사 동문",
    "시설 생활",
    "세탁소 교체",
    "2-14 점검 C2",
  ])
    assert.equal(
      matchesRecordSearch(value, searchKeywords(query)),
      true,
      query,
    );
  assert.equal(
    matchesRecordSearch(value, searchKeywords("동문 보관함")),
    false,
  );
  assert.deepEqual(
    recordSearchContexts(value, searchKeywords("동문 보관함")),
    [],
  );
  assert.equal(
    matchesRecordSearch(
      record({
        title: "동",
        paragraphs: ["문"],
        comments: [],
        attachment: undefined,
      }),
      searchKeywords("동문"),
    ),
    false,
    "a keyword must not be fabricated by joining separate fields",
  );
});

test("record search: comment-only matches reveal the actual comment and its author", () => {
  const value = record({
    comments: [
      {
        author: "우편함",
        text: "가게 앞에서 기다렸고 초록우산은 의자 아래에 두었습니다.",
      },
    ],
  });
  const keywords = searchKeywords("우편함 초록우산");
  assert.equal(matchesRecordSearch(value, keywords), true);
  const contexts = recordSearchContexts(value, keywords);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].source, "댓글");
  assert.match(plain(contexts[0].parts), /의자 아래/);
  assert.deepEqual(marked(contexts[0].parts), ["우편함", "초록우산"]);
});

test("record search: attachment title, columns and cells are searchable with matching table context", () => {
  const value = record({
    attachment: {
      title: "지출 명세",
      columns: ["항목", "금액"],
      rows: [["배수관", "１２３원"]],
    },
  });
  const keywords = searchKeywords("지출 금액 배수관 123");
  assert.equal(matchesRecordSearch(value, keywords), true);
  const contexts = recordSearchContexts(value, keywords);
  assert.equal(contexts.length, 2);
  assert.ok(contexts.every((context) => context.source === "첨부"));
  assert.ok(
    contexts.some((context) => marked(context.parts).includes("배수관")),
  );
  assert.ok(
    contexts.some((context) => marked(context.parts).includes("１２３")),
  );
  assert.match(
    contexts.map((context) => plain(context.parts)).join(" "),
    /금액: １２３원/,
  );
});

test("record search: normalized hits highlight original full-width letters, ligatures and decomposed Korean", () => {
  const value = record({
    title: "ＡＢＣ의 문서",
    paragraphs: ["동문에서 찾은 ﬃ 코드와 ㄱㅏ 표기"],
  });
  const keywords = searchKeywords("abc 동문 FFI 가");
  assert.equal(matchesRecordSearch(value, keywords), true);
  assert.deepEqual(marked(highlightSearchText(value.title, keywords)), [
    "ＡＢＣ",
  ]);
  const parts = highlightSearchText(value.paragraphs[0], keywords);
  assert.equal(plain(parts), value.paragraphs[0]);
  assert.deepEqual(marked(parts), ["동문", "ﬃ", "ㄱㅏ"]);
});

test("record search: overlapping keywords preserve source characters exactly once", () => {
  const text = "공사비와 공사 일정을 확인합니다.";
  const parts = highlightSearchText(text, searchKeywords("공사 공사비 사비"));
  assert.equal(plain(parts), text);
  assert.deepEqual(marked(parts), ["공사비", "공사"]);
});

test("record search: a title hit is highlighted while snippets prioritize words hidden in comments", () => {
  const value = record({
    paragraphs: [
      "동문에 관한 이야기입니다.",
      "동문 게시판에 안내를 붙였습니다.",
    ],
    comments: [{ author: "이웃", text: "지난번 누수 흔적도 확인해 주세요." }],
  });
  assert.deepEqual(recordSearchContexts(value, searchKeywords("생활")), []);
  assert.deepEqual(
    marked(highlightSearchText(value.title, searchKeywords("동문"))),
    ["동문"],
  );
  const contexts = recordSearchContexts(value, searchKeywords("동문 누수"));
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].source, "댓글");
  assert.deepEqual(marked(contexts[0].parts), ["누수"]);
});

test("record search: two distant body matches receive short contexts centered on the actual matches", () => {
  const value = record({
    title: "긴 메모",
    paragraphs: [
      "앞부분의 일상. ".repeat(30) +
        "동문을 지나왔습니다. " +
        "한동안 이어진 이야기. ".repeat(30) +
        "공사가 끝났습니다. " +
        "뒷부분의 일상. ".repeat(30),
    ],
  });
  const contexts = recordSearchContexts(value, searchKeywords("동문 공사"));
  assert.equal(contexts.length, 2);
  assert.ok(contexts.every((context) => context.source === "본문"));
  assert.ok(contexts.every((context) => plain(context.parts).length <= 100));
  assert.deepEqual(
    contexts.flatMap((context) => marked(context.parts)),
    ["동문", "공사"],
  );
  assert.ok(contexts.every((context) => plain(context.parts).startsWith("…")));
});

test("record search: markup and regex punctuation remain literal text, never generated HTML", () => {
  const text =
    '<script>alert("동문")</script> & [공사] <img src=x onerror=alert(1)>';
  const keywords = searchKeywords("동문 [공사] onerror");
  const value = record({ paragraphs: [text] });
  const parts = highlightSearchText(text, keywords);
  assert.equal(plain(parts), text);
  assert.deepEqual(marked(parts), ["동문", "[공사]", "onerror"]);
  assert.equal(matchesRecordSearch(value, searchKeywords("[없는말]")), false);
  const contexts = recordSearchContexts(value, keywords);
  assert.equal(contexts.length, 1);
  assert.equal(plain(contexts[0].parts), text);
  assert.ok(
    contexts[0].parts.every(
      (part) =>
        typeof part.text === "string" && typeof part.match === "boolean",
    ),
  );
  assert.equal(plain(parts).includes("<mark"), false);
});

test("record search: clipping retains whole emoji graphemes around matches", () => {
  const family = "👨‍👩‍👧‍👦";
  const value = record({
    title: "사진 이야기",
    paragraphs: [family.repeat(25) + "동문 공사" + family.repeat(25)],
  });
  const [context] = recordSearchContexts(value, searchKeywords("동문 공사"));
  assert.deepEqual(marked(context.parts), ["동문", "공사"]);
  const withoutCompleteGraphemes = plain(context.parts)
    .replaceAll(family, "")
    .replaceAll("…", "");
  assert.equal(withoutCompleteGraphemes, "동문 공사");
});
