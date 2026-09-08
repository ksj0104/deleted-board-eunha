import type { Progress } from "./game";

export type CctvCapture = { src: string; alt: string; displayTime: string };
export type Calibration = { offset: number; confirmed: boolean };
export const inspectionCaptures: CctvCapture[] = [
  {
    src: "cctv/c2-inspection-195700.webp",
    displayTime: "19:57",
    alt: "C2 화면 표시 2026-03-18 19:57:00. 점검 중 표지 옆의 반사 조끼 작업자가 관리동 문을 열고 있다.",
  },
  {
    src: "cctv/c2-inspection-195800.webp",
    displayTime: "19:58",
    alt: "C2 화면 표시 2026-03-18 19:58:00. 같은 점검 작업자 앞의 관리동 문이 완전히 닫혀 있다.",
  },
  {
    src: "cctv/c2-inspection-200000.webp",
    displayTime: "20:00",
    alt: "C2 화면 표시 2026-03-18 20:00:00. 점검 작업자가 같은 관리동 문을 다시 열고 있다.",
  },
];
export const inspectionEvents = [
  { time: "19:50", event: "문 열림" },
  { time: "19:51", event: "문 닫힘" },
  { time: "19:53", event: "문 열림" },
];
export const MIN_OFFSET = -12;
export const MAX_OFFSET = 12;
export const clockMinutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export function clockLabel(minutes: number) {
  const value = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
export const validOffset = (offset: unknown): offset is number =>
  typeof offset === "number" &&
  Number.isInteger(offset) &&
  offset >= MIN_OFFSET &&
  offset <= MAX_OFFSET;
export const comparisonMatches = (offset: number) =>
  inspectionCaptures.every(
    (frame, index) =>
      clockMinutes(frame.displayTime) + offset ===
      clockMinutes(inspectionEvents[index].time),
  );
export const comparisonReady = (p: Progress) =>
  ["2-1", "2-2"].every((id) => p.read.includes(id));
export function calibrationFor(p: Progress): Calibration {
  if (p.calibration) return p.calibration;
  // Completed older episodes retain their established finding; new investigations discover it.
  if (p.solved.includes(2))
    return {
      offset:
        clockMinutes(inspectionEvents[0].time) -
        clockMinutes(inspectionCaptures[0].displayTime),
      confirmed: true,
    };
  return { offset: 0, confirmed: false };
}
