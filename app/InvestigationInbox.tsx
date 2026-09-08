"use client";
import React, { useState } from "react";
import type { Progress } from "../lib/game";
import type { RecordFile } from "../lib/cases";
import { deliveries, deliveryRecords, worldStage } from "../lib/world";
import { readableParagraphs, recordRestored } from "../lib/restoration";

export default function InvestigationInbox({
  progress,
  onOpen,
}: {
  progress: Progress;
  onOpen: (record: RecordFile) => void;
}) {
  const stage = worldStage(progress);
  const [selection, setSelection] = useState<{ id: number; stage: number }>();
  const [searchState, setSearchState] = useState({ stage, query: "" });
  const query = searchState.stage === stage ? searchState.query : "";
  const search = query.trim().toLocaleLowerCase();
  const received = deliveries
    .slice(0, stage)
    .filter(
      (d) =>
        !search ||
        [
          d.from,
          d.subject,
          d.body,
          ...deliveryRecords(d.episode).flatMap((r) => [
            r.title,
            ...readableParagraphs(r, progress),
            ...(r.surveillance?.frames.map((frame) => frame.alt) ?? []),
          ]),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search),
    )
    .reverse();
  const selected =
    received.find(
      (d) => d.episode === (selection?.stage === stage ? selection.id : stage),
    ) ?? received[0];
  return (
    <section className="investigation-inbox" aria-label="받은 자료함">
      <header className="inbox-header">
        <div>
          <span className="eyebrow coral">기록자의 개인 수신함</span>
          <h2>회신과 인계 자료</h2>
          <p>누가 보냈는지, 어떤 기록과 비교할 수 있는지 확인하세요.</p>
        </div>
        <span>{stage}개의 수신 기록</span>
      </header>
      <label className="search inbox-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          aria-label="받은 자료 검색"
          placeholder="보낸 사람, 제목, 첨부 내용 검색"
          value={query}
          onChange={(event) =>
            setSearchState({ stage, query: event.target.value })
          }
        />
      </label>
      {selected ? (
        <div className="inbox-columns">
          <nav className="delivery-list" aria-label="받은 회신 목록">
            {received.map((delivery) => {
              const unread = deliveryRecords(delivery.episode).filter(
                (r) => !progress.read.includes(r.id),
              ).length;
              return (
                <button
                  key={delivery.episode}
                  aria-pressed={selected.episode === delivery.episode}
                  onClick={() => setSelection({ id: delivery.episode, stage })}
                >
                  <span>{delivery.from}</span>
                  <strong>{delivery.subject}</strong>
                  <small>
                    {delivery.date}
                    {unread > 0
                      ? ` · 안 읽은 첨부 ${unread}`
                      : " · 첨부 확인함"}
                  </small>
                </button>
              );
            })}
          </nav>
          <article className="delivery-message" aria-label={selected.subject}>
            <span className="eyebrow">받은 기록</span>
            <h3>{selected.subject}</h3>
            <dl>
              <div>
                <dt>보낸 곳</dt>
                <dd>{selected.from}</dd>
              </div>
              <div>
                <dt>받은 시각</dt>
                <dd>2026.{selected.date}</dd>
              </div>
              <div>
                <dt>자료 출처</dt>
                <dd>{selected.source}</dd>
              </div>
            </dl>
            <p className="delivery-body">{selected.body}</p>
            <h4>첨부된 기록 {deliveryRecords(selected.episode).length}개</h4>
            <div className="delivery-attachments">
              {deliveryRecords(selected.episode).map((r) => (
                <button
                  key={r.id}
                  className="delivery-attachment"
                  aria-label={`${r.title} 열기`}
                  onClick={() => onOpen(r)}
                >
                  <span aria-hidden="true">▤</span>
                  <div>
                    <strong>{r.title}</strong>
                    <small>
                      {r.board} · 원문 {r.date}
                    </small>
                  </div>
                  <span>
                    {r.shredded
                      ? recordRestored(r, progress)
                        ? "복원 완료"
                        : "복원하기 ↗"
                      : progress.read.includes(r.id)
                        ? "읽음"
                        : "열기 ↗"}
                  </span>
                </button>
              ))}
            </div>
          </article>
        </div>
      ) : (
        <p className="inbox-empty">일치하는 받은 자료가 없습니다.</p>
      )}
    </section>
  );
}
