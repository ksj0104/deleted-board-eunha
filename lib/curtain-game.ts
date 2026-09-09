// The second game has its own state and save key. It never touches the board game.
export const CURTAIN_SAVE_KEY = "eunha.last-curtain.progress.v1";
export const chapters = [
  {
    title: "박수가 끝난 자리",
    question: "누가 그의 얼굴을 보았을까?",
    why: "내 영상이 마지막 생존의 증거로 쓰이고 있다. 먼저 목격자들의 시야를 확인하자.",
  },
  {
    title: "인사한 것은 누구인가",
    question: "목소리와 그림자는 어디서 왔을까?",
    why: "얼굴을 본 사람은 없었다. 당시의 빛과 소리를 따로 재현해 보자.",
  },
  {
    title: "막 사이의 길",
    question: "누가 분장실과 무대를 오갔을까?",
    why: "녹음 재생은 원래 예정된 일이었다. 의자를 준비한 사람의 실제 이동을 찾아야 한다.",
  },
  {
    title: "지워진 이름",
    question: "왜 마지막 공연 날 다투었을까?",
    why: "분장실 앞에서 들린 말은 ‘이번에도 그 이름을 뺄 거예요?’였다. 옛 무대의 출처를 찾아보자.",
  },
  {
    title: "마지막 인사를 다시",
    question: "이 장면을 만든 사람은 누구인가?",
    why: "확인한 배치가 모두 무대에 돌아왔다. 접촉 흔적과 거짓 위치 설명을 함께 설명할 사람을 놓아 보자.",
  },
] as const;
export type Chapter = 1 | 2 | 3 | 4 | 5;
export const seats = ["front", "left", "booth"] as const;
export type Seat = (typeof seats)[number];
export const people = [
  {
    id: "seokyung",
    name: "정서경",
    role: "무대감독",
    quote: "인사 준비 내내 오른쪽 날개막에 있었어요.",
    mark: "황동 꽃 장식",
    cell: 3,
  },
  {
    id: "yuri",
    name: "오유리",
    role: "주연 배우",
    quote: "마지막 대사만 바꿨어요. 그날은 그렇게 말하고 싶었어요.",
    mark: "은색 타원 장식",
    cell: 4,
  },
  {
    id: "doyun",
    name: "이도윤",
    role: "음향 담당",
    quote: "낮에 받은 녹음이에요. 원래대로 틀었을 뿐이에요.",
    mark: "장식 없는 작업복",
    cell: -1,
  },
  {
    id: "eunju",
    name: "백은주",
    role: "의상 담당",
    quote: "낡은 옷은 버려도, 그 애가 쓴 건 못 버렸어요.",
    mark: "검정 사각 장식",
    cell: 5,
  },
] as const;
export type Person = (typeof people)[number]["id"];
export const findings = {
  sight: {
    icon: "◉",
    title: "얼굴 없는 목격",
    detail:
      "정면은 얇은 막 너머 윤곽만, 왼쪽은 세트 뒤 몸통만, 조정실은 멀리 있는 그림자만 보인다. 목소리로 한정우라고 짐작했을 뿐이다.",
  },
  shadow: {
    icon: "◐",
    title: "외투를 입힌 마네킹",
    detail:
      "현장에서 확보한 의자·마네킹·외투를 같은 위치에 두고 역광을 켜면 영상의 윤곽이 겹친다. 얼굴이나 움직임은 기록되지 않았다.",
  },
  audio: {
    icon: "≋",
    title: "재사용된 인사 녹음",
    detail:
      "낮 녹음과 공연 소리의 마이크 두드림·긁힘이 같은 간격과 모양이다. 한정우가 목 상태 때문에 미리 녹음한 인사였다. 이도윤의 재생 자체는 예정된 작업이다.",
  },
  route: {
    icon: "↝",
    title: "세트 뒤의 기존 통로",
    detail:
      "이동식 세트를 옮기면 분장실 → 뒤 통로 → 의자 → 오른쪽 날개막으로 이동할 수 있다. 객석에 몸을 드러낼 필요가 없다. 세트는 공연 전 사진보다 오른쪽으로 밀려 있다.",
  },
  contact: {
    icon: "◇",
    title: "분장실의 황동 파편",
    detail:
      "분장실에서 확보한 파편의 꽃잎 무늬와 불규칙한 절단면이 서경의 작업 외투 장식에 맞는다. 공연 전에는 온전했고, 인사 직전 오른쪽 날개막 영상에서는 파손되어 있다.",
  },
  position: {
    icon: "↔",
    title: "비어 있던 날개막",
    detail:
      "고정 카메라의 연속 구간에서 오른쪽 날개막은 21:02~21:08 비어 있다. 21:09 서경이 세트 뒤에서 돌아온다. ‘준비 내내 같은 자리’라는 설명과 맞지 않는다. 도윤은 조정실, 유리는 무대의 연속 영상에 남고, 은주는 수선대 카메라에 남는다.",
  },
  author: {
    icon: "✎",
    title: "정다은의 초고",
    detail:
      "옛 초고의 무대 그림이 현재 공연과 일치한다. 원본 봉투와 초고에는 정다은, 현재 프로그램에는 한정우만 적혀 있다. 백은주는 다은의 집필 과정을 직접 보았고 서경이 다은의 언니임을 확인했다.",
  },
} as const;
export type Finding = keyof typeof findings;
export type Placement = { x: number; y: number; angle: number };
export type CurtainState = {
  version: 1;
  started: boolean;
  intro: number;
  chapter: Chapter;
  seat: Seat;
  zoom: number;
  observed: Seat[];
  light: "back" | "work";
  scrim: boolean;
  chair: number;
  sawWood: boolean;
  take: "a" | "b" | "c";
  offset: number;
  panel: number;
  route: string[];
  frame: number;
  frames: number[];
  clasp: Person;
  fragment: Placement;
  claspFit: boolean;
  costumes: ("before" | "after")[];
  sketch: Placement;
  sketchFit: boolean;
  drawer: string;
  peel: number;
  findings: Finding[];
  accused: Person | null;
  solved: boolean;
  ending: "names" | "voices" | null;
  visited: string[];
};
export function initialCurtainState(): CurtainState {
  return {
    version: 1,
    started: false,
    intro: 0,
    chapter: 1,
    seat: "front",
    zoom: 1,
    observed: [],
    light: "back",
    scrim: true,
    chair: 27,
    sawWood: false,
    take: "a",
    offset: 0,
    panel: 20,
    route: ["room"],
    frame: 0,
    frames: [],
    clasp: "yuri",
    fragment: { x: 23, y: 73, angle: 90 },
    claspFit: false,
    costumes: [],
    sketch: { x: 36, y: 62, angle: 15 },
    sketchFit: false,
    drawer: "",
    peel: 0,
    findings: [],
    accused: null,
    solved: false,
    ending: null,
    visited: [],
  };
}
export const chapterNeeds: Record<Chapter, Finding[]> = {
  1: ["sight"],
  2: ["shadow", "audio"],
  3: ["route", "contact", "position"],
  4: ["author"],
  5: [],
};
export const chapterDone = (state: CurtainState, chapter: Chapter) =>
  chapter === 5
    ? state.solved
    : chapterNeeds[chapter].every((id) => state.findings.includes(id));
