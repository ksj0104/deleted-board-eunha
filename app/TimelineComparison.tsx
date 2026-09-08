"use client";
import React, { useEffect, useRef, useState } from "react";
import { Dialog } from "./components";
import { useSound } from "./sound-context";
import {
  clockLabel,
  clockMinutes,
  comparisonMatches,
  inspectionCaptures,
  inspectionEvents,
  MAX_OFFSET,
  MIN_OFFSET,
  type Calibration,
} from "../lib/calibration";

const AXIS_START = clockMinutes("19:35");
const MINUTE_WIDTH = 18;
const x = (time: string, offset = 0) =>
  (clockMinutes(time) + offset - AXIS_START) * MINUTE_WIDTH;
const signedOffset = (offset: number) =>
  offset === 0 ? "기준 위치" : `${offset > 0 ? "+" : "−"}${Math.abs(offset)}분`;

export default function TimelineComparison({
  saved,
  onSave,
}: {
  saved: Calibration;
  onSave: (offset: number, confirm: boolean) => Promise<boolean>;
}) {
  const [offset, setOffset] = useState(saved.offset);
  const latest = useRef(offset);
  const revision = useRef(0);
  const [status, setStatus] = useState("시간선 위치 자동 저장");
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [practice, setPractice] = useState(false);
  const [hint, setHint] = useState(false);
  const [message, setMessage] = useState("");
  const [capture, setCapture] = useState<number | null>(null);
  const [captureZoom, setCaptureZoom] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep the observed interval visible when the workbench opens on a narrow screen.
    if (scroll.current)
      scroll.current.scrollLeft = Math.max(
        0,
        390 - scroll.current.clientWidth / 2,
      );
  }, []);
  const drag = useRef<{
    start: number;
    offset: number;
    pointer: number;
  } | null>(null);
  const sound = useSound();
  const complete = saved.confirmed && !practice;
  const save = async (next: number) => {
    if (practice) return;
    const current = ++revision.current;
    setStatus("위치 저장 중…");
    setFailed(false);
    const ok = await onSave(next, false);
    if (current === revision.current) {
      setFailed(!ok);
      setStatus(ok ? "시간선 위치 저장됨" : "위치를 저장하지 못했습니다");
    }
  };
  const move = (next: number, persist = true) => {
    if (complete || checking) return;
    const value = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, Math.round(next)));
    if (value === latest.current) return;
    latest.current = value;
    setOffset(value);
    setMessage("");
    if (persist) {
      sound?.play("select");
      void save(value);
    }
  };
  const confirm = async () => {
    setChecking(true);
    sound?.play("verify");
    const ok = practice
      ? comparisonMatches(latest.current)
      : await onSave(latest.current, true);
    if (practice) sound?.play(ok ? "success" : "retry");
    if (ok) {
      setPractice(false);
      setFailed(false);
      setMessage("세 동작이 모두 같은 시각에 놓였습니다.");
    } else
      setMessage(
        "대조를 확인하지 못했습니다. 문 상태와 동작 사이의 간격을 다시 살펴보세요.",
      );
    setChecking(false);
  };
  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    sound?.play("select");
    void save(latest.current);
  };
  return (
    <section className="timeline-comparison">
      <span className="eyebrow">C2 보관 화면 × 정문 센서 원본</span>
      <h2 className="modal-title">같은 순간을 찾아 겹쳐 놓기</h2>
      <p>
        점검 중 표지가 있는 세 장면입니다. 사진에서 문 상태를 확인하고 센서
        기록의 같은 동작과 나란히 놓아 보세요. 캡처를 누르면 확대할 수 있습니다.
      </p>
      <div className="comparison-filmstrip">
        {inspectionCaptures.map((frame, index) => (
          <button
            type="button"
            key={frame.src}
            aria-label={`점검 캡처 ${index + 1} 확대`}
            onClick={() => {
              setCapture(index);
              setCaptureZoom(false);
            }}
          >
            <img src={frame.src} alt={frame.alt} width="1536" height="1024" />
            <span>
              캡처 {index + 1} · 화면 {frame.displayTime}
            </span>
          </button>
        ))}
      </div>
      {!complete && (
        <p className="comparison-help">
          위쪽 영상 줄을 좌우로 끌거나 아래 조절기를 사용하세요. 한 칸은
          1분입니다. 세 표시가 모두 대응하는지 살핀 뒤 대조를 확인합니다.
        </p>
      )}
      <div
        className="comparison-scroll"
        ref={scroll}
        tabIndex={0}
        aria-label="두 기록의 시간선, 가로 스크롤 가능"
      >
        <div className="comparison-chart">
          <div className="comparison-axis" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} style={{ left: i * 5 * MINUTE_WIDTH }}>
                {clockLabel(AXIS_START + i * 5)}
              </span>
            ))}
          </div>
          <span className="comparison-track-label">
            C2 영상 · {complete ? "대조 완료" : "이동할 줄"}
          </span>
          <div
            className={`comparison-track camera-track ${complete ? "confirmed" : ""}`}
            role="group"
            aria-label="CCTV 시간선 드래그 영역"
            onPointerDown={(event) => {
              if (complete || checking || event.button !== 0) return;
              drag.current = {
                start: event.clientX,
                offset: latest.current,
                pointer: event.pointerId,
              };
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              const start = drag.current;
              if (start?.pointer === event.pointerId)
                move(
                  start.offset + (event.clientX - start.start) / MINUTE_WIDTH,
                  false,
                );
            }}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            {inspectionCaptures.map((frame, index) => (
              <span
                className="comparison-marker"
                key={frame.src}
                style={{ left: x(frame.displayTime, offset) }}
              >
                <b>{index + 1}</b>
                <i />
              </span>
            ))}
          </div>
          <span className="comparison-track-label">
            정문 센서 · 서버 표준시
          </span>
          <div className="comparison-track sensor-track">
            {inspectionEvents.map((event, index) => (
              <span
                className="comparison-marker"
                key={event.time}
                style={{ left: x(event.time) }}
              >
                <b>{["A", "B", "C"][index]}</b>
                <i />
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="comparison-legend">
        {inspectionEvents.map((event, i) => (
          <span key={event.time}>
            <b>{["A", "B", "C"][i]}</b> {event.time} · {event.event}
          </span>
        ))}
      </div>
      {!complete ? (
        <>
          <div className="comparison-controls">
            <button
              type="button"
              className="secondary"
              aria-label="영상 줄 1분 왼쪽으로"
              disabled={checking || offset === MIN_OFFSET}
              onClick={() => move(latest.current - 1)}
            >
              ← 1분
            </button>
            <label htmlFor="comparison-offset">
              영상 줄 이동{" "}
              <output aria-hidden="true">{signedOffset(offset)}</output>
            </label>
            <button
              type="button"
              className="secondary"
              aria-label="영상 줄 1분 오른쪽으로"
              disabled={checking || offset === MAX_OFFSET}
              onClick={() => move(latest.current + 1)}
            >
              1분 →
            </button>
            <input
              id="comparison-offset"
              type="range"
              min={MIN_OFFSET}
              max={MAX_OFFSET}
              step="1"
              value={offset}
              disabled={checking}
              aria-label="영상 시간선 이동"
              aria-valuetext={signedOffset(offset)}
              onChange={(event) => move(Number(event.target.value))}
            />
          </div>
          <div className="comparison-actions">
            <button
              type="button"
              className="primary"
              disabled={checking}
              onClick={() => void confirm()}
            >
              {checking ? "대조 확인 중…" : "대조 확인"}
            </button>
            <button
              type="button"
              className="secondary"
              aria-expanded={hint}
              onClick={() => setHint(!hint)}
            >
              대조 요령
            </button>
            {failed && (
              <button
                type="button"
                className="secondary"
                onClick={() => void save(latest.current)}
              >
                위치 다시 저장
              </button>
            )}
            <span role="status">
              {practice ? "다시 대조하기 · 기존 결과 보존" : status}
            </span>
          </div>
          {hint && (
            <p className="comparison-hint">
              사진에서 문이 열린 뒤 닫히고 다시 열리는 흐름을 찾으세요. 센서에
              남은 동작의 순서와 간격도 같은지 확인해 보세요. 세 장면에 서로
              다른 이동량을 적용하면 같은 카메라의 기록이 될 수 없습니다.
            </p>
          )}
        </>
      ) : (
        <div className="comparison-result">
          <strong>✓ 대조 완료 · C2 보정값 {signedOffset(saved.offset)}</strong>
          <p>
            같은 문 움직임 세 건이 모두 일치합니다. 이 결과를 회색 외투 장면에
            적용하고, 출입 원본에서 대응하는 행을 찾아보세요.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setPractice(true);
              latest.current = 0;
              setOffset(0);
              setMessage("");
            }}
          >
            다시 대조하기
          </button>
        </div>
      )}
      {message && (
        <p className="comparison-message" aria-live="polite">
          {message}
        </p>
      )}
      {capture !== null && (
        <Dialog wide label="점검 캡처 확대" onClose={() => setCapture(null)}>
          <div className="cctv-enlarged">
            <h2>점검 캡처 {capture + 1}</h2>
            <button
              type="button"
              className="secondary"
              aria-pressed={captureZoom}
              onClick={() => setCaptureZoom(!captureZoom)}
            >
              {captureZoom ? "전체 화면 보기" : "세부 확대 150%"}
            </button>
            <div
              className={`cctv-inspection ${captureZoom ? "zoomed" : ""}`}
              tabIndex={0}
              aria-label="점검 캡처 세부 보기, 가로와 세로 스크롤 가능"
            >
              <img
                className="comparison-full-image"
                src={inspectionCaptures[capture].src}
                alt={inspectionCaptures[capture].alt}
                width="1536"
                height="1024"
              />
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
