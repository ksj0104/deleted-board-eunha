import { episodes, recordById } from "./cases";
import { solutions, resolutions, endings, type Solution } from "./solutions";
import { canReadRecord } from "./world";
import { evidenceLimit, evidenceSelectionLabel } from "./investigation";

export type Draft = { answer: string | string[]; evidence: string[] };
export type Progress = {
  version: 1;
  active: number;
  started: boolean;
  solved: number[];
  read: string[];
  pinned: string[];
  liked?: string[];
  introduced?: number[];
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
export type Feedback = Record<
  string,
  { answer: boolean; evidence: boolean; evidenceMessage?: string }
>;
export const freshProgress = (): Progress => ({
  version: 1,
  active: 1,
  started: false,
  solved: [],
  read: [],
  pinned: [],
  liked: [],
  introduced: [],
  notes: {},
  drafts: {},
  hints: {},
  attempts: {},
  ending: null,
});
export const unlocked = (p: Progress) =>
  Math.min(episodes.length, p.solved.length + 1);
const normalize = (v: string) =>
  v.normalize("NFKC").replace(/\s/g, "").toLowerCase();

function normalizedAnswer(value: string, format?: Solution["format"]) {
  const text = value.normalize("NFKC").trim();
  if (format === "digits") return /^\d{4}$/.test(text) ? text : null;
  if (format === "time")
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : null;
  if (format === "won") {
    const amount = text.replace(/\s/g, "").replace(/^₩/, "");
    const tenThousands = /^(\d+)만(?:원)?$/.exec(amount);
    if (tenThousands)
      return (BigInt(tenThousands[1]) * BigInt(10000)).toString();
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:원)?$/.test(amount)) return null;
    return BigInt(amount.replace(/[,원]/g, "")).toString();
  }
  return normalize(text);
}
export function grade(
  episode: number,
  drafts: Record<string, Draft>,
  pinned: string[],
): Feedback {
  const feedback: Feedback = {};
  if (!solutions[episode]) throw new Error("존재하지 않는 사건입니다.");
  for (const [id, expected] of Object.entries(solutions[episode])) {
    const draft = drafts[id];
    const question = episodes[episode - 1].questions.find((q) => q.id === id)!;
    const answer =
      !!draft &&
      (Array.isArray(expected.answer)
        ? Array.isArray(draft.answer) &&
          JSON.stringify(draft.answer) === JSON.stringify(expected.answer)
        : typeof draft.answer === "string" &&
          normalizedAnswer(draft.answer, expected.format) ===
            normalizedAnswer(expected.answer, expected.format));
    const selected = new Set(draft?.evidence ?? []);
    const allowed = new Set([
      ...expected.proof.flatMap((requirement) => requirement.sources.flat()),
      ...(expected.supportingEvidence ?? []),
    ]);
    let evidenceMessage: string | undefined;
    if (
      !draft ||
      selected.size !== draft.evidence.length ||
      [...selected].some((source) => !pinned.includes(source))
    ) {
      evidenceMessage = "수집한 자료를 중복 없이 근거로 연결해 주세요.";
    } else if (
      selected.size < question.evidenceCount ||
      selected.size > evidenceLimit(question)
    ) {
      evidenceMessage = `이 결론의 근거를 ${evidenceSelectionLabel(question)} 연결해 주세요. 개수만 채워도 입증되는 것은 아닙니다.`;
    } else if ([...selected].some((source) => !allowed.has(source))) {
      evidenceMessage =
        "선택한 자료 중 이 결론을 직접 뒷받침하지 않는 자료가 있습니다. 각 자료가 어느 사실을 확인하는지 검토해 주세요.";
    } else {
      const missing = expected.proof.filter(
        (requirement) =>
          !requirement.sources.some((alternative) =>
            alternative.every((source) => selected.has(source)),
          ),
      );
      evidenceMessage = missing.length
        ? missing
            .slice(0, 2)
            .map((requirement) => requirement.hint)
            .join(" ")
        : undefined;
    }
    feedback[id] = {
      answer,
      evidence: evidenceMessage === undefined,
      ...(evidenceMessage ? { evidenceMessage } : {}),
    };
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
  if (action.type === "start") {
    p.started = true;
    p.introduced = [...new Set([...(p.introduced ?? []), 1])];
  } else if (action.type === "intro")
    p.introduced = [...new Set([...(p.introduced ?? []), ep])];
  else if (action.type === "visit") p.active = ep;
  else if (
    action.type === "read" ||
    action.type === "pin" ||
    action.type === "like"
  ) {
    const r = recordById(action.record ?? "");
    if (!r || !canReadRecord(r, p))
      throw new Error("열람할 수 없는 기록입니다.");
    if (!p.read.includes(r.id)) p.read.push(r.id);
    if (action.type === "like")
      p.liked = (p.liked ?? []).includes(r.id)
        ? p.liked!.filter((id) => id !== r.id)
        : [...(p.liked ?? []), r.id];
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
      d.evidence.length > evidenceLimit(q)
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