export const canOpenChapter = (state: CurtainState, chapter: Chapter) =>
  Array.from({ length: chapter - 1 }, (_, i) => (i + 1) as Chapter).every((c) =>
    chapterDone(state, c),
  );
const add = <T>(items: T[], item: T) =>
  items.includes(item) ? items : [...items, item];
const near = (a: number, b: number, tolerance = 4) =>
  Math.abs(a - b) <= tolerance;
export const fragmentFits = (state: CurtainState) =>
  state.clasp === "seokyung" &&
  near(state.fragment.x, 50) &&
  near(state.fragment.y, 50) &&
  state.fragment.angle % 360 === 0;
export const sketchFits = (state: CurtainState) =>
  near(state.sketch.x, 50) &&
  near(state.sketch.y, 50) &&
  state.sketch.angle % 360 === 0;
export const audioFits = (state: CurtainState) =>
  state.take === "b" && near(state.offset, 1200, 55);
export const shadowFits = (state: CurtainState) =>
  state.sawWood &&
  state.light === "back" &&
  state.scrim &&
  near(state.chair, 52, 3);
export const routeNodes = [
  { id: "room", x: 13, y: 23, label: "분장실" },
  { id: "rear", x: 34, y: 23, label: "뒤 통로" },
  { id: "chair", x: 54, y: 43, label: "의자" },
  { id: "wing", x: 84, y: 43, label: "오른쪽 날개막" },
  { id: "front", x: 54, y: 77, label: "무대 앞" },
] as const;
const links: Record<string, string[]> = {
  room: ["rear"],
  rear: ["room", "chair"],
  chair: ["rear", "wing", "front"],
  wing: ["chair", "front"],
  front: ["chair", "wing"],
};
export function canRoute(state: CurtainState, node: string) {
  const previous = state.route.at(-1)!;
  if (!links[previous]?.includes(node)) return false;
  if (
    [previous, node].includes("rear") &&
    [previous, node].includes("chair") &&
    state.panel < 78
  )
    return false;
  return true;
}
export const routeFits = (state: CurtainState) =>
  state.panel >= 78 && state.route.join(",") === "room,rear,chair,wing";
