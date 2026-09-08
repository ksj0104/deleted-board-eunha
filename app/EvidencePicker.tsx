"use client";
import React, { useId, useRef, useState } from "react";
import type { RecordFile } from "../lib/cases";
import { isPublicRecord } from "../lib/world";

type EvidencePickerProps = {
  records: RecordFile[];
  selectedIds: string[];
  minimum: number;
  maximum?: number;
  disabled?: boolean;
  onToggle: (id: string) => void;
  onRead: (record: RecordFile) => void;
  onCollect: () => void;
};

const PAGE_SIZE = 8;
const sourceLabel = (record: RecordFile) =>
  isPublicRecord(record) ? "주민 게시판" : "받은 자료함";

export default function EvidencePicker({
  records,
  selectedIds,
  minimum,
  maximum = minimum,
  disabled = false,
  onToggle,
  onRead,
  onCollect,
}: EvidencePickerProps) {
  const id = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLUListElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);
  const selected = records.filter((record) => selectedIds.includes(record.id));
  const selectionLabel =
    minimum === maximum ? `${minimum}개` : `${minimum}~${maximum}개`;
  const search = query.trim().toLocaleLowerCase();
  // Keep the player's collection order. Neither the question nor its solution
  // participates in filtering or ranking the records.
  const matches = records.filter(
    (record) =>
      (source === "all" || (source === "public") === isPublicRecord(record)) &&
      (!search ||
        [
          record.id,
          record.title,
          record.author,
          ...record.paragraphs,
          // Only collected records reach this picker; shredded originals have been restored.
          ...(record.shredded?.transcript ?? []),
          ...(record.comments ?? []).flatMap((comment) => [
            comment.author,
            comment.text,
          ]),
          record.attachment?.title ?? "",
          ...(record.attachment?.columns ?? []),
          ...(record.attachment?.rows.flat() ?? []),
          record.photo?.caption ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search)),
  );
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const shown = matches.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const changePage = (next: number) => {
    setPage(next);
    resultsRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      className="evidence-picker"
      role="group"
      aria-labelledby={`${id}-heading`}
    >
      <div className="proof-heading" id={`${id}-heading`}>
        <span>
          뒷받침하는 증거{" "}
          <strong>
            {selected.length}/{maximum}
          </strong>
        </span>
        <small>{selectionLabel} 선택</small>
      </div>
      <p className="proof-help" id={`${id}-help`}>
        이 답을 뒷받침하는 기록을 연결하세요. 체크하면 바로 연결되고 자동
        저장됩니다.
      </p>
      <span className="sr-only" role="status">
        연결한 증거 {selected.length}개. {selectionLabel} 선택.
      </span>
      {selected.length ? (
        <ul
          ref={selectedRef}
          className="selected-evidence"
          aria-label="연결한 증거"
        >
          {selected.map((record, index) => (
            <li key={record.id}>
              <button
                type="button"
                className="selected-evidence-read"
                aria-label={`${record.title} 선택한 증거 원문 읽기`}
                onClick={() => onRead(record)}
              >
                <span className="proof-id">{record.id}</span>
                <strong>{record.title}</strong>
                <small>
                  {sourceLabel(record)} · {record.author}
                </small>
              </button>
              <button
                type="button"
                className="selected-evidence-remove"
                aria-label={`${record.id} ${record.title} 근거 연결 해제`}
                disabled={disabled}
                onClick={() => {
                  const removers =
                    selectedRef.current?.querySelectorAll<HTMLButtonElement>(
                      ".selected-evidence-remove",
                    );
                  const nextFocus =
                    removers?.[index + 1] ??
                    removers?.[index - 1] ??
                    toggleRef.current;
                  nextFocus?.focus({ preventScroll: true });
                  onToggle(record.id);
                }}
              >
                해제 ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="evidence-unselected">아직 연결한 증거가 없습니다.</p>
      )}
      {records.length ? (
        <>
          <button
            type="button"
            ref={toggleRef}
            className="evidence-picker-toggle"
            aria-expanded={expanded}
            aria-controls={`${id}-search`}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "증거 찾기 접기" : "증거 찾기"}
            <span aria-hidden="true">{expanded ? "−" : "+"}</span>
          </button>
          {expanded && (
            <div
              className="evidence-picker-search"
              id={`${id}-search`}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.stopPropagation();
                  setExpanded(false);
                  toggleRef.current?.focus({ preventScroll: true });
                }
              }}
            >
              <div className="evidence-picker-controls">
                <label>
                  <span>수집한 증거 검색</span>
                  <input
                    type="search"
                    placeholder="제목·본문·기록 번호로 찾기"
                    aria-describedby={`${id}-help`}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label>
                  <span>증거 출처</span>
                  <select
                    value={source}
                    onChange={(event) => {
                      setSource(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">전체 출처</option>
                    <option value="public">주민 게시판</option>
                    <option value="inbox">받은 자료함</option>
                  </select>
                </label>
              </div>
              <p className="evidence-match-count" role="status">
                수집한 {records.length}개 중 {matches.length}개
                {selected.length >= maximum && (
                  <span> · 다른 증거를 연결하려면 먼저 하나를 해제하세요.</span>
                )}
              </p>
              <div
                className="evidence-picker-results"
                ref={resultsRef}
                tabIndex={-1}
                role="group"
                aria-label="증거 검색 결과"
              >
                {shown.map((record) => {
                  const checked = selectedIds.includes(record.id);
                  return (
                    <div className="proof-option" key={record.id}>
                      <label className={checked ? "selected" : ""}>
                        <input
                          type="checkbox"
                          aria-label={`${record.id} ${record.title}`}
                          checked={checked}
                          disabled={
                            disabled || (!checked && selected.length >= maximum)
                          }
                          onChange={() => onToggle(record.id)}
                        />
                        <span>
                          <span className="proof-id">{record.id}</span>
                          <strong>{record.title}</strong>
                          <small>
                            {sourceLabel(record)} · {record.board} ·{" "}
                            {record.author}
                          </small>
                        </span>
                      </label>
                      <button
                        type="button"
                        className="proof-read"
                        aria-label={`${record.title} 원문 읽기`}
                        onClick={() => onRead(record)}
                      >
                        원문 ↗
                      </button>
                    </div>
                  );
                })}
                {!shown.length && (
                  <div className="evidence-search-empty">
                    <p>일치하는 증거가 없습니다.</p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setQuery("");
                        setSource("all");
                        setPage(1);
                      }}
                    >
                      검색·출처 초기화
                    </button>
                  </div>
                )}
              </div>
              {pages > 1 && (
                <nav
                  className="evidence-pagination"
                  aria-label="증거 검색 결과 페이지"
                >
                  <button
                    type="button"
                    className="text-button"
                    disabled={currentPage === 1}
                    onClick={() => changePage(currentPage - 1)}
                  >
                    ← 앞선 증거
                  </button>
                  <span aria-live="polite">
                    {currentPage} / {pages} 페이지
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    disabled={currentPage === pages}
                    onClick={() => changePage(currentPage + 1)}
                  >
                    다음 증거 →
                  </button>
                </nav>
              )}
              <p className="evidence-keyboard-help">
                Tab으로 이동 · Space로 선택 · Esc로 목록 접기
              </p>
            </div>
          )}
        </>
      ) : (
        <button type="button" className="collect-prompt" onClick={onCollect}>
          게시판에서 증거 수집하기 ↗
        </button>
      )}
    </div>
  );
}
