"use client";
import React from "react";
import type { Episode } from "../lib/cases";
import { episodeStories } from "../lib/stories";
import { Dialog } from "./components";
import { mainCase, caseThreads } from "../lib/narrative";

const firstSteps = [
  [
    "전출 안내와 주민 글의 작성자 흔적 비교하기",
    "개인 약속과 모임 취소가 가리키는 범위 확인하기",
  ],
  [
    "점검 영상과 센서에서 같은 문 동작 찾기",
    "대조한 시각으로 출입·복사·정전의 순서 정리하기",
  ],
  [
    "결산서·청구서·은행 이체의 금액과 지급처 비교하기",
    "파쇄 쪽지를 복원하고 업체와 승인자 연결하기",
  ],
  [
    "출입 기록과 공사 안내에서 조회 대상을 찾아 원본 확보하기",
    "이동 기록을 지도에 연결하고 정전 상태의 문 시험하기",
  ],
  [
    "색인 조각의 연결 표식을 따라 보관함 찾기",
    "봉인과 보존표를 대조해 사용할 원본 구분하기",
  ],
  [
    "공지의 표시 명의와 실제 변경 계정 비교하기",
    "삭제 예약과 회의록을 공지 내용에 대조하기",
  ],
  [
    "오늘의 안부와 최초 제보 메일의 발신 경로 확인하기",
    "출입·지시·실행이 각각 어디까지 확인됐는지 구분하기",
  ],
  [
    "입증된 사실과 후속 조사할 주장을 나눠 보고서 정리하기",
    "공개할 정보의 범위를 정하고 기록을 남기기",
  ],
];

export default function StoryPrologue({
  episode,
  first,
  pending,
  onContinue,
}: {
  episode: Episode;
  first: boolean;
  pending: boolean;
  onContinue: () => void;
}) {
  const story = episodeStories[episode.id - 1];
  const thread = caseThreads[episode.id - 1];
  return (
    <Dialog
      wide
      label={
        first
          ? "기록자에게 도착한 의뢰"
          : `사건 ${String(episode.id).padStart(2, "0")} 프롤로그`
      }
      onClose={onContinue}
    >
      <div className="story-prologue">
        <figure className="story-scene">
          <img
            src={`story/${String(episode.id).padStart(2, "0")}.webp`}
            alt={story.imageAlt}
            width="1536"
            height="1024"
          />
          <figcaption>
            <span>CASE {String(episode.id).padStart(2, "0")} · PROLOGUE</span>
            <strong>{story.location}</strong>
          </figcaption>
        </figure>
        <div className="story-copy">
          <p className="eyebrow coral">{story.scene}</p>
          <h2>{first ? "이 기록이 사라지기 전에." : episode.title}</h2>
          <div className="story-paragraphs">
            <p>{story.paragraphs[0]}</p>
            {story.paragraphs.length > 1 && (
              <details className="story-background">
                <summary>앞선 이야기 더 읽기</summary>
                {story.paragraphs.slice(1).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </details>
            )}
          </div>
          <section className="story-mission">
            <h3>{first ? "이 사건의 중심" : "이번 조사가 필요한 이유"}</h3>
            <strong className="story-main-question">
              {first ? mainCase.question : thread.question}
            </strong>
            <p>{episode.objective}</p>
            <p className="story-entry-reason">{thread.entryReason}</p>
          </section>
          <section className="story-first-steps">
            <h3>이번 장에서 할 일</h3>
            <ol>
              {firstSteps[episode.id - 1].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
          {first && (
            <div className="story-how">
              <span>01 주민마당과 받은 자료함 살펴보기</span>
              <span>02 중요한 기록 수집하기</span>
              <span>03 기록에서 생긴 의문을 추리 노트에 정리하기</span>
              <p>
                증거 보관함과 추리 노트는 조사 화면 위의 창으로 열립니다. 8화
                완결 · 시간 제한 없음 · 진행 자동 저장
              </p>
            </div>
          )}
          <button
            className="primary full"
            data-sound="silent"
            disabled={pending}
            onClick={onContinue}
          >
            {first ? "첫 번째 기록 열기 →" : "조사 이어가기 →"}
          </button>
          {first && !pending && (
            <a className="story-library-link" href="#">
              다른 게임 선택
            </a>
          )}
        </div>
      </div>
    </Dialog>
  );
}