export type CurtainAction =
  | {
      type: "patch";
      value: Partial<
        Pick<
          CurtainState,
          | "seat"
          | "zoom"
          | "light"
          | "scrim"
          | "chair"
          | "take"
          | "offset"
          | "panel"
          | "clasp"
          | "fragment"
          | "sketch"
          | "accused"
          | "drawer"
        >
      >;
    }
  | { type: "intro" }
  | { type: "chapter"; chapter: Chapter }
  | { type: "observe" }
  | {
      type: "check";
      puzzle: "shadow" | "audio" | "route" | "clasp" | "sketch" | "final";
    }
  | { type: "route"; node: string }
  | { type: "reset-route" }
  | { type: "frame"; value: number }
  | { type: "costume"; value: "before" | "after" }
  | { type: "peel"; value: number }
  | { type: "ending"; value: CurtainState["ending"] }
  | { type: "visit"; value: string };
export function curtainReducer(
  state: CurtainState,
  action: CurtainAction,
): CurtainState {
  let next = { ...state };
  const earn = (id: Finding) => {
    next.findings = add(next.findings, id);
  };
  switch (action.type) {
    case "patch":
      next = { ...next, ...action.value };
      break;
    case "intro":
      next.intro = Math.min(3, state.intro + 1);
      next.started = next.intro === 3;
      break;
    case "chapter":
      if (canOpenChapter(state, action.chapter)) next.chapter = action.chapter;
      break;
    case "observe":
      if (state.zoom >= 1.6) next.observed = add(state.observed, state.seat);
      if (next.observed.length === 3) earn("sight");
      break;
    case "check":
      if (
        action.puzzle === "shadow" &&
        canOpenChapter(state, 2) &&
        shadowFits(state)
      ) {
        earn("shadow");
        next.chair = 52;
      }
      if (
        action.puzzle === "audio" &&
        canOpenChapter(state, 2) &&
        audioFits(state)
      ) {
        earn("audio");
        next.offset = 1200;
      }
      if (
        action.puzzle === "route" &&
        canOpenChapter(state, 3) &&
        routeFits(state)
      )
        earn("route");
      if (
        action.puzzle === "clasp" &&
        canOpenChapter(state, 3) &&
        fragmentFits(state)
      ) {
        next.claspFit = true;
        next.fragment = { x: 50, y: 50, angle: 0 };
      }
      if (
        action.puzzle === "sketch" &&
        canOpenChapter(state, 4) &&
        sketchFits(state)
      ) {
        next.sketchFit = true;
        next.sketch = { x: 50, y: 50, angle: 0 };
      }
      if (
        action.puzzle === "final" &&
        canOpenChapter(state, 5) &&
        state.accused === "seokyung"
      )
        next.solved = true;
      break;
    case "route":
      if (canRoute(state, action.node))
        next.route = state.route.includes(action.node)
          ? state.route.slice(0, state.route.indexOf(action.node) + 1)
          : [...state.route, action.node];
      break;
    case "reset-route":
      next.route = ["room"];
      break;
    case "frame":
      next.frame = action.value;
      next.frames = add(state.frames, action.value);
      break;
    case "costume":
      next.costumes = add(state.costumes, action.value);
      break;
    case "peel":
      if (state.sketchFit && state.drawer === "window")
        next.peel = action.value;
      break;
    case "ending":
      if (state.solved) next.ending = action.value;
      break;
    case "visit":
      next.visited = add(state.visited, action.value);
      break;
  }
  if (next.light === "work" && !next.scrim) next.sawWood = true;
  if (canOpenChapter(next, 3) && next.claspFit && next.costumes.length === 2)
    earn("contact");
  if (
    canOpenChapter(next, 3) &&
    next.frames.includes(1) &&
    next.frames.includes(2)
  )
    earn("position");
  if (
    canOpenChapter(next, 4) &&
    next.sketchFit &&
    next.drawer === "window" &&
    next.peel >= 85
  )
    earn("author");
  return next;
}

