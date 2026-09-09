import { allRecords, episodes, type RecordFile } from "./cases";
import type { Progress } from "./game";
import { acquiredRecord } from "./record-requests";

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
    body: "모임의 예전 글을 보관해 오셨다고 들었습니다. 전출 안내와 서윤 씨 계정에서 직접 쓴 말이 달라 확인을 부탁드립니다. 삭제 전 본문이 남은 메일 알림과 약속 쪽지의 보관본을 첨부합니다. 주민마당의 예전 글과 대조해 주세요. 제가 누구인지는 지금 밝히기 어렵지만, 알림 원문은 그대로 보존하겠습니다. 저는 서윤 씨의 현재 행방을 모릅니다. 소식이 닿으면 다시 전하겠습니다.",
    source: "삭제 전 수신한 메일 알림 원문 · 약속 쪽지 보관본",
  },
  {
    episode: 2,
    date: "03.20 09:00",
    from: "달빛세탁소 · 우편함",
    subject: "그날 기다렸지만, 서윤 씨는 오지 않았어요",
    body: "모임은 취소됐어도 개인 약속은 그대로라 가게에서 기다렸습니다. 서윤 씨는 오지 않았고 이후 직접 통화하지도 못했어요. 함께 요청한 기록 보존 건을 입주자 감사가 접수했고, 설비 담당자와 보안업체에서 해당 시간대의 회신을 받았습니다. 카드 등록자 정보는 아직 제외되어 있습니다. 정문 센서 점검 기록과 C2 보관 화면, 출입·전력 원본을 주민마당의 유출 안내와 비교해 주세요. 안부 요청도 계속 전달하겠습니다.",
    source:
      "입주자 감사 경유 회신 · 정문 센서 원본 · CCTV 보관 캡처 · 출입·전력 기록",
  },
  {
    episode: 3,
    date: "03.21 09:00",
    from: "최초 제보자 · 추가 첨부",
    subject: "복사해 둔 공사비 자료를 보냅니다",
    body: "보내 주신 시간 대조 결과를 읽었습니다. 서윤 씨와 공유하던 공사비 자료의 보관 사본을 보냅니다. 공개 결산의 작업번호를 업체 회신·이체 확인서·협력업체 등록부와 맞춰 주세요. 파쇄기 목격담에 따라 입주자 감사가 19일 지하 파쇄함의 폐지를 봉인했고, 어제 분류한 결산 수정 쪽지의 종이 조각 열 개도 인계받았습니다. 종이 조각을 이어 공개본에서 무엇이 바뀌었는지 확인해 주세요. 이 종이만으로 파쇄한 사람을 단정할 수는 없습니다. 사본을 최종 근거로 쓰기 전에는 은행과 업체의 원본으로 다시 확인해 주세요.",
    source:
      "공사비 자료 보관 사본 · 업체 수신 회신 · 입주자 감사 봉인 회수물 S-0319",
  },
  {
    episode: 4,
    date: "03.22 18:00",
    from: "달빛세탁소 · 추가 회신",
    subject: "동문에서 끊긴 행적에 관해",
    body: "동문에서 끊긴 기록은 보안업체에 방문증 번호를 특정해 조회할 수 있습니다. 앞서 받은 출입 원본을 다시 살펴보고, 주민마당에서 그날의 공사 안내를 찾아 보세요. 이동 원본을 확보하면 마지막 장치를 기준으로 시설 점검표도 요청할 수 있습니다. 개인 약속의 후속 쪽지는 처음 약속을 보낸 상대의 보관함에서 찾아야 합니다. 조회해 확보한 자료는 이 회신에 차례로 보관됩니다.",
    source: "우편함의 조회 안내 · 보안업체 기록실 · 시설 담당 보관함",
  },
  {
    episode: 5,
    date: "03.23 15:00",
    from: "주민 기록실 당번 · 자료 인계",
    subject: "기록실 우편함에서 찾은 봉투",
    body: "요청하신 3월 18일 접수 봉투와 다음 날 작성한 보관 목록을 찾았습니다. 저는 오늘 자료를 인계하는 당번이며 그날 서윤 씨를 만난 사람은 아닙니다. 안부 확인 요청은 당시 연락 담당자에게 별도로 전달했습니다. 봉투의 색인 네 조각, 읽는 법, 인수 목록을 보냅니다. 최초 인수분은 봉인하고 이후 감사 보관기로 받은 원본은 날짜별 추록으로 함께 보관합니다. 위치와 보존 묶음을 확인해 주시면 해당 자료를 인계하겠습니다.",
    source: "과거 접수 봉투 스캔 · 기록실 보관 규칙 · 인수 목록",
  },
  {
    episode: 6,
    date: "03.24 22:00",
    from: "주민 기록실 · 원본 E42 인계",
    subject: "보관함 안의 관리자 이력",
    body: "확인해 주신 0318번 보관함에서 봉인과 인수표를 대조해 E42를 인계합니다. 3월 18일 최초 인수분과 19일 감사 보관기가 수신한 추록을 날짜별로 구분했습니다. 글이 처리된 시각은 각 감사행에 남아 있습니다. 계정·자료 대조표와 예약 작업을 주민마당의 폐쇄 공지·확정 회의록에 맞춰 보세요. 보존 대상이 확인되면 입주자 감사에게 이 묶음과 예약 작업 확인 요청을 전달하겠습니다.",
    source: "E42 최초 인수분 · 날짜별 감사 원본 추록 · 봉인 대조 인계",
  },
  {
    episode: 7,
    date: "03.25 10:30",
    from: "기록실지기 · 회신",
    subject: "서윤 씨의 소식을 확인할 수 있습니다",
    body: "기록실 당번을 통해 안부 확인 요청을 받았습니다. 저는 3월 18일 서윤 씨의 연락을 받았던 윤해진입니다. 오늘 서윤 씨에게 이웃들의 걱정을 전했고, 본인이 답을 보내겠다고 했습니다. 제가 그날 직접 만난 경위와 오늘 본인 확인을 거친 메시지를 함께 보냅니다. 최초 제보자가 확인해 준 메일 발신 자료, 별도로 도착한 보안업체의 카드 배정 회신과 업무 지시도 묶었습니다. 과거의 목격, 오늘의 안부, 지시 기록이 각각 어디까지 확인해 주는지 구분해 주세요.",
    source:
      "03.18 동행 확인 · 03.25 본인 확인 · 발신 인증 · 보안업체 회신 · 업무 쪽지",
  },
  {
    episode: 8,
    date: "03.25 23:40",
    from: "입주자 감사 · 정하린",
    subject: "원본 대조를 마쳤습니다",
    body: "인계받은 자료를 은행·업체가 보관한 원본, 감사 추록과 대조했습니다. 독립 대조 결과와 원본 인수증, 예약 작업 중지·권한 회수 확인을 보냅니다. 보관은 완료됐으며 보고서의 전달 범위는 아직 정하지 않았습니다. 서윤 씨의 공개 동의도 함께 읽어 주세요. 확인된 거래·게시 처리·삭제 예약을 각 근거에 연결하고, 실행자가 확인되지 않은 행동은 남은 조사로 적어 주시면 됩니다.",
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
    : Number(r.id.split("-")[0]) <= worldStage(p) && acquiredRecord(p, r.id);
}
export function communityRecords(p: Progress) {
  return allRecords.filter((r) => isPublicRecord(r) && canReadRecord(r, p));
}
export function deliveryRecords(episode: number, progress?: Progress) {
  return episodes[episode - 1].records.filter(
    (r) => !isPublicRecord(r) && (!progress || canReadRecord(r, progress)),
  );
}
