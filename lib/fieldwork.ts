import { recordById } from "./cases";
import type { Progress } from "./game";

export type InvestigationId =
  | "profiles"
  | "payments"
  | "route"
  | "index"
  | "revisions"
  | "sources"
  | "report";
export type InvestigationState = {
  placements: Record<string, string>;
  inspected: string[];
  confirmed: boolean;
};
export type Clue = {
  id: string;
  source: string;
  label: string;
  value: string;
  detail: string;
  amount?: number;
};
export type Investigation = {
  id: InvestigationId;
  episode: number;
  title: string;
  instruction: string;
  sources: string[];
  clues: Clue[];
  slots: { id: string; label: string; accepts: string[] }[];
  result: string;
};
const clue = (
  id: string,
  source: string,
  label: string,
  value: string,
  detail: string,
  amount?: number,
): Clue => ({
  id,
  source,
  label,
  value,
  detail,
  ...(amount === undefined ? {} : { amount }),
});
const slot = (id: string, label: string, ...accepts: string[]) => ({
  id,
  label,
  accepts,
});

export const investigations: Investigation[] = [
  {
    id: "profiles",
    episode: 1,
    title: "삭제 전 알림 대조",
    instruction:
      "작성자 정보와 알림 원본의 접힌 부분을 열어 보세요. 비교할 항목을 골라 두 자료를 한 줄에 놓으면 같은 계정인지, 어느 설명과 약속이 유효한지 대조할 수 있습니다.",
    sources: ["1-1", "1-2", "1-3", "1-4", "1-5"],
    clues: [
      clue(
        "old-name",
        "1-2",
        "표시 닉네임",
        "밤산책",
        "거래 글 화면에 표시된 작성자 이름",
      ),
      clue(
        "old-id",
        "1-2",
        "작성자 정보 펼치기",
        "P042",
        "302호 이서윤 · 거래 완료 뒤에도 유지되는 고유번호",
      ),
      clue(
        "new-name",
        "1-3",
        "알림의 표시 이름",
        "계단참",
        "삭제되기 전 메일 알림의 작성자 이름",
      ),
      clue(
        "new-id",
        "1-3",
        "알림 원본 정보 펼치기",
        "P042",
        "03.18 21:06 · 휴대전화 직접 작성 · 삭제 21:09",
      ),
      clue(
        "notice",
        "1-1",
        "전출 처리 항목",
        "03.17 전출 완료",
        "게시 계정: 관리소장 · 이후 글은 예약 글일 수 있다는 안내",
      ),
      clue(
        "resident",
        "1-3",
        "직접 작성한 본문",
        "302호 계속 거주 / 전출한 적 없음",
        "03.18 21:06 · 지금 잠시 외출 중 · 예약 글 아님",
      ),
      clue(
        "invite",
        "1-5",
        "초대장 접힌 면",
        "03.18 21:30 · 달빛세탁소",
        "독서모임과 별도인 개인 약속 · 우편함 → 계단참",
      ),
      clue(
        "cancel",
        "1-4",
        "취소 공지의 적용 범위",
        "독서모임 취소 / 개인 약속 유지",
        "계단참에게 보낸 쪽지의 장소는 그대로",
      ),
    ],
    slots: [
      slot("identity-a", "예전 글의 변하지 않는 식별 정보", "old-id"),
      slot("identity-b", "새 글에서 대응하는 식별 정보", "new-id"),
      slot("claim-a", "전출 안내의 처리 내용", "notice"),
      slot("claim-b", "당사자가 직접 남긴 거주 내용", "resident"),
      slot("appointment-a", "개인 약속의 초대장", "invite"),
      slot("appointment-b", "취소 범위를 확인할 기록", "cancel"),
    ],
    result:
      "같은 고유번호를 연결했고, 전출 설명과 직접 작성한 글의 충돌 및 개인 약속의 유효 범위를 대조했습니다. 원문을 증거로 수집하면 관련 질문이 추리 노트에 나타납니다.",
  },
  {
    id: "payments",
    episode: 3,
    title: "지급 전표 대조대",
    instruction:
      "자료를 옆에 펼쳐 두고 금액 → 이체 → 업체·승인자 순서로 비교하세요. 각 칸은 목록에서 한 번 고르면 입력되고, 차액은 자동으로 계산됩니다.",
    sources: ["3-1", "3-2", "3-3", "3-4"],
    clues: [
      clue(
        "ledger-total",
        "3-1",
        "공개 결산서 · 금액란",
        "E-318 · 4,800,000원",
        "최종액 / 기재 업체 한결설비 / 기재 계좌 8291",
        4800000,
      ),
      clue(
        "invoice-total",
        "3-2",
        "세금계산서 · 합계란",
        "E-318 · 1,800,000원",
        "부품·인건비·부가세 포함 / 추가 청구 없음 / 수금 계좌 4402",
        1800000,
      ),
      clue(
        "transfer-a",
        "3-3",
        "이체 전표 TX318-A",
        "4402 ← 1,800,000원",
        "처리 완료 / 승인 단말 M-01",
        1800000,
      ),
      clue(
        "transfer-b",
        "3-3",
        "이체 전표 TX318-B",
        "8291 ← 3,000,000원",
        "처리 완료 / 승인 단말 M-01",
        3000000,
      ),
      clue(
        "contractor",
        "3-2",
        "업체 회신 · 수금 계좌",
        "한결설비 / 4402",
        "E-318 대금 전액 수령 / 8291은 당사 계좌가 아님",
      ),
      clue(
        "owner",
        "3-4",
        "협력업체 카드 뒷면",
        "다온기획 / 8291 / 대표 조민석",
        "2026 행사 계약 없음 / 승강기 보수 면허 목록에 없음",
      ),
      clue(
        "signature",
        "3-1",
        "결산 승인 서명",
        "조민석",
        "작업번호 E-318의 지급 승인란",
      ),
    ],
    slots: [
      slot("published", "공개 결산 합계", "ledger-total"),
      slot("invoice", "최종 공사비", "invoice-total"),
      slot("paid-work", "공사비에 대응하는 이체", "transfer-a"),
      slot("paid-other", "별도로 실행된 이체", "transfer-b"),
      slot("recipient", "별도 이체 계좌의 등록 카드", "owner"),
      slot("approval", "그 지급을 승인한 서명", "signature"),
    ],
    result:
      "결산 합계, 최종 공사비와 두 이체를 대조했습니다. 계좌 끝자리로 수취 업체를, 서명과 등록 카드로 이해관계를 연결할 수 있습니다.",
  },
  {
    id: "route",
    episode: 4,
    title: "방문증 동선 지도",
    instruction:
      "① 출입 기록의 번호를 지도와 대조해 장소를 고르고 ② 공사로 막힌 길을 표시한 뒤 ③ 정전을 재현해 내부 손잡이를 시험하세요. 필요한 자료는 각 단계에서 바로 열 수 있습니다.",
    sources: ["4-1", "4-2", "4-3", "4-4"],
    clues: [
      clue(
        "r01",
        "4-3",
        "20:20 통과 도장",
        "20:20 · R01 · 출발",
        "V03 / 이서윤에게 발급 / 방문증과 본인 인증 성공",
      ),
      clue(
        "r02",
        "4-3",
        "20:21 통과 도장",
        "20:21 · R02 · 진입",
        "V03 / 방문증과 본인 인증 성공",
      ),
      clue(
        "r07",
        "4-3",
        "20:23 통과 도장",
        "20:23 · R07 · 진입",
        "V03 / 방문증과 본인 인증 성공",
      ),
      clue(
        "r09",
        "4-3",
        "20:26 통과 도장",
        "20:26 · R09 · 진입",
        "V03 / 방문증과 본인 인증 성공",
      ),
      clue(
        "works",
        "4-2",
        "공사 통제표 펼치기",
        "동문 안뜰 ↔ 외부 보도 폐쇄",
        "03.18 19:00–23:00 / 바깥 철문 용접 고정 / 안뜰 실내 출구 정상",
      ),
      clue(
        "exit",
        "4-4",
        "비상문 점검판",
        "R09 / 내부 손잡이 기계식",
        "외부 진입: 방문증 필요 / 내부 탈출: 손잡이 / 정전 시에도 내부 개방 가능",
      ),
      clue(
        "door-tested",
        "4-4",
        "비상문 시험 관찰",
        "정전 상태에서 내부 손잡이 개방",
        "시설 점검 결과를 재현한 모형의 관찰",
      ),
    ],
    slots: [
      slot("management", "관리동 · R01", "r01"),
      slot("courtyard", "동문 안뜰 · R02", "r02"),
      slot("tunnel", "지하 연결통로 · R07", "r07"),
      slot("archive", "구 세탁실 · R09", "r09"),
      slot("closure", "외부 보도 구간에 표시할 통제표", "works"),
      slot("door", "내부 비상문 시험에 사용할 점검판", "exit"),
    ],
    result:
      "개인 인증된 네 통과 기록을 장소에 연결했습니다. 마지막 리더는 지금 주민 기록실로 쓰는 구 세탁실이며, 내부 비상문은 정전 상태에서도 손잡이로 열립니다.",
  },
  {
    id: "index",
    episode: 5,
    title: "보관 색인 복원대",
    instruction:
      "조각을 뒤집어 연결 표식을 확인한 뒤 START부터 END까지 놓으세요. 이어진 숫자를 읽고, 후보 봉투의 봉인을 보존표와 대조하세요.",
    sources: ["5-1", "5-2", "5-3", "5-4", "5-5"],
    clues: [
      clue(
        "a",
        "5-2",
        "조각 A 뒤집기",
        "A → D | 3",
        "가장자리: 복사본을 공개하기 전에 원본과 대조",
      ),
      clue(
        "b",
        "5-3",
        "조각 B 뒤집기",
        "B → END | 8",
        "인수 후보 봉투의 표식을 함께 보관",
      ),
      clue(
        "c",
        "5-4",
        "조각 C 뒤집기",
        "START → C → A | 0",
        "같은 봉투 안에서 회수한 원본 조각",
      ),
      clue(
        "d",
        "5-5",
        "조각 D 뒤집기",
        "D → B | 1",
        "R: 변환 없는 원자료 / V: 검토 중 재배열·편집",
      ),
      clue(
        "e24",
        "5-3",
        "봉투 E24의 봉인",
        "E24 / V-24",
        "봉인의 접두사는 보존표의 분류와 대응",
      ),
      clue(
        "e42",
        "5-3",
        "봉투 E42의 봉인",
        "E42 / R-42",
        "봉인의 접두사는 보존표의 분류와 대응",
      ),
    ],
    slots: [
      slot("piece-1", "START 다음", "c"),
      slot("piece-2", "두 번째 조각", "a"),
      slot("piece-3", "세 번째 조각", "d"),
      slot("piece-4", "END 앞", "b"),
      slot("seal", "원자료로 인수된 봉투", "e42"),
    ],
    result:
      "조각의 다음 표식을 따라 한 줄로 복원했습니다. 숫자는 더하지 않고 이어 읽으며 앞의 0도 유지합니다. 봉인의 분류까지 확인한 묶음을 원본 검증에 사용할 수 있습니다.",
  },
  {
    id: "revisions",
    episode: 6,
    title: "변경 이력 조사기",
    instruction:
      "초안과 게시본을 번갈아 살펴 실제 변경 행을 찾으세요. 작업 계정을 등록 카드와 연결하고, 예약 작업의 삭제·보존 대상을 자료 이름으로 분류하세요.",
    sources: ["6-1", "6-2", "6-3", "6-4", "6-5"],
    clues: [
      clue(
        "draft",
        "6-2",
        "N88 · 08:41 이력",
        "U09 / 초안: 서버 점검 안내",
        "03.19 / 초안 작성 행",
      ),
      clue(
        "replace",
        "6-2",
        "N88 · 08:55 이력",
        "M01 / 제목과 본문 전체 교체",
        "03.19 09:00 동일 계정 게시·수정 잠금 / 표시 명의 주민대표회의",
      ),
      clue(
        "m01",
        "6-3",
        "M01 등록 카드",
        "M01 / 조민석",
        "관리소장 / 게시·삭제·예약 / 개인 인증",
      ),
      clue(
        "u09",
        "6-3",
        "U09 등록 카드",
        "U09 / 오유진",
        "회계담당 / 초안 작성 / 개인 인증",
      ),
      clue(
        "accounts",
        "6-3",
        "acct_source 대조 카드",
        "acct_source / 회계 원장",
        "저장 테이블의 실제 자료",
      ),
      clue(
        "history",
        "6-3",
        "post_revisions 대조 카드",
        "post_revisions / 게시 수정 이력",
        "저장 테이블의 실제 자료",
      ),
      clue(
        "posts",
        "6-3",
        "board_posts 대조 카드",
        "board_posts / 일반 게시글",
        "저장 테이블의 실제 자료",
      ),
      clue(
        "photos",
        "6-3",
        "market_images 대조 카드",
        "market_images / 장터 사진",
        "저장 테이블의 실제 자료",
      ),
      clue(
        "vote",
        "6-4",
        "확정 회의록의 결의란",
        "폐쇄 안건 미제출 / 표결 없음",
        "서버 점검만 승인 / 회계자료·게시 이력 원형 보존 / 7인 서명",
      ),
      clue(
        "notice-vote",
        "6-1",
        "게시본의 결정 근거",
        "모든 주민 찬성 / 자료 별도 보관",
        "N88 / 표시 작성자 주민대표회의",
      ),
    ],
    slots: [
      slot("revision", "최종 본문을 바꾼 작업 행", "replace"),
      slot("operator", "그 작업 계정의 등록 카드", "m01"),
      slot("delete-a", "삭제 대상으로 분류 1", "accounts", "history"),
      slot("delete-b", "삭제 대상으로 분류 2", "accounts", "history"),
      slot("keep-a", "보존 대상으로 분류 1", "posts", "photos"),
      slot("keep-b", "보존 대상으로 분류 2", "posts", "photos"),
      slot("decision", "공지의 동의 주장과 대조할 결의", "vote"),
    ],
    result:
      "표시 명의와 실제 변경 계정을 구분하고, 삭제 예약의 테이블을 자료 이름에 연결했습니다. 공지의 보관 약속과 확정 회의록도 함께 검토하세요.",
  },
  {
    id: "sources",
    episode: 7,
    title: "발신 경로와 진술 대조",
    instruction:
      "메일의 겉면과 인증 원본을 전환해 발신 계정을 찾으세요. 현재 안부를 입증하는 두 확인을 연결하고, 출입 확인·차단 지시·거부 회신을 각각 분리해 놓으세요.",
    sources: ["6-3", "7-1", "7-2", "7-3", "7-4", "7-5"],
    clues: [
      clue(
        "display",
        "7-5",
        "메일 봉투 앞면",
        "표시 발신명: 익명",
        "03.19 02:13 / 수신자: 독서모임 기록자",
      ),
      clue(
        "auth",
        "7-5",
        "발신 인증 원본 열기",
        "인증 서명 U09 / 개인 인증 통과",
        "메일 보관기의 원본 서명 / 화면 발신명과 별도",
      ),
      clue(
        "sender",
        "6-3",
        "U09 계정 소유자",
        "U09 / 오유진",
        "회계담당 / 공유 계정 없음 / 개인 인증 필요",
      ),
      clue(
        "past",
        "7-3",
        "03.18 목격 확인",
        "03.18 20:40 함께 나옴",
        "윤해진 / 당시 다치지 않았고 본인 의사로 동행",
      ),
      clue(
        "today",
        "7-3",
        "03.25 동석 확인",
        "03.25 09:50 / 본인·안전·자의 확인",
        "윤해진 / 오늘 영상 통화에 동석 / 과거 목격과 별도",
      ),
      clue(
        "self",
        "7-4",
        "본인의 현재 회신",
        "03.25 / 안전하며 스스로 연락을 줄임",
        "09:50 영상 통화 본인 확인 / 강제 감금·연락 차단 없음",
      ),
      clue(
        "entry",
        "7-1",
        "현관 대면 확인 서명",
        "03.18 20:14 / 조민석 관리동 출입",
        "K17 + 개인 PIN + 근무자 대면 서명 / 전기실 내부 행동은 미확인",
      ),
      clue(
        "request",
        "7-2",
        "업무쪽지 발신 면",
        "조민석 → 박도현 / M1 차단 지시",
        "03.18 19:58 / 지시 시각 20:24",
      ),
      clue(
        "refusal",
        "7-2",
        "업무쪽지 회신 면",
        "박도현 / 승인서 없어 수행 거부",
        "차단기는 조작하지 않겠다는 회신 / 대체 승인 기록 없음",
      ),
    ],
    slots: [
      slot("mail", "실제 발신 인증", "auth"),
      slot("identity", "인증 계정의 등록자", "sender"),
      slot("current-witness", "현재 안부의 동석 확인", "today"),
      slot("current-self", "현재 안부의 본인 확인", "self"),
      slot("entry", "장소 출입까지 입증한 기록", "entry"),
      slot("instruction", "차단을 지시한 기록", "request"),
      slot("response", "그 지시에 대한 회신", "refusal"),
    ],
    result:
      "표시 이름과 인증 계정, 과거 목격과 현재 확인을 분리했습니다. 출입·지시·거부 회신은 각각 다른 사실을 입증하며 직접 차단기 실행자까지 확정하지 않습니다.",
  },
  {
    id: "report",
    episode: 8,
    title: "공개 보고서 편집대",
    instruction:
      "독립 원본과 동의서를 대조하며 보고서 카드를 분류하세요. 입증된 사실은 본문에, 아직 확인되지 않은 내용은 후속 조사에 두고 보호 정보는 공개 사본에서 가리세요.",
    sources: [
      "8-1",
      "8-2",
      "8-3",
      "8-4",
      "8-5",
      "3-1",
      "3-4",
      "6-1",
      "6-3",
      "2-4",
      "7-2",
    ],
    clues: [
      clue(
        "money",
        "8-1",
        "거래 주장 카드",
        "300만 원 → 승인자가 대표인 업체",
        "TX318-B의 수취 계좌를 업체 등록부, 승인 서명을 결산서와 대조",
      ),
      clue(
        "deletion",
        "8-2",
        "삭제 계획 카드",
        "회계 원장·수정 이력 / 백업 없이 삭제 예약",
        "독립 Q25 감정과 테이블 대조표, 공지의 별도 보관 약속을 대조",
      ),
      clue(
        "preserved",
        "8-3",
        "보관 사실 카드",
        "독립 보관처 3곳 / 원본 해시 일치",
        "외부 기록보관소 인수 완료",
      ),
      clue(
        "breaker",
        "7-2",
        "실행자 주장 카드",
        "조민석이 직접 차단기를 조작했다",
        "쪽지의 지시·거부 회신과 M1 작동 내역이 직접 실행자를 식별하는지 대조",
      ),
      clue(
        "liability",
        "8-5",
        "책임 확정 카드",
        "최종 법적 책임과 환수액",
        "운영 권한 회수·작업 중지와 후속 조사 범위를 구분",
      ),
      clue(
        "address",
        "8-4",
        "보호 정보 필드",
        "현재 보호 주소",
        "제보 사실 사용 동의 / 현재 주소 공개에는 동의하지 않음",
      ),
      clue(
        "contact",
        "8-4",
        "연락 정보 필드",
        "보호자 연락처",
        "공개 동의 범위에서 제외된 연락 정보",
      ),
    ],
    slots: [
      slot("fact-1", "보고서 본문 1", "money", "deletion", "preserved"),
      slot("fact-2", "보고서 본문 2", "money", "deletion", "preserved"),
      slot("fact-3", "보고서 본문 3", "money", "deletion", "preserved"),
      slot("open-1", "후속 조사 1", "breaker", "liability"),
      slot("open-2", "후속 조사 2", "breaker", "liability"),
      slot("private-1", "공개 사본에서 가림 1", "address", "contact"),
      slot("private-2", "공개 사본에서 가림 2", "address", "contact"),
    ],
    result:
      "공개 사본의 사실·미확정 주장·보호 정보를 구분했습니다. 원본은 독립 보관처에 유지됩니다. 최종 추리를 검증한 뒤 주민 공개 또는 감사기관 한정 제출을 선택하세요.",
  },
];

