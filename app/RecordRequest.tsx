"use client";
import React, { useState } from "react";
import { requestFor } from "../lib/record-requests";

export default function RecordRequest({
  record,
  onSubmit,
}: {
  record: string;
  onSubmit: (input: string) => Promise<boolean>;
}) {
  const request = requestFor(record)!;
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="record-request">
      <p className="eyebrow">{request.from}</p>
      <h2 className="modal-title">{request.title} 조회</h2>
      <p>{request.instruction}</p>
      <p>
        조사 대상은 관련 원문에서 확인해야 합니다. 조회에 성공하면 받은 자료함에
        원본이 추가됩니다.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          const ok = await onSubmit(input);
          if (!ok)
            setMessage(
              "조회 대상을 확인하지 못했습니다. 관련 원문과 입력한 정보를 다시 비교하세요.",
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
          disabled={pending || !input.trim()}
        >
          {pending ? "조회 중…" : "원본 조회 요청"}
        </button>
      </form>
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
