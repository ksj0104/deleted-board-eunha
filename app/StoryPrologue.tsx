"use client";
import React from "react";
import type { Episode } from "../lib/cases";
import { episodeStories } from "../lib/stories";
import { Dialog } from "./components";

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
            <h3>이번 사건에서 밝혀야 할 것</h3>
            <p>{episode.objective}</p>
            <ol>
              {episode.questions.map((q) => (
                <li key={q.id}>{q.prompt}</li>
              ))}
            </ol>
          </section>
          {first && (
            <div className="story-how">
              <span>01 글과 댓글 살펴보기</span>
              <span>02 중요한 기록 수집하기</span>
              <span>03 추리 노트에서 답과 근거 연결하기</span>
              <p>
                증거 보관함과 추리 노트는 게시판 위의 창으로 열립니다. 8화 완결
                · 시간 제한 없음 · 진행 자동 저장
              </p>
            </div>
          )}
          <button
            className="primary full"
            disabled={pending}
            onClick={onContinue}
          >
            {first ? "첫 번째 기록 열기 →" : "게시판에서 조사 시작 →"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
