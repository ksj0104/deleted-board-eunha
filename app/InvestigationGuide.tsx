"use client";
import React from "react";
import type { Episode, RecordFile } from "../lib/cases";
import type { Progress } from "../lib/game";
import { investigationGuides, questionPreparation } from "../lib/investigation";
import { mainCase, caseThreads, inquiryDiscovered } from "../lib/narrative";

export default function InvestigationGuide({
  episode,
  progress,
  onQuestion,
  onOpen,
  onHint,
  onResolution,
}: {
  episode: Episode;
  progress: Progress;
  onQuestion: (id?: string) => void;
  onOpen: (record: RecordFile) => void;
  onHint: () => void;
  onResolution: () => void;
}) {
  const thread = caseThreads[episode.id - 1];
  const discovered = episode.questions.filter((q) =>
    inquiryDiscovered(episode, q, progress),
  );
  const states = discovered.map((q) =>
    questionPreparation(episode, q, progress),
  );
  const solved = progress.solved.includes(episode.id);
  const ready = states.filter((s) => s.confirmed || s.ready).length;
  const next = discovered.find(
    (_, i) => !states[i].confirmed && !states[i].ready,
  );
  const unread = episode.records.find((r) => !progress.read.includes(r.id));
  const allPrepared =
    discovered.length === episode.questions.length &&
    ready === episode.questions.length;
  return (
    <section className="investigation-guide" aria-label="이번 사건의 해결 목표">
      <div className="main-case-thread">
        <span>우리가 이 기록을 읽는 이유</span>
        <p>{mainCase.question}</p>
      </div>
      <header>
        <div>
          <span className="eyebrow coral">
            CASE {String(episode.id).padStart(2, "0")} · 이번에 확인할 것
          </span>
          <h2>{thread.question}</h2>
          <p>{thread.inherited}</p>
        </div>
        <span className="goal-total">
          {solved ? "사건 해결" : `발견한 의문 ${discovered.length}개`}
        </span>
      </header>
      {discovered.length > 0 ? (
        <ol className="goal-list">
          {discovered.map((q, i) => {
            const inquiry = thread.inquiries[q.id];
            return (
              <li key={q.id} className={states[i].confirmed ? "confirmed" : ""}>
                <div className="goal-label">
                  <span>기록에서 생긴 의문</span>
                  <span>{states[i].label}</span>
                </div>
                <strong>{inquiry.title}</strong>
                <p className="inquiry-cause">{inquiry.because}</p>
                <p className="inquiry-purpose">
                  <b>이걸 알아내면</b>
                  {inquiry.leadsTo}
                </p>
                <details className="inquiry-observation">
                  <summary>관찰 방향 보기</summary>
                  <p>{investigationGuides[episode.id - 1].tips[q.id]}</p>
                </details>
                <div className="goal-progress">
                  <span>
                    {states[i].answered || states[i].confirmed
                      ? "✓ 내 추리 작성됨"
                      : "○ 아직 추리 중"}
                  </span>
                  <span>풀이에 필요한 단서 수집됨</span>
                </div>
                <button
                  className="text-button"
                  aria-label={`${inquiry.title} 조사 노트 열기`}
                  onClick={() => onQuestion(q.id)}
                >
                  {states[i].confirmed
                    ? "내 추리와 근거 확인"
                    : "이 의문을 추리 노트에 정리"}{" "}
                  ↗
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="undiscovered-inquiries">{thread.entryReason}</p>
      )}
      <div className="next-investigation-step" aria-live="polite">
        <div>
          <b>
            {solved
              ? "이 조사가 전체 사건에 남긴 것"
              : allPrepared
                ? "이제 큰 질문에 답할 차례"
                : "조사를 이어갈 이유"}
          </b>
          <p>
            {solved
              ? thread.contribution
              : allPrepared
                ? `지금까지 모은 추리가 “${thread.question}”에 답이 되는지 검증해 보세요.`
                : next
                  ? thread.inquiries[next.id].leadsTo
                  : thread.entryReason}
          </p>
        </div>
        {solved ? (
          <button className="primary" onClick={onResolution}>
            알아낸 사실과 다음 단서 →
          </button>
        ) : allPrepared ? (
          <button className="primary" onClick={() => onQuestion()}>
            내 추리 검증하기 →
          </button>
        ) : next ? (
          <button className="primary" onClick={() => onQuestion(next.id)}>
            이 의문 이어서 살펴보기 →
          </button>
        ) : unread ? (
          <button className="primary" onClick={() => onOpen(unread)}>
            먼저 읽을 글: {unread.title} ↗
          </button>
        ) : (
          <button className="primary" onClick={() => onQuestion()}>
            조사 노트 펼치기 →
          </button>
        )}
      </div>
      <footer>
        <p>
          관련 단서가 충분히 수집되면 다음 질문이 추리 노트에 나타납니다. 모든
          일상 글을 읽거나 수집할 필요는 없습니다.
        </p>
        {!solved && (
          <button className="text-button" onClick={onHint}>
            막혔을 때 관찰 힌트 ↗
          </button>
        )}
      </footer>
    </section>
  );
}