export const investigationById = (id: string) =>
  investigations.find((desk) => desk.id === id);
export const investigationForEpisode = (episode: number) =>
  investigations.find((desk) => desk.episode === episode);
export const investigationForRecord = (record: string) =>
  investigations.find(
    (desk) =>
      desk.episode === Number(record.split("-")[0]) &&
      desk.sources.includes(record),
  );
export const emptyInvestigation = (): InvestigationState => ({
  placements: {},
  inspected: [],
  confirmed: false,
});
export function investigationState(
  p: Progress,
  desk: Investigation,
): InvestigationState {
  return (
    p.investigations?.[desk.id] ?? {
      ...emptyInvestigation(),
      confirmed: p.solved.includes(desk.episode),
    }
  );
}
export const investigationReady = (p: Progress, desk: Investigation) =>
  desk.sources.every((id) => p.read.includes(id));
export function validInvestigation(
  desk: Investigation,
  value: unknown,
): value is InvestigationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as InvestigationState;
  if (
    !s.placements ||
    typeof s.placements !== "object" ||
    Array.isArray(s.placements) ||
    !Array.isArray(s.inspected) ||
    typeof s.confirmed !== "boolean"
  )
    return false;
  const knownClue = (id: unknown) =>
    typeof id === "string" && desk.clues.some((c) => c.id === id);
  const values = Object.values(s.placements);
  return (
    s.inspected.every(knownClue) &&
    new Set(s.inspected).size === s.inspected.length &&
    new Set(values).size === values.length &&
    Object.entries(s.placements).every(
      ([key, id]) =>
        desk.slots.some((slot) => slot.id === key) &&
        knownClue(id) &&
        s.inspected.includes(id),
    )
  );
}
export const investigationMatches = (
  desk: Investigation,
  state: InvestigationState,
) =>
  validInvestigation(desk, state) &&
  desk.slots.every((slot) =>
    slot.accepts.includes(state.placements[slot.id]),
  ) &&
  (desk.id !== "route" || state.inspected.includes("door-tested"));

export function artifactClues(record: string) {
  const desk = investigationForRecord(record);
  return desk && desk.id !== "report"
    ? desk.clues.filter(
        (clue) => clue.source === record && clue.id !== "door-tested",
      )
    : [];
}
export const sourceName = (id: string) => recordById(id)?.title ?? id;
