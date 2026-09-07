import { allRecords, episodes, type RecordFile } from "./cases";
import type { Progress } from "./game";

// Public posts follow the world's clock, not the currently selected deduction.
// Private originals arrive through an identified source and stay in the inbox.
const publicIds = new Set([
  "1-1",
  "1-2",
  "1-4",
  "1-6",
  "2-5",
  "2-6",
  "3-1",
  "3-6",
  "4-1",
  "4-2",
  "4-6",
  "6-1",
  "6-4",
  "6-6",
  "7-6",
  "8-6",
]);
export const deliveries = [
  {
    episode: 1,
    date: "03.19 02:13",
    from: "익명의 제보자",
    subject: "서윤 씨가 남긴 기록을 읽어 주세요",
    body: "모임 기록을 보관해 오셨다고 들었습니다. 전출 안내와 서윤 씨 본인의 말이 다릅니다. 삭제되기 전 메일 알림과 전달받은 쪽지를 첨부합니다. 공개 게시판의 예전 글과 대조해 주세요. 제가 누구인지는 지금 밝히기 어렵습니다.",
    source: "메일 알림 복원본 · 전달받은 쪽지",
  },
  {
    episode: 2,
    date: "03.20 09:00",
    from: "달빛세탁소 · 우편함",
    subject: "그날 기다렸지만, 서윤 씨는 오지 않았어요",
    body: "쪽지의 약속을 보고 연락 주셨군요. 저는 가게에서 기다렸지만 서윤 씨를 만나지 못했어요. 요청하신 시간대의 설비·출입 기록을 전달받았습니다. C2의 시계에 오차가 있다는 점검표도 함께 보냅니다. 주민마당에 올라온 유출 안내와 기록의 순서가 맞는지 봐 주세요.",
    source: "설비 점검표 · 영상 판독 · 출입·전력 기록",
  },
  {
    episode: 3,
    date: "03.21 09:00",
    from: "최초 제보자 · 추가 첨부",
    subject: "복사해 둔 공사비 자료를 보냅니다",
    body: "복사 시각을 확인하셨다면 이 자료가 왜 필요했는지도 봐 주세요. 공개된 승강기 결산은 주민마당에 그대로 있습니다. 첨부한 업체 회신, 이체 확인서, 업체 등록부와 대조하면 같은 거래가 어떻게 기록됐는지 알 수 있습니다. 결산 수정을 요청했던 쪽지도 남깁니다.",
    source: "회계자료 보관본 · 업체 회신 · 내부 쪽지",
  },
  {
    episode: 4,
    date: "03.22 18:00",
    from: "달빛세탁소 · 추가 회신",
    subject: "동문에서 끊긴 행적에 관해",
    body: "서윤 씨가 원본을 가져오려던 길을 찾고 계시군요. 늦으면 어디로 가겠다는 쪽지와, 요청해 주신 방문증 이동 기록·문 점검표를 전달합니다. 동문이라는 이름만으로 밖으로 나갔다고 판단할 수는 없어요. 주민마당의 오래된 단지 연결도와 공사 안내도 함께 확인해 주세요.",
    source: "전달받은 쪽지 · 방문증 기록 · 시설 점검표",
  },
  {
    episode: 5,
    date: "03.23 15:00",
    from: "주민 기록실 · 자료 인계",
    subject: "기록실 우편함에서 찾은 봉투",
    body: "찾아오신 기록실의 우편함에서 봉투를 인계했습니다. 안에는 원본 보관 위치를 가리키는 색인 네 조각이 있었습니다. 기록실의 색인 읽는 법과 조각 대조표도 함께 묶었습니다. 보관함 번호와 원본 식별자가 확인되면 해당 묶음을 열 수 있습니다.",
    source: "봉투 속 종이 스캔 · 기록실 보관 규칙",
  },
  {
    episode: 6,
    date: "03.24 22:00",
    from: "0318번 보관함 · 원본 E42",
    subject: "보관함 안의 관리자 이력",
    body: "복원한 번호로 연 보관함에서 원본 E42를 확보했습니다. 그 안의 변경 이력과 계정 대조표, 예약 작업을 확인할 수 있습니다. 주민마당에 남은 폐쇄 공지와 회의록은 그대로 두고 비교하세요. 화면의 명의와 실제 수정 계정을 구분하는 것이 중요합니다.",
    source: "원본 E42 · 관리자 감사 기록",
  },
  {
    episode: 7,
    date: "03.25 10:30",
    from: "기록실지기 · 회신",
    subject: "서윤 씨의 소식을 확인할 수 있습니다",
    body: "기록을 보존할 준비가 되었다는 소식을 들었습니다. 서윤 씨 본인의 메시지와 제가 직접 만난 경위를 보냅니다. 최초 제보 메일의 발신 확인 자료, 카드 배정 기록과 당시 업무 지시도 함께 확인해 주세요. 누군가의 지시와 실제 실행은 구분해서 기록해 주셨으면 합니다.",
    source: "본인 확인 · 동행자 진술 · 발신·업무 기록",
  },
  {
    episode: 8,
    date: "03.25 23:40",
    from: "입주자 감사 · 정하린",
    subject: "원본 대조를 마쳤습니다",
    body: "인계받은 원본을 독립 보관 자료와 대조했습니다. 원본 인수증과 검토 결과, 예약 작업 중지 확인을 보냅니다. 서윤 씨가 동의한 공개 범위도 첨부했습니다. 입증된 사실과 남은 조사를 나누어 보고서를 마무리해 주세요.",
    source: "독립 감사 회신 · 원본 인수증 · 공개 범위 동의",
  },
];
export function worldStage(p: Progress) {
  return Math.min(episodes.length, p.solved.length + 1);
}
export function worldDate(p: Progress) {
  return deliveries[worldStage(p) - 1].date;
}
export function isPublicRecord(r: RecordFile) {
  return Number(r.id.split("-")[1]) > 6 || publicIds.has(r.id);
}
export function canReadRecord(r: RecordFile, p: Progress) {
  return isPublicRecord(r)
    ? r.date <= worldDate(p)
    : Number(r.id.split("-")[0]) <= worldStage(p);
}
export function communityRecords(p: Progress) {
  return allRecords.filter((r) => isPublicRecord(r) && canReadRecord(r, p));
}
export function deliveryRecords(episode: number) {
  return episodes[episode - 1].records.filter((r) => !isPublicRecord(r));
}
