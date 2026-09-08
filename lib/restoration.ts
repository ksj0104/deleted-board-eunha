import type { RecordFile } from "./cases";
import type { Progress } from "./game";
import {
  settlementScan,
  settlementPieceSrc,
  type DocumentScan,
} from "./document-scans";

export type ShreddedDocument = {
  pieces: { id: string; label: string; src?: string; width?: number }[];
  scan?: DocumentScan;
  initial: string[];
  rows: string[][];
  transcript: string[];
};
export type Restoration = { order: string[]; complete: boolean };

// Each column is one recovered bundle. Labels identify pieces, not their order.
export const settlementScraps: ShreddedDocument = {
  scan: settlementScan,
  pieces: [
    ["cedar", "마"],
    ["willow", "나"],
    ["reed", "자"],
    ["ash", "라"],
    ["maple", "아"],
    ["elm", "가"],
    ["pine", "차"],
    ["oak", "바"],
    ["birch", "다"],
    ["yew", "사"],
  ].map(([id, label], index) => ({
    id,
    label,
    src: settlementPieceSrc(id),
    width:
      Math.round(((index + 1) * 1536) / 10) - Math.round((index * 1536) / 10),
  })),
  initial: [
    "elm",
    "birch",
    "cedar",
    "oak",
    "reed",
    "yew",
    "maple",
    "willow",
    "pine",
    "ash",
  ],
  rows: [
    "결산 수정 검토 쪽지",
    "2026.03.17 16:50 오유진 → 조민석",
    "작업번호 E-318 / 공개 결산서 수정 요청",
    "소장님, 제가 입력한 원본에는 아래 두 건이 분리되어 있었습니다.",
    "한결설비 / 공사비 최종 / 1,800,000원",
    "다온기획 / 별도 지급액 / 3,000,000원",
    "공개본에서는 두 건 모두 한결설비로 합산되어 있어요.",
    "결산서를 다시 올려도 될까요?",
    "회신 / 조민석",
    "수정하지 마세요. 두 건 모두 제가 승인한 결산입니다.",
    "원본 파일은 제가 정리하겠습니다.",
  ].map((line) =>
    Array.from({ length: 10 }, (_, i) =>
      line.slice(
        Math.round((i * line.length) / 10),
        Math.round(((i + 1) * line.length) / 10),
      ),
    ),
  ),
  transcript: [
    "소장님, 제가 입력한 원본에는 한결 180만 / 다온 300만으로 분리되어 있었습니다. 공개본에서는 전부 한결로 합쳐져 있어요.",
    "조민석의 회신: “수정하지 마세요. 두 건 모두 제가 승인한 결산입니다. 원본 파일은 제가 정리하겠습니다.”",
  ],
};

export const correctOrder = (doc: ShreddedDocument) =>
  doc.pieces.map((p) => p.id);
export function validPieceOrder(
  doc: ShreddedDocument,
  order: unknown,
): order is string[] {
  return (
    Array.isArray(order) &&
    order.length === doc.pieces.length &&
    new Set(order).size === doc.pieces.length &&
    order.every((id) => doc.pieces.some((piece) => piece.id === id))
  );
}
export const isRestoredOrder = (doc: ShreddedDocument, order: string[]) =>
  correctOrder(doc).every((id, index) => order[index] === id) &&
  order.length === doc.pieces.length;

const legacyOrder = ["cedar", "reed", "ash", "elm", "pine", "birch"];
const legacyParts: Record<string, string[]> = {
  cedar: ["cedar", "willow"],
  reed: ["reed"],
  ash: ["ash", "maple"],
  elm: ["elm", "pine"],
  pine: ["oak"],
  birch: ["birch", "yew"],
};
function isLegacyRestoration(value: unknown): value is Restoration {
  if (!value || typeof value !== "object") return false;
  const saved = value as Restoration;
  return (
    typeof saved.complete === "boolean" &&
    Array.isArray(saved.order) &&
    saved.order.length === legacyOrder.length &&
    new Set(saved.order).size === legacyOrder.length &&
    saved.order.every((id) => legacyOrder.includes(id)) &&
    (!saved.complete || saved.order.every((id, i) => id === legacyOrder[i]))
  );
}
export function validSavedRestoration(
  doc: ShreddedDocument,
  value: unknown,
): value is Restoration {
  if (!value || typeof value !== "object") return false;
  const saved = value as Restoration;
  return (
    (typeof saved.complete === "boolean" &&
      validPieceOrder(doc, saved.order) &&
      (!saved.complete || isRestoredOrder(doc, saved.order))) ||
    (doc === settlementScraps && isLegacyRestoration(value))
  );
}
function upgradeRestoration(saved: Restoration): Restoration {
  return isLegacyRestoration(saved)
    ? {
        order: saved.order.flatMap((id) => legacyParts[id]),
        complete: saved.complete,
      }
    : saved;
}
export function migrateRestorations(progress: Progress): Progress {
  const saved = progress.restorations?.["3-5"];
  if (!saved || !isLegacyRestoration(saved)) return progress;
  return {
    ...progress,
    restorations: {
      ...progress.restorations,
      "3-5": upgradeRestoration(saved),
    },
  };
}

export function restorationFor(
  record: RecordFile,
  progress: Progress,
): Restoration {
  const doc = record.shredded!;
  const saved = progress.restorations?.[record.id];
  if (saved) return record.id === "3-5" ? upgradeRestoration(saved) : saved;
  // Previously readable originals remain available to existing players.
  if (progress.restorations === undefined && progress.read.includes(record.id))
    return { order: correctOrder(doc), complete: true };
  return { order: [...doc.initial], complete: false };
}
export const recordRestored = (record: RecordFile, progress: Progress) =>
  !record.shredded || restorationFor(record, progress).complete;
export const readableParagraphs = (record: RecordFile, progress: Progress) =>
  record.shredded && recordRestored(record, progress)
    ? [...record.paragraphs, ...record.shredded.transcript]
    : record.paragraphs;
