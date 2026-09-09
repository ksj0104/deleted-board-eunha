"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useId,
} from "react";
import { useSound } from "./sound-context";
import { normalizeTime } from "../lib/time-input";
export const GameErrorContext = createContext("");
let openDialogs = 0;
let previousOverflow = "";
const backdropClickTolerance = 5;

function isBackdropEvent(event: React.MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const { left, right, top, bottom } =
    event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < left ||
    event.clientX >= right ||
    event.clientY < top ||
    event.clientY >= bottom
  );
}

export function Dialog({
  label,
  children,
  onClose,
  wide = false,
  focusTarget,
  closeLabel = "닫기",
}: {
  label: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  focusTarget?: string;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef<{
    pointerId: number;
    x: number;
    y: number;
    released: boolean;
  } | null>(null);
  const error = useContext(GameErrorContext);
  const sound = useSound();
  const close = () => {
    sound?.play("close");
    onClose();
  };
  useEffect(() => {
    const d = ref.current;
    if (openDialogs++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
      if (--openDialogs === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    const target = focusTarget ? document.getElementById(focusTarget) : null;
    if (dialog && target && dialog.contains(target)) {
      target.focus({ preventScroll: true });
      dialog.scrollTop = Math.max(
        0,
        dialog.scrollTop +
          target.getBoundingClientRect().top -
          dialog.getBoundingClientRect().top -
          24,
      );
    }
  }, [focusTarget]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      aria-label={label}
      onCancel={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.target === e.currentTarget) close();
      }}
      onPointerDownCapture={(e) => {
        // A drag can produce a click targeted at the dialog itself. Remember
        // where the gesture began; the border box also contains its padding
        // and scrollbar, neither of which is the backdrop.
        backdropPress.current =
          e.isPrimary && e.button === 0 && isBackdropEvent(e)
            ? {
                pointerId: e.pointerId,
                x: e.clientX,
                y: e.clientY,
                released: false,
              }
            : null;
      }}
      onPointerMoveCapture={(e) => {
        const press = backdropPress.current;
        if (
          press &&
          e.pointerId === press.pointerId &&
          (!isBackdropEvent(e) ||
            Math.hypot(e.clientX - press.x, e.clientY - press.y) >
              backdropClickTolerance)
        ) {
          backdropPress.current = null;
        }
      }}
      onPointerUpCapture={(e) => {
        const press = backdropPress.current;
        if (!press) return;
        if (
          e.pointerId !== press.pointerId ||
          !isBackdropEvent(e) ||
          Math.hypot(e.clientX - press.x, e.clientY - press.y) >
            backdropClickTolerance
        ) {
          backdropPress.current = null;
        } else {
          press.released = true;
        }
      }}
      onPointerCancelCapture={() => {
        backdropPress.current = null;
      }}
      onDragStartCapture={() => {
        backdropPress.current = null;
      }}
      onClick={(e) => {
        const press = backdropPress.current;
        backdropPress.current = null;
        if (press?.released && e.button === 0 && isBackdropEvent(e)) close();
      }}
    >
      <button className="close-button" aria-label={closeLabel} onClick={close}>
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
  format,
}: {
  value: string;
  placeholder: string;
  label: string;
  disabled: boolean;
  onCommit: (v: string) => void;
  format?: "time";
}) {
  const description = useId();
  const [text, setText] = useState(value);
  const [attempted, setAttempted] = useState(false);
  const invalid = format === "time" && !!text.trim() && !normalizeTime(text);
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setText(value);
  }
  return (
    <form
      className="code-entry"
      onSubmit={(e) => {
        e.preventDefault();
        setAttempted(true);
        if (invalid) return;
        onCommit(text);
      }}
    >
      <input
        aria-label={label}
        maxLength={100}
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          setAttempted(false);
        }}
        aria-invalid={(attempted && invalid) || undefined}
        aria-describedby={format === "time" ? description : undefined}
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
      {format === "time" && (
        <p
          id={description}
          className="input-format"
          role={attempted && invalid ? "alert" : undefined}
        >
          {attempted && invalid
            ? "시각 형식을 확인하세요. 00:00~23:59 사이의 HH:MM 또는 HH:MM:SS로 입력할 수 있습니다."
            : "입력 예: 09:30 또는 09:30:00 · 초를 생략하면 00초로 읽습니다."}
        </p>
      )}
    </form>
  );
}
