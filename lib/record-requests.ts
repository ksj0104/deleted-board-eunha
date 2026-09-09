import type { Progress } from "./game";

export const recordRequests = [
  {
    record: "4-3",
    title: "방문증 배정·이동 원본",
    from: "보안업체 기록 담당",
    label: "조회할 방문증 번호",
    instruction:
      "앞서 확보한 출입 원본에서 동문을 통과한 인증 수단을 찾으세요. 날짜와 통제 구간은 주민마당의 공사 안내로 확인할 수 있습니다.",
    answer: "V03",
    sources: ["2-3", "4-2"],
  },
  {
    record: "4-4",
    title: "시설 잠금장치 점검표",
    from: "시설 점검 담당",
    label: "점검할 장소의 리더 번호",
    instruction:
      "방문증 이동 원본에서 마지막으로 기록된 장치를 찾고, 주민마당의 보행 연결도로 그 장소를 확인하세요.",
    answer: "R09",
    sources: ["4-3", "4-1"],
  },
  {
    record: "4-5",
    title: "개인 약속의 후속 쪽지",
    from: "쪽지 보관함",
    label: "원래 약속을 보낸 닉네임",
    instruction:
      "독서모임 취소 안내와 처음 약속한 쪽지를 다시 비교하세요. 개인 약속을 주고받은 상대의 보관함에서 후속 회신을 조회할 수 있습니다.",
    answer: "우편함",
    sources: ["1-4", "1-5"],
  },
];
export const requestFor = (record: string) =>
  recordRequests.find((item) => item.record === record);
export const missingRequestSources = (p: Progress, record: string) =>
  requestFor(record)?.sources.filter((id) => !p.read.includes(id)) ?? [];
export function acquiredRecord(p: Progress, record: string) {
  return (
    !requestFor(record) ||
    p.requested === undefined ||
    p.requested.includes(record) ||
    p.read.includes(record) ||
    p.pinned.includes(record) ||
    p.solved.includes(4)
  );
}
export function migrateRequests(p: Progress): Progress {
  return p.requested === undefined
    ? {
        ...p,
        requested:
          p.solved.length >= 3 ? recordRequests.map((item) => item.record) : [],
      }
    : p;
}
export function requestMatches(p: Progress, record: string, input: unknown) {
  const request = requestFor(record);
  return (
    !!request &&
    p.solved.length >= 3 &&
    typeof input === "string" &&
    input.length <= 80 &&
    request.sources.every((id) => p.read.includes(id)) &&
    input.normalize("NFKC").replace(/\s/g, "").toLocaleUpperCase() ===
      request.answer.toLocaleUpperCase()
  );
}
