"use client";
import React from "react";
import type { Episode } from "../lib/cases";
import { episodeStories } from "../lib/stories";
import { Dialog } from "./components";
import { mainCase, caseThreads } from "../lib/narrative";

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
            src={`/story/${String(episode.id).padStart(2, "0")}.webp`}
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
            {story.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          <section className="story-mission">
            <h3>{first ? "이 사건의 중심" : "이번 조사가 필요한 이유"}</h3>
            <strong className="story-main-question">
              {first ? mainCase.question : thread.question}
            </strong>
            <p>{episode.objective}</p>
            <p className="story-entry-reason">{thread.entryReason}</p>
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
            disabled={pending}
            onClick={onContinue}
          >
            {first ? "첫 번째 기록 열기 →" : "조사 이어가기 →"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
