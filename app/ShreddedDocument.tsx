"use client";
import React, { useRef, useState } from "react";
import type { RecordFile } from "../lib/cases";
import type { Restoration } from "../lib/restoration";
import { isRestoredOrder } from "../lib/restoration";
import { useSound } from "./sound-context";
import DocumentScanViewer from "./DocumentScanViewer";

export default function ShreddedDocument({
  record,
  saved,
  onSave,
}: {
  record: RecordFile;
  saved: Restoration;
  onSave: (order: string[], verify: boolean) => Promise<boolean>;
}) {
  const doc = record.shredded!;
  const [order, setOrder] = useState(saved.order);
  const orderRef = useRef(order);
  const [selected, setSelected] = useState<number | null>(null);
  const [practice, setPractice] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState("배치 자동 저장");
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(false);
  const [fit, setFit] = useState(true);
  const [message, setMessage] = useState("");
  const drag = useRef<number | null>(null);
  const suppressClickUntil = useRef(0);
  const queued = useRef<string[] | null>(null);
  const saving = useRef<Promise<void> | null>(null);
  const revision = useRef(0);
  const sound = useSound();
  const complete = saved.complete && !practice;

  const persist = (next: string[]) => {
    if (practice) return Promise.resolve();
    queued.current = [...next];
    revision.current++;
    setFailed(false);
    setStatus("배치 저장 중…");
    if (!saving.current) {
      saving.current = (async () => {
        while (queued.current) {
          const batch = queued.current;
          queued.current = null;
          const current = revision.current;
          const ok = await onSave(batch, false);
          if (current === revision.current) {
            setFailed(!ok);
            setStatus(
              ok ? "배치 저장됨" : "배치 저장 실패 · 다시 저장해 주세요",
            );
          }
        }
      })().finally(() => {
        saving.current = null;
      });
    }
    return saving.current;
  };
  const swap = (from: number, to: number) => {
    if (complete || checking || from === to) return;
    const next = [...orderRef.current];
    [next[from], next[to]] = [next[to], next[from]];
    orderRef.current = next;
    setOrder(next);
    setSelected(null);
    setMessage("");
    sound?.play("open");
    void persist(next);
  };
  const verify = async () => {
    if (checking) return;
    setChecking(true);
    setSelected(null);
    sound?.play("verify");
    await saving.current;
    if (practice) {
      const correct = isRestoredOrder(doc, orderRef.current);
      setMessage(
        correct
          ? "글줄이 모두 이어졌습니다."
          : "아직 글줄이 이어지지 않습니다. 금액과 회신 문장의 연결을 살펴보세요.",
      );
      sound?.play(correct ? "success" : "retry");
      if (correct) setPractice(false);
    } else {
      const ok = await onSave(orderRef.current, true);
      if (!ok)
        setMessage(
          "복원을 확인하지 못했습니다. 배치와 저장 상태를 확인해 주세요.",
        );
      else {
        setFailed(false);
        setMessage("복원 완료. 이제 원문을 읽고 증거로 수집할 수 있습니다.");
      }
    }
    setChecking(false);
  };

  return (
    <section className="shred-workbench" aria-label="파쇄 문서 복원">
      <div className="shred-intro">
        <span className="shred-tag">
          봉인 회수물 S-0319 · 종이 {doc.pieces.length}조각
        </span>
        <h2>
          {complete
            ? "이어 붙인 결산 수정 쪽지"
            : "찢긴 글줄을 다시 이어 주세요"}
        </h2>
        {record.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
      {!complete && (
        <>
          <p className="shred-instructions">
            조각을 다른 자리로 드래그하거나, 바꿀 두 조각을 차례로 누르세요.
            키보드에서는 Tab으로 이동한 뒤 Enter로 선택합니다. 좁은 화면에서는
            종이를 좌우로 밀어 볼 수 있습니다.
          </p>
          <div className="shred-toolbar">
            <button
              className="secondary"
              type="button"
              aria-pressed={fit}
              onClick={() => setFit(!fit)}
            >
              {fit ? "조각 크게 보기" : "전체 조각 한눈에 보기"}
            </button>
            <span role="status">
              {practice ? "다시 맞추기 · 수집한 증거는 보존됩니다" : status}
            </span>
            <button
              type="button"
              className="secondary"
              onClick={() => setHint(!hint)}
              aria-expanded={hint}
            >
              복원 요령
            </button>
            {failed && (
              <button
                type="button"
                className="secondary"
                onClick={() => void persist(orderRef.current)}
              >
                배치 다시 저장
              </button>
            )}
          </div>
          {hint && (
            <p className="shred-hint">
              윗줄의 제목으로 왼쪽 가장자리를 찾으세요. 금액의 쉼표와 아랫줄
              회신이 동시에 이어져야 합니다. 조각의 가·나 표시는 회수할 때 붙인
              이름이며 순서가 아닙니다.
            </p>
          )}
          <p className="shred-selection" aria-live="polite">
            {selected === null
              ? "조각 하나를 고른 뒤 바꿀 자리를 선택하세요."
              : `${selected + 1}번 자리 선택됨 · 바꿀 조각을 누르세요. 같은 조각을 누르면 선택을 취소합니다.`}
          </p>
          <label className="shred-position-picker">
            선택한 조각과 자리를 바꿀 위치
            <select
              aria-label="선택한 조각과 교환할 자리"
              value=""
              disabled={selected === null || checking}
              onChange={(event) => {
                if (selected !== null && event.target.value !== "")
                  swap(selected, Number(event.target.value));
              }}
            >
              <option value="">
                {selected === null
                  ? "먼저 조각을 선택하세요"
                  : `${selected + 1}번 조각과 바꿀 자리 선택`}
              </option>
              {order.map((id, index) => (
                <option key={id} value={index} disabled={index === selected}>
                  {index + 1}번 · 조각{" "}
                  {doc.pieces.find((piece) => piece.id === id)!.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <div
        className="shred-scroll"
        tabIndex={0}
        aria-label="종이 조각 작업대, 가로 스크롤 가능"
      >
        <div
          className={`shred-strips ${complete ? "assembled" : ""} ${fit ? "fit-paper" : ""}`}
          style={{
            gridTemplateColumns: order
              .map((id) =>
                fit
                  ? `${doc.pieces.find((piece) => piece.id === id)?.width ?? 208}fr`
                  : `${(doc.pieces.find((piece) => piece.id === id)?.width ?? 208) / 2}px`,
              )
              .join(" "),
          }}
          role="group"
          aria-label="회수한 종이 조각"
        >
          {order.map((id, position) => {
            const source = doc.pieces.findIndex((piece) => piece.id === id);
            const piece = doc.pieces[source];
            const fragments = doc.rows.map((row) => row[source]);
            return (
              <button
                key={position}
                type="button"
                className={`shred-strip ${selected === position ? "selected" : ""}`}
                data-piece={id}
                aria-label={`자리 ${position + 1} · 조각 ${piece.label}. ${fragments.filter(Boolean).join(" / ")}`}
                aria-pressed={selected === position}
                disabled={complete || checking}
                draggable={!complete && !checking}
                onClick={() => {
                  if (Date.now() < suppressClickUntil.current) return;
                  if (selected === null) {
                    setSelected(position);
                    sound?.play("select");
                  } else if (selected === position) {
                    setSelected(null);
                    sound?.play("deselect");
                  } else swap(selected, position);
                }}
                onDragStart={(event) => {
                  drag.current = position;
                  setSelected(position);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", id);
                }}
                onDragOver={(event) => {
                  if (drag.current !== null) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = drag.current;
                  drag.current = null;
                  suppressClickUntil.current = Date.now() + 250;
                  if (from !== null) swap(from, position);
                }}
                onDragEnd={() => {
                  drag.current = null;
                  setSelected(null);
                  suppressClickUntil.current = Date.now() + 250;
                }}
              >
                <span className="shred-position" aria-hidden="true">
                  {position + 1}
                </span>
                {piece.src ? (
                  <span className="shred-paper shred-image" aria-hidden="true">
                    <img src={piece.src} alt="" draggable={false} />
                  </span>
                ) : (
                  <span
                    className={`shred-paper edge-${source}`}
                    aria-hidden="true"
                  >
                    {fragments.map((fragment, row) => (
                      <span className={`shred-fragment row-${row}`} key={row}>
                        {fragment || "\u00a0"}
                      </span>
                    ))}
                    <span className="shred-rule" />
                  </span>
                )}
                <span className="shred-piece-label" aria-hidden="true">
                  조각 {piece.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {complete ? (
        <>
          {doc.scan && <DocumentScanViewer pages={[doc.scan]} />}
          <div className="shred-result" role="status">
            <strong>✓ 복원된 단서</strong>
            <p>
              공개 결산에서 합쳐진 두 지급 내역과 수정 요청에 대한 회신이
              드러났습니다. 업체 회신·이체 내역·등록부와 대조해 보세요.
            </p>
          </div>
          <div className="document-body shred-transcript">
            {doc.transcript.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const next = [...doc.initial];
              orderRef.current = next;
              setOrder(next);
              setSelected(null);
              setMessage("");
              setPractice(true);
            }}
          >
            조각 다시 맞춰보기
          </button>
        </>
      ) : (
        <button
          type="button"
          className="primary shred-verify"
          disabled={checking}
          onClick={() => void verify()}
        >
          {checking ? "복원 확인 중…" : "복원 확인"}
        </button>
      )}
      {message && (
        <p className="shred-message" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}
