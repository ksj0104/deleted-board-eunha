"use client";
import React, { useState } from "react";
import type { RecordFile } from "../lib/cases";
import { Dialog } from "./components";
import { useSound } from "./sound-context";

export default function CctvViewer({
  footage,
}: {
  footage: NonNullable<RecordFile["surveillance"]>;
}) {
  const [frame, setFrame] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const [zoom, setZoom] = useState(false);
  const sound = useSound();
  const selected = footage.frames[frame];
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
      {footage.frames.map((_, index) => (
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
  return (
    <section className="cctv-viewer" aria-label={`${footage.camera} 보관 영상`}>
      <header>
        <span>{footage.camera} · 보관 화면</span>
        <span>
          캡처 {frame + 1} / {footage.frames.length}
        </span>
      </header>
      {frameButtons}
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
