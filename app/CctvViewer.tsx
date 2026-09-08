"use client";
import React, { useState } from "react";
import type { RecordFile } from "../lib/cases";
import { Dialog } from "./components";
import { useSound } from "./sound-context";
import {
  inspectionCaptures,
  clockLabel,
  clockMinutes,
} from "../lib/calibration";

export default function CctvViewer({
  footage,
  offset,
}: {
  footage: NonNullable<RecordFile["surveillance"]>;
  offset?: number;
}) {
  const [frame, setFrame] = useState(0);
  const [inspection, setInspection] = useState(false);
  const [corrected, setCorrected] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [zoom, setZoom] = useState(false);
  const sound = useSound();
  const frames = inspection ? inspectionCaptures : footage.frames;
  const selected = frames[frame];
  const select = (index: number) => {
    setFrame(index);
    sound?.play("open");
  };
  const frameButtons = (
    <div
      className="cctv-frame-buttons"
      role="group"
      aria-label="CCTV 캡처 선택"
    >
      {frames.map((_, index) => (
        <button
          key={index}
          type="button"
          aria-pressed={frame === index}
          onClick={() => select(index)}
        >
          캡처 {String(index + 1).padStart(2, "0")}
        </button>
      ))}
    </div>
  );
  const clockControls = offset !== undefined && (
    <div className="cctv-clock-controls">
      <div role="group" aria-label="시각 표시 방식">
        <button
          type="button"
          aria-pressed={!corrected}
          onClick={() => setCorrected(false)}
        >
          원본 시각
        </button>
        <button
          type="button"
          aria-pressed={corrected}
          onClick={() => setCorrected(true)}
        >
          보정 시각
        </button>
      </div>
      <p aria-live="polite">
        {corrected ? "대조한 표준시" : "원본 화면 시각"}{" "}
        <strong>
          {clockLabel(
            clockMinutes(selected.displayTime) + (corrected ? offset : 0),
          )}
        </strong>
      </p>
      <small>이미지 속 시각은 원본 그대로 보존됩니다.</small>
    </div>
  );
  return (
    <section className="cctv-viewer" aria-label={`${footage.camera} 보관 영상`}>
      <header>
        <span>{footage.camera} · 보관 화면</span>
        <span>
          캡처 {frame + 1} / {frames.length}
        </span>
      </header>
      <div className="cctv-sections" role="group" aria-label="보관 구간 선택">
        <button
          type="button"
          aria-pressed={!inspection}
          onClick={() => {
            setInspection(false);
            setFrame(0);
          }}
        >
          회색 외투 장면
        </button>
        <button
          type="button"
          aria-pressed={inspection}
          onClick={() => {
            setInspection(true);
            setFrame(0);
          }}
        >
          점검 중 표지가 있는 장면
        </button>
      </div>
      {frameButtons}
      {clockControls}
      <button
        className="cctv-preview"
        type="button"
        aria-label="선택한 CCTV 캡처 확대"
        onClick={() => {
          sound?.play("open");
          setEnlarged(true);
          setZoom(false);
        }}
      >
        <img src={selected.src} alt={selected.alt} width="1536" height="1024" />
        <span>확대해서 살펴보기 ↗</span>
      </button>
      <p className="cctv-caption">
        기록 보관기에서 추출한 원본 캡처 · 카메라의 화면 시각 유지
      </p>
      {enlarged && (
        <Dialog wide label="CCTV 캡처 확대" onClose={() => setEnlarged(false)}>
          <div className="cctv-enlarged">
            <h2>{footage.camera} 보관 화면</h2>
            {clockControls}
            <div className="cctv-toolbar">
              {frameButtons}
              <button
                className="secondary"
                type="button"
                aria-pressed={zoom}
                onClick={() => setZoom(!zoom)}
              >
                {zoom ? "전체 화면 보기" : "세부 확대 150%"}
              </button>
            </div>
            <div
              className={`cctv-inspection ${zoom ? "zoomed" : ""}`}
              tabIndex={0}
              aria-label="CCTV 이미지. 세부 확대 후 가로와 세로로 스크롤할 수 있습니다."
            >
              <img
                src={selected.src}
                alt={selected.alt}
                width="1536"
                height="1024"
              />
            </div>
            <p className="cctv-caption">
              캡처를 바꿔 비교할 수 있습니다. 세부 확대에서는 화면을 스크롤해
              살펴보세요.
            </p>
          </div>
        </Dialog>
      )}
    </section>
  );
}
