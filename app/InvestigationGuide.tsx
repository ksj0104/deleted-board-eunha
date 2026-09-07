"use client";
import React from "react";
import type { Episode, RecordFile } from "../lib/cases";
import type { Feedback, Progress } from "../lib/game";
import { investigationGuides, questionPreparation } from "../lib/investigation";

export default function InvestigationGuide({
  episode,
  progress,
  feedback,
  onQuestion,
  onOpen,
  onHint,
  onResolution,
}: {
  episode: Episode;
  progress: Progress;
  feedback: Feedback | null;
  onQuestion: (id?: string) => void;
  onOpen: (record: RecordFile) => void;
  onHint: () => void;
  onResolution: () => void;
}) {
  const guide = investigationGuides[episode.id - 1];
  const states = episode.questions.map((q) =>
    questionPreparation(episode, q, progress, feedback),
  );
  const ready = states.filter(
    (s) => (s.ready && !s.needsReview) || s.confirmed,
  ).length;
  const solved = progress.solved.includes(episode.id);
  const first = episode.records[0];
  const started = episode.records.some((r) => progress.read.includes(r.id));
  const next = states.findIndex(
    (s) => !s.confirmed && (!s.ready || s.needsReview),
  );
  const allPrepared = ready === episode.questions.length;
  const nextText = solved
    ? "세 질문을 모두 입증했습니다. 해결 내용을 확인하고 이야기를 이어가세요."
    : allPrepared
      ? "답과 근거가 준비되었습니다. 추리 노트 아래의 ‘세 가설 검증하기’를 누르세요."
      : states[Math.max(0, next)].needsReview
        ? `질문 ${next + 1}은 재검토가 필요합니다. 추리 노트의 검증 결과에서 답과 근거 중 무엇을 고쳐야 하는지 확인하세요.`
        : !started
          ? "어디서 시작할지 모르겠다면 아래 글을 먼저 읽으세요. 질문과 관련된 기록을 ‘증거 수집’으로 보관하세요."
          : `질문 ${Math.max(0, next) + 1}의 ${states[Math.max(0, next)].answered ? "근거를 선택할 차례입니다. 수집한 기록 중 이 답을 뒷받침하는 글을 고르세요." : "답을 찾아보세요. 관련 글을 읽고 추리 노트에서 답과 근거를 함께 선택하세요."}`;
  return (
    <section className="investigation-guide" aria-label="이번 사건의 해결 목표">
      <header>
        <div>
          <span className="eyebrow coral">
            CASE {String(episode.id).padStart(2, "0")} · 당신이 해결할 일
          </span>
          <h2>이 세 가지를 밝혀 주세요</h2>
          <p>{guide.situation}</p>
        </div>
        <span className="goal-total">
          {solved ? "사건 해결" : `답과 근거 준비 ${ready}/3`}
        </span>
      </header>
      <ol className="goal-list">
        {episode.questions.map((q, i) => (
          <li key={q.id} className={states[i].confirmed ? "confirmed" : ""}>
            <div className="goal-label">
              <span>질문 {i + 1}</span>
              <span>{states[i].label}</span>
            </div>
            <strong>{q.prompt}</strong>
            <p>{guide.tips[q.id]}</p>
            <div className="goal-progress">
              <span>
                {states[i].answered || states[i].confirmed
                  ? "✓ 답 입력됨"
                  : "○ 답 미입력"}
              </span>
              <span>
                근거 {states[i].evidenceCount}/{q.evidenceCount}개
              </span>
            </div>
            <button
              className="text-button"
              aria-label={`질문 ${i + 1} 답과 근거 작성`}
              onClick={() => onQuestion(q.id)}
            >
              {states[i].confirmed
                ? "답과 근거 확인"
                : `질문 ${i + 1} 답과 근거 작성`}{" "}
              ↗
            </button>
          </li>
        ))}
      </ol>
      <div className="next-investigation-step" aria-live="polite">
        <div>
          <b>{solved ? "조사 완료" : "지금 할 일"}</b>
          <p>{nextText}</p>
        </div>
        {solved ? (
          <button className="primary" onClick={onResolution}>
            해결 내용과 다음 이야기 →
          </button>
        ) : !started ? (
          <button className="primary" onClick={() => onOpen(first)}>
            먼저 읽을 글: {first.title} ↗
          </button>
        ) : (
          <button
            className="primary"
            onClick={() =>
              onQuestion(
                allPrepared
                  ? undefined
                  : episode.questions[Math.max(0, next)].id,
              )
            }
          >
            {allPrepared
              ? "추리 노트에서 검증하기 →"
              : "이어서 답과 근거 작성 →"}
          </button>
        )}
      </div>
      <footer>
        <p>
          세 질문의 <b>답과 지정된 개수의 근거</b>를 함께 맞히면 사건이
          해결됩니다. 모든 일상 글을 읽거나 수집할 필요는 없습니다.
        </p>
        {!solved && (
          <button className="text-button" onClick={onHint}>
            막혔을 때 힌트 보기 ↗
          </button>
        )}
      </footer>
    </section>
  );
}
