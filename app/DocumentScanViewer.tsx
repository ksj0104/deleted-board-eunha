"use client";
import React, { useState } from "react";
import type { DocumentScan } from "../lib/document-scans";
import { Dialog } from "./components";
import { useSound } from "./sound-context";

export default function DocumentScanViewer({
  pages,
}: {
  pages: DocumentScan[];
}) {
  const [page, setPage] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const [zoom, setZoom] = useState(false);
  const sound = useSound();
  const selected = pages[page] ?? pages[0];
  const pageButtons = pages.length > 1 && (
    <div className="scan-pages" role="group" aria-label="문서 페이지 선택">
      {pages.map((item, index) => (
        <button
          key={item.src}
          type="button"
          aria-pressed={page === index}
          onClick={() => {
            setPage(index);
            setZoom(false);
            sound?.play("select");
          }}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
  return (
    <section className="document-scan" aria-label="문서 이미지 열람">
      {pageButtons}
      <button
        type="button"
        className="scan-preview"
        aria-label={`${selected.title} 확대`}
        onClick={() => {
          setEnlarged(true);
          setZoom(false);
          sound?.play("open");
        }}
      >
        <img src={selected.src} alt={selected.alt} draggable={false} />
        <span>눌러서 원본 확대 ↗</span>
      </button>
      {enlarged && (
        <Dialog wide label="문서 원본 확대" onClose={() => setEnlarged(false)}>
          <h2 className="modal-title">{selected.title}</h2>
          {pageButtons}
          <button
            type="button"
            className="secondary"
            aria-pressed={zoom}
            onClick={() => setZoom(!zoom)}
          >
            {zoom ? "문서 전체 보기" : "세부 확대 150%"}
          </button>
          <div
            className={`scan-inspection ${zoom ? "zoomed" : ""}`}
            tabIndex={0}
            aria-label="확대한 문서, 스크롤하여 읽기"
          >
            <img src={selected.src} alt={selected.alt} draggable={false} />
          </div>
        </Dialog>
      )}
    </section>
  );
}
