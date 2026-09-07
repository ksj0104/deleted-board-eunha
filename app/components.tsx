"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
export const GameErrorContext = createContext("");
export function Dialog({
  label,
  children,
  onClose,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const error = useContext(GameErrorContext);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <button className="close-button" aria-label="닫기" onClick={onClose}>
        ×
      </button>
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}
export function Search({
  query,
  onChange,
}: {
  query: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="search">
      <span aria-hidden="true">⌕</span>
      <input
        aria-label="기록 검색"
        type="search"
        placeholder="기록 속 단어 검색"
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Empty({
  text,
  detail,
  onReset,
}: {
  text: string;
  detail: string;
  onReset: () => void;
}) {
  return (
    <div className="empty-state">
      <span>⌑</span>
      <h3>{text}</h3>
      <p>{detail}</p>
      <button className="secondary" onClick={onReset}>
        게시판 기록 보기
      </button>
    </div>
  );
}
export function CodeInput({
  value,
  placeholder,
  label,
  disabled,
  onCommit,
}: {
  value: string;
  placeholder: string;
  label: string;
  disabled: boolean;
  onCommit: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);
  return (
    <form
      className="code-entry"
      onSubmit={(e) => {
        e.preventDefault();
        onCommit(text);
      }}
    >
      <input
        aria-label={label}
        maxLength={100}
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
      />
      <button
        className="secondary"
        disabled={disabled || text === value}
        type="submit"
      >
        입력 적용
      </button>
      {text !== value && (
        <span className="input-unsaved">적용하면 저장됩니다</span>
      )}
    </form>
  );
}
