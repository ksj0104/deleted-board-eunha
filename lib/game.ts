import { episodes, recordById } from "./cases";
import { solutions, resolutions, endings } from "./solutions";

export type Draft = { answer: string | string[]; evidence: string[] };
export type Progress = {
  version: 1;
  active: number;
  started: boolean;
  solved: number[];
  read: string[];
  pinned: string[];
  notes: Record<string, string>;
  drafts: Record<string, Record<string, Draft>>;
  hints: Record<string, number>;
  attempts: Record<string, number>;
  ending: "public" | "audit" | null;
};
export type Action = {
  type: string;
  episode?: number;
  record?: string;
  question?: string;
  draft?: Draft;
  text?: string;
  ending?: string;
};
export type Feedback = Record<string, { answer: boolean; evidence: boolean }>;
export const freshProgress = (): Progress => ({
  version: 1,
  active: 1,
  started: false,
  solved: [],
  read: [],
  pinned: [],
  notes: {},
  drafts: {},
  hints: {},
  attempts: {},
  ending: null,
});
export const unlocked = (p: Progress) =>
  Math.min(episodes.length, p.solved.length + 1);
const normalize = (v: string) =>
  v
    .normalize("NFKC")
    .trim()
    .replace(/[\s,，원]/g, "")
    .toLowerCase();
export function grade(
  episode: number,
  drafts: Record<string, Draft>,
  pinned: string[],
): Feedback {
  const feedback: Feedback = {};
  for (const [id, expected] of Object.entries(solutions[episode])) {
    const draft = drafts[id];
    const answer =
      !!draft &&
      (Array.isArray(expected.answer)
        ? Array.isArray(draft.answer) &&
          JSON.stringify(draft.answer) === JSON.stringify(expected.answer)
        : typeof draft.answer === "string" &&
          normalize(draft.answer) === normalize(expected.answer));
    const evidence =
      !!draft &&
      draft.evidence.length === expected.evidence.length &&
      expected.evidence.every(
        (id) => draft.evidence.includes(id) && pinned.includes(id),
      );
    feedback[id] = { answer, evidence };
  }
  return feedback;
}
export function applyAction(
  current: Progress,
  action: Action,
): { progress: Progress; feedback?: Feedback } {
  const p: Progress = structuredClone(current);
  const ep = action.episode ?? p.active;
  if (!Number.isInteger(ep) || ep < 1 || ep > unlocked(p))
    throw new Error(
      "아직 열리지 않은 사건입니다. 앞 사건을 먼저 해결해 주세요.",
    );
  const e = episodes[ep - 1];
  if (action.type === "start") p.started = true;
  else if (action.type === "visit") p.active = ep;
  else if (action.type === "read" || action.type === "pin") {
    const r = recordById(action.record ?? "");
    if (!r || Number(r.id.split("-")[0]) > unlocked(p))
      throw new Error("열람할 수 없는 기록입니다.");
    if (!p.read.includes(r.id)) p.read.push(r.id);
    if (action.type === "pin") {
      p.pinned = p.pinned.includes(r.id)
        ? p.pinned.filter((id) => id !== r.id)
        : [...p.pinned, r.id];
      if (!p.pinned.includes(r.id))
        for (const drafts of Object.values(p.drafts))
          for (const draft of Object.values(drafts))
            draft.evidence = draft.evidence.filter((id) => id !== r.id);
    }
  } else if (action.type === "note") {
    if (typeof action.text !== "string" || action.text.length > 3000)
      throw new Error("메모는 3,000자까지 저장할 수 있습니다.");
    p.notes[ep] = action.text;
  } else if (action.type === "draft") {
    const q = e.questions.find((q) => q.id === action.question);
    const d = action.draft;
    if (
      !q ||
      !d ||
      !Array.isArray(d.evidence) ||
      !d.evidence.every(
        (id) => typeof id === "string" && p.pinned.includes(id),
      ) ||
      new Set(d.evidence).size !== d.evidence.length ||
      d.evidence.length > q.evidenceCount
    )
      throw new Error("수집한 증거에서 필요한 개수만 선택해 주세요.");
    if (q.kind === "order") {
      if (
        !Array.isArray(d.answer) ||
        d.answer.length !== q.options!.length ||
        new Set(d.answer).size !== q.options!.length ||
        !d.answer.every((v) => q.options!.includes(v))
      )
        throw new Error("순서 항목을 모두 한 번씩 배치해 주세요.");
    } else if (
      typeof d.answer !== "string" ||
      d.answer.length > 300 ||
      (q.kind === "choice" && d.answer !== "" && !q.options!.includes(d.answer))
    )
      throw new Error("답안 형식을 확인해 주세요.");
    p.drafts[ep] = { ...p.drafts[ep], [q.id]: structuredClone(d) };
  } else if (action.type === "hint")
    p.hints[ep] = Math.min(3, (p.hints[ep] ?? 0) + 1);
  else if (action.type === "solve") {
    const feedback = grade(ep, p.drafts[ep] ?? {}, p.pinned);
    p.attempts[ep] = (p.attempts[ep] ?? 0) + 1;
    if (
      Object.values(feedback).every((f) => f.answer && f.evidence) &&
      !p.solved.includes(ep)
    )
      p.solved.push(ep);
    return { progress: p, feedback };
  } else if (action.type === "ending") {
    if (
      p.solved.length !== 8 ||
      (action.ending !== "public" && action.ending !== "audit")
    )
      throw new Error("모든 사건을 해결한 뒤 공개 범위를 선택해 주세요.");
    p.ending = action.ending;
  } else if (action.type === "reset") return { progress: freshProgress() };
  else throw new Error("알 수 없는 요청입니다.");
  return { progress: p };
}
export function gameView(progress: Progress) {
  return {
    progress,
    resolutions: Object.fromEntries(
      progress.solved.map((id) => [id, resolutions[id]]),
    ),
    ending: progress.ending ? endings[progress.ending] : null,
  };
}
