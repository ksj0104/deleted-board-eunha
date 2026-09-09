import { allRecords, episodes, recordById } from "./cases";
import {
  isRestoredOrder,
  recordRestored,
  restorationFor,
  migrateRestorations,
  validPieceOrder,
  type Restoration,
} from "./restoration";
import { solutions, resolutions, endings, type Solution } from "./solutions";
import { canReadRecord } from "./world";
import {
  migrateRequests,
  requestMatches,
  missingRequestSources,
} from "./record-requests";
import { normalizeTime } from "./time-input";
import { automaticEvidence } from "./automatic-evidence";
import {
  investigationById,
  investigationForEpisode,
  investigationMatches,
  investigationReady,
  investigationState,
  validInvestigation,
  type InvestigationState,
} from "./fieldwork";
import { evidenceLimit, evidenceSelectionLabel } from "./investigation";
import {
  calibrationFor,
  comparisonMatches,
  comparisonReady,
  validOffset,
  type Calibration,
} from "./calibration";

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
  restorations?: Record<string, Restoration>;
  calibration?: Calibration;
  investigations?: Record<string, InvestigationState>;
  requested?: string[];
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
  pieces?: string[];
  offset?: number;
  investigation?: string;
  investigationState?: InvestigationState;
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
  restorations: {},
  calibration: { offset: 0, confirmed: false },
  investigations: {},
  requested: [],
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
  if (format === "time") return normalizeTime(text);
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
  const p: Progress = structuredClone(
    migrateRequests(migrateRestorations(current)),
  );
  p.calibration ??= calibrationFor(current);
  p.restorations ??= Object.fromEntries(
    allRecords
      .filter((record) => record.shredded && current.read.includes(record.id))
      .map((record) => [record.id, restorationFor(record, current)]),
  );
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
  else if (action.type === "request-record") {
    const missing = missingRequestSources(p, action.record ?? "");
    if (missing.length)
      throw new Error(
        `조회 전 원문 확인이 필요합니다: ${missing.map((id) => recordById(id)!.title).join(" · ")}`,
      );
    if (!action.record || !requestMatches(p, action.record, action.text))
      throw new Error(
        "조회 대상과 일치하는 기록이 없습니다. 입력한 식별 정보를 원문과 다시 대조해 주세요.",
      );
    p.requested = [...new Set([...p.requested!, action.record])];
  } else if (
    action.type === "investigate" ||
    action.type === "confirm-investigation"
  ) {
    const desk = investigationById(action.investigation ?? "");
    const state = action.investigationState;
    if (!desk || desk.episode !== ep || !validInvestigation(desk, state))
      throw new Error("조사대의 항목과 배치를 다시 확인해 주세요.");
    if (
      state.inspected.some(
        (id) =>
          !p.read.includes(desk.clues.find((clue) => clue.id === id)!.source),
      )
    )
      throw new Error(
        "원문을 먼저 열어 확인한 자료만 조사대에 놓을 수 있습니다.",
      );
    const confirm = action.type === "confirm-investigation";
    if (confirm && !investigationReady(p, desk))
      throw new Error(
        "아직 대조하지 않은 원문이 있습니다. 자료 목록에서 확인해 주세요.",
      );
    if (confirm && !investigationMatches(desk, state))
      throw new Error(
        "일부 연결이 원문과 맞지 않습니다. 출처와 항목의 대응을 다시 살펴보세요.",
      );
    if (!investigationState(p, desk).confirmed) {
      p.investigations ??= {};
      p.investigations[desk.id] = { ...state, confirmed: confirm };
      if (confirm)
        for (const id of desk.sources)
          if (!p.pinned.includes(id)) p.pinned.push(id);
    }
  } else if (action.type === "align" || action.type === "calibrate") {
    if (!canReadRecord(recordById("2-1")!, p) || !comparisonReady(p))
      throw new Error(
        "정문 작동 기록과 C2 보관 화면을 모두 읽은 뒤 대조해 주세요.",
      );
    if (!validOffset(action.offset))
      throw new Error("시간선은 한 칸씩, 표시된 범위 안에서 움직여 주세요.");
    if (action.type === "calibrate" && !comparisonMatches(action.offset))
      throw new Error(
        "세 동작이 아직 같은 시각에 놓이지 않았습니다. 문 상태와 동작 사이의 간격을 함께 대조해 주세요.",
      );
    if (!p.calibration.confirmed)
      p.calibration = {
        offset: action.offset,
        confirmed: action.type === "calibrate",
      };
  } else if (action.type === "arrange" || action.type === "restore") {
    const r = recordById(action.record ?? "");
    if (!r?.shredded || !canReadRecord(r, p))
      throw new Error("복원할 수 없는 기록입니다.");
    if (!validPieceOrder(r.shredded, action.pieces))
      throw new Error("회수한 조각을 빠짐없이 한 번씩 배치해 주세요.");
    if (
      action.type === "restore" &&
      !isRestoredOrder(r.shredded, action.pieces)
    )
      throw new Error(
        "아직 글줄이 이어지지 않습니다. 금액의 쉼표와 회신 문장의 연결을 살펴보세요.",
      );
    if (!recordRestored(r, p))
      p.restorations[r.id] = {
        order: [...action.pieces],
        complete: action.type === "restore",
      };
    if (!p.read.includes(r.id)) p.read.push(r.id);
  } else if (
    action.type === "read" ||
    action.type === "pin" ||
    action.type === "like"
  ) {
    const r = recordById(action.record ?? "");
    if (!r || !canReadRecord(r, p))
      throw new Error("열람할 수 없는 기록입니다.");
    if (action.type === "pin" && !recordRestored(r, p))
      throw new Error("종이 조각을 복원한 뒤 증거로 수집해 주세요.");
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
      throw new Error("저장할 답안과 수집 기록의 형식을 확인해 주세요.");
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
    const automaticDrafts = Object.fromEntries(
      e.questions.flatMap((q) => {
        const draft = p.drafts[ep]?.[q.id];
        return draft
          ? [
              [
                q.id,
                { ...draft, evidence: automaticEvidence(e, q, p.pinned) ?? [] },
              ],
            ]
          : [];
      }),
    );
    p.drafts[ep] = automaticDrafts;
    const feedback = grade(ep, automaticDrafts, p.pinned);
    for (const [id, result] of Object.entries(feedback)) {
      if (result.evidence) continue;
      const missing = solutions[ep][id].proof.filter(
        (fact) =>
          !fact.sources.some((alternative) =>
            alternative.every((source) => p.pinned.includes(source)),
          ),
      );
      result.evidenceMessage = [
        "이 의문을 풀 단서가 아직 충분히 수집되지 않았습니다.",
        ...missing.slice(0, 2).map((fact) => fact.hint),
      ].join(" ");
    }
    const investigation = investigationForEpisode(ep);
    if (investigation && !investigationState(p, investigation).confirmed)
      for (const id of Object.keys(feedback))
        if (feedback[id].evidence)
          feedback[id] = {
            ...feedback[id],
            evidence: false,
            evidenceMessage: `${investigation.title}에서 직접 조사한 연결을 먼저 확인해 주세요.`,
          };
    if (ep === 2 && !p.calibration.confirmed && !p.solved.includes(2))
      for (const id of ["time", "timeline"])
        feedback[id] = {
          ...feedback[id],
          evidence: false,
          evidenceMessage:
            "시설 기록과 영상의 같은 동작을 기록 대조에서 확인해 주세요. 대조 결과가 있어야 대상 장면을 표준시 기록에 연결할 수 있습니다.",
        };
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
  progress = migrateRequests(migrateRestorations(progress));
  return {
    progress,
    resolutions: Object.fromEntries(
      progress.solved.map((id) => [id, resolutions[id]]),
    ),
    ending: progress.ending ? endings[progress.ending] : null,
  };
}
