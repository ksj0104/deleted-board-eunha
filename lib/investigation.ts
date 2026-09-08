import type { Episode, Question } from "./cases";
import type { Feedback, Progress } from "./game";

export const evidenceLimit = (question: Question) =>
  question.evidenceMax ?? question.evidenceCount;
export const evidenceSelectionLabel = (question: Question) =>
  evidenceLimit(question) === question.evidenceCount
    ? `${question.evidenceCount}개`
    : `${question.evidenceCount}~${evidenceLimit(question)}개`;

// Observation prompts guide the player without importing server-side solutions.
export const investigationGuides: {
  situation: string;
  tips: Record<string, string>;
}[] = [
  {
    situation:
      "이서윤이 이사 갔다는 공지가 사실인지 확인하고, 어디로 가려 했는지 찾아야 합니다.",
    tips: {
      alias:
        "예전 글과 새 글의 작성자 정보를 비교해 같은 사람의 계정인지 확인하세요.",
      status: "관리자가 올린 전출 안내와 서윤 본인이 남긴 말을 대조하세요.",
      meeting:
        "개인 초대와 나중의 취소 공지를 대조해, 어떤 약속까지 취소됐는지 확인하세요.",
    },
  },
  {
    situation:
      "정전이 시작된 뒤 자료를 복사했다는 설명이 맞는지 확인해야 합니다. 각 출입증이 같은 사람의 것인지는 아직 모릅니다.",
    tips: {
      time: "시설 기록과 영상에서 같은 동작을 찾아보세요. 두 자료를 함께 놓으면 회색 외투 장면을 어떻게 읽을지 확인할 수 있습니다.",
      timeline:
        "회색 외투 장면과 출입 원본의 어느 행이 대응하는지 확인한 뒤 네 사건을 비교하세요. 서로 다른 출입 수단을 한 사람의 행동으로 합치지 마세요.",
      claim: "정전 시각과 자료를 복사한 시각 중 무엇이 먼저인지 대조하세요.",
    },
  },
  {
    situation:
      "같은 승강기 공사에 서로 다른 금액이 적혔습니다. 차액과 돈을 받은 곳, 승인자를 확인해야 합니다.",
    tips: {
      difference:
        "공개 결산액과 실제 공사비를 대조하세요. 세금과 추가비가 포함됐는지도 확인하세요.",
      recipient: "장부에 적힌 이름과 실제 이체받은 업체가 같은지 확인하세요.",
      approver: "지급 승인자와 업체 대표 정보를 연결하세요.",
    },
  },
  {
    situation:
      "동문 통과 기록은 있지만 서윤은 약속 장소에 오지 않았습니다. 새로 받은 방문증 배정과 이동 기록을 연결해야 합니다.",
    tips: {
      route:
        "리더 번호를 연결도의 장소로 바꾼 뒤 실제 통과 순서를 확인하세요. 쪽지의 계획과 인증된 이동을 구분하세요.",
      destination:
        "마지막으로 진입한 리더를 찾고, 그 장소의 예전 이름과 현재 쓰임을 대조하세요.",
      trapped: "정전이 나면 그 문을 안에서 열 수 있는지 확인하세요.",
    },
  },
  {
    situation:
      "네 조각의 백업 색인을 연결해 자료가 숨겨진 보관함과 사용할 원본을 찾아야 합니다.",
    tips: {
      fragments:
        "START부터 다음 조각으로 이어지는 표식을 따라 END까지 연결하세요.",
      locker:
        "조각을 연결한 순서대로 숫자를 읽으세요. 네 자리 형식을 유지하세요.",
      original:
        "인수 후보에 찍힌 봉인을 찾은 뒤 보존표의 분류와 대조하세요. 묶음 번호만으로 판단할 수 없습니다.",
    },
  },
  {
    situation:
      "게시판 폐쇄 공지를 실제로 올린 사람과 없애려는 기록, 공지 속 허위 설명을 밝혀야 합니다.",
    tips: {
      editor: "겉에 표시된 작성자 이름과 실제 로그인·수정 계정을 구분하세요.",
      deletion:
        "예약 작업의 삭제 행과 보존 행을 나누고, 테이블명을 자료 대조표에 연결하세요.",
      vote: "공지에서 주장하는 주민 동의가 확정 회의록에도 있는지 확인하세요.",
    },
  },
  {
    situation:
      "서윤의 현재 상황과 최초 제보자를 확인하고, 지시한 일과 직접 한 일을 구분해야 합니다.",
    tips: {
      safe: "현재 본인의 설명과 오늘 동석자의 확인이 일치하는지 살펴보세요. 과거 목격만으로 현재를 단정하지 마세요.",
      sender:
        "처음 받은 제보 메일의 인증 계정을 이전 자료의 계정 실명표와 대조하세요.",
      instruction:
        "출입 인증과 지시 쪽지가 각각 무엇까지 입증하는지 구분하세요.",
    },
  },
  {
    situation:
      "주민들에게 남길 보고서를 완성해야 합니다. 입증된 돈의 흐름과 삭제 계획을 정리하고, 미확정 사실을 골라내세요.",
    tips: {
      money:
        "이체 금액과 계좌 소유 업체, 승인자와 대표자의 관계, 공개된 지급처를 각각 출처에 연결하세요.",
      purpose:
        "공지의 자료 보관 약속, 실행 작업의 테이블과 백업 설정, 자료 대조표를 함께 확인하세요.",
      remaining:
        "지시·실행·책임 중 아직 직접 확인하지 못한 부분을 구분하세요. 이전 사건의 증거도 사용할 수 있습니다.",
    },
  },
];

export function questionPreparation(
  episode: Episode,
  question: Question,
  progress: Progress,
  feedback?: Feedback | null,
) {
  const draft = progress.drafts[episode.id]?.[question.id];
  const answered =
    !!draft &&
    (Array.isArray(draft.answer)
      ? draft.answer.length === question.options?.length
      : !!draft.answer.trim());
  const evidenceCount = new Set(
    (draft?.evidence ?? []).filter((id) => progress.pinned.includes(id)),
  ).size;
  const ready =
    answered &&
    evidenceCount >= question.evidenceCount &&
    evidenceCount <= evidenceLimit(question) &&
    evidenceCount === draft?.evidence.length;
  const result = feedback?.[question.id];
  const confirmed =
    progress.solved.includes(episode.id) ||
    !!(result?.answer && result.evidence);
  const needsReview =
    !confirmed && !!result && (!result.answer || !result.evidence);
  const label = confirmed
    ? "입증 완료"
    : result && !result.answer
      ? "답 다시 검토"
      : result && !result.evidence
        ? "근거 다시 검토"
        : ready
          ? "검증 준비됨"
          : answered
            ? "근거 선택하기"
            : "답 찾는 중";
  return { answered, evidenceCount, ready, confirmed, needsReview, label };
}
