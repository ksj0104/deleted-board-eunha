import type { RecordFile } from "./cases";
import type { Progress } from "./game";

export type ShreddedDocument = {
  pieces: { id: string; label: string }[];
  initial: string[];
  rows: string[][];
  transcript: string[];
};
export type Restoration = { order: string[]; complete: boolean };

// Each column is one recovered bundle. Labels identify pieces, not their order.
export const settlementScraps: ShreddedDocument = {
  pieces: [
    { id: "cedar", label: "라" },
    { id: "reed", label: "가" },
    { id: "ash", label: "바" },
    { id: "elm", label: "나" },
    { id: "pine", label: "마" },
    { id: "birch", label: "다" },
  ],
  initial: ["elm", "birch", "cedar", "pine", "reed", "ash"],
  rows: [
    ["결산 수", "정 검토", " 쪽지", "", "", ""],
    ["2026.", "03.17", " 16:50", "오유진", " → 조", "민석"],
    ["작업번호", " E-318", " / 공개", " 결산서", " 수정", " 요청"],
    ["원본에", " 입력한", " 내역은", " 아래와", " 같이", " 분리됨"],
    ["한결설비", " / 공사", "비 최종", " 1,800", ",000", "원"],
    ["다온기획", " / 별도", " 지급액", " 3,000", ",000", "원"],
    ["공개본은", " 두 건", " 모두를", " 한결설", "비로", " 합산함"],
    ["결산서를", " 다시", " 올려도", " 될까요", "?", ""],
    ["회신", " / 조민", "석", "", "", ""],
    ["수정하지", " 마세요", ". 두 건", " 모두", " 제가", " 승인한"],
    ["결산입니", "다. 원본", " 파일은", " 제가", " 정리하", "겠습니다."],
  ],
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

export function restorationFor(
  record: RecordFile,
  progress: Progress,
): Restoration {
  const doc = record.shredded!;
  const saved = progress.restorations?.[record.id];
  if (saved) return saved;
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
