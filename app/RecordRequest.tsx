"use client";
import React, { useState } from "react";
import { missingRequestSources, requestFor } from "../lib/record-requests";
import type { Progress } from "../lib/game";
import { recordById } from "../lib/cases";

export default function RecordRequest({
  record,
  onSubmit,
  progress,
  onRead,
}: {
  record: string;
  onSubmit: (input: string) => Promise<boolean>;
  progress: Progress;
  onRead: (record: string) => void;
}) {
  const request = requestFor(record)!;
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const missing = missingRequestSources(progress, record);
  return (
    <section className="record-request">
      <p className="eyebrow">{request.from}</p>
      <h2 className="modal-title">{request.title} 조회</h2>
      <p>{request.instruction}</p>
      <p>
        조사 대상은 관련 원문에서 확인해야 합니다. 조회에 성공하면 받은 자료함에
        원본이 추가됩니다.
      </p>
      {missing.length > 0 && (
        <div className="request-prerequisites" id="request-prerequisites">
          <strong>조회 전에 확인할 원문 {missing.length}개</strong>
          <p>
            조회 대상의 날짜와 출처를 확인한 뒤 요청할 수 있습니다. 입력한 값은
            유지됩니다.
          </p>
          {missing.map((id) => (
            <button
              type="button"
              className="secondary"
              key={id}
              onClick={() => onRead(id)}
            >
              {recordById(id)!.title} 확인하기 ↗
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending || missing.length) return;
          setPending(true);
          const ok = await onSubmit(input);
          if (!ok)
            setMessage(
              "원본을 확보하지 못했습니다. 안내된 오류를 확인한 뒤 다시 요청하세요.",
            );
          setPending(false);
        }}
      >
        <label htmlFor="record-request-input">{request.label}</label>
        <input
          id="record-request-input"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setMessage("");
          }}
          maxLength={80}
          autoComplete="off"
          disabled={pending}
        />
        <button
          className="primary"
          type="submit"
          disabled={pending || !input.trim() || missing.length > 0}
          aria-describedby={
            missing.length ? "request-prerequisites" : undefined
          }
        >
          {pending ? "조회 중…" : "원본 조회 요청"}
        </button>
      </form>
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