type StorageAccess = Pick<Storage, "getItem" | "setItem">;
type StorageSource = StorageAccess | (() => StorageAccess);
const storageFrom = (source: StorageSource) =>
  typeof source === "function" ? source() : source;
const finite = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
export function decodeCurtainSave(raw: string): CurtainState {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("invalid save");
  const s = value as CurtainState;
  const member = (items: readonly unknown[], v: unknown) => items.includes(v);
  const array = (v: unknown, items: readonly unknown[]) =>
    Array.isArray(v) &&
    v.length <= items.length &&
    new Set(v).size === v.length &&
    v.every((x) => member(items, x));
  const placement = (p: Placement) =>
    p &&
    finite(p.x, 0, 100) &&
    finite(p.y, 0, 100) &&
    finite(p.angle, -360, 360);
  if (
    s.version !== 1 ||
    ![s.started, s.scrim, s.sawWood, s.claspFit, s.sketchFit, s.solved].every(
      (x) => typeof x === "boolean",
    ) ||
    !member([0, 1, 2, 3], s.intro) ||
    !member([1, 2, 3, 4, 5], s.chapter) ||
    !member(seats, s.seat) ||
    !finite(s.zoom, 1, 2.6) ||
    !array(s.observed, seats) ||
    !member(["back", "work"], s.light) ||
    !finite(s.chair, 10, 90) ||
    !member(["a", "b", "c"], s.take) ||
    !finite(s.offset, 0, 2000) ||
    !finite(s.panel, 0, 100) ||
    !Array.isArray(s.route) ||
    s.route.length > 40 ||
    s.route[0] !== "room" ||
    !s.route.every((n) => n in links) ||
    !member([0, 1, 2], s.frame) ||
    !array(s.frames, [0, 1, 2]) ||
    !member(
      people.map((p) => p.id),
      s.clasp,
    ) ||
    !placement(s.fragment) ||
    !array(s.costumes, ["before", "after"]) ||
    !placement(s.sketch) ||
    !member(["", "stairs", "window", "chair"], s.drawer) ||
    !finite(s.peel, 0, 100) ||
    !array(s.findings, Object.keys(findings)) ||
    !member([null, ...people.map((p) => p.id)], s.accused) ||
    !member([null, "names", "voices"], s.ending) ||
    !array(s.visited, ["mug", "costume", "speaker"])
  )
    throw new Error("invalid save");
  if (
    !canOpenChapter(s, s.chapter) ||
    (s.solved && !canOpenChapter(s, 5)) ||
    (s.ending && !s.solved)
  )
    throw new Error("inconsistent save");
  return s;
}
export function loadCurtain(storage: StorageSource): {
  state: CurtainState;
  error: string;
  blocked: boolean;
} {
  try {
    const raw = storageFrom(storage).getItem(CURTAIN_SAVE_KEY);
    return {
      state: raw ? decodeCurtainSave(raw) : initialCurtainState(),
      error: "",
      blocked: false,
    };
  } catch {
    return {
      state: initialCurtainState(),
      error:
        "저장 기록을 읽지 못했습니다. 기존 기록은 보존했습니다. 다시 불러오거나 새 조사로 시작할 수 있습니다.",
      blocked: true,
    };
  }
}
export function saveCurtain(storage: StorageSource, state: CurtainState) {
  try {
    storageFrom(storage).setItem(CURTAIN_SAVE_KEY, JSON.stringify(state));
    return "";
  } catch {
    return "이번 조사는 아직 이 브라우저에 저장되지 않았습니다. 창을 닫기 전에 저장을 다시 시도해 주세요.";
  }
}
