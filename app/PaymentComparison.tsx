"use client";
import React from "react";
import type { Progress } from "../lib/game";
import {
  sourceName,
  type Investigation,
  type InvestigationState,
} from "../lib/fieldwork";
import { documentScans } from "../lib/document-scans";
import DocumentScanViewer from "./DocumentScanViewer";

const steps = [
  {
    title: "공개 금액과 실제 공사비",
    help: "같은 작업번호인지 확인하고, 두 자료의 금액을 골라 주세요. 차액은 자동으로 계산됩니다.",
    sources: ["3-1", "3-2"],
    fields: ["ledger-total", "invoice-total", "contractor"],
    slots: ["published", "invoice"],
    choices: ["ledger-total", "invoice-total"],
  },
  {
    title: "실제로 나간 두 이체",
    help: "위에서 확인한 공사비와 이체 금액을 비교해 두 건을 나눠 주세요.",
    sources: ["3-3"],
    fields: ["transfer-a", "transfer-b"],
    slots: ["paid-work", "paid-other"],
    choices: ["transfer-a", "transfer-b"],
  },
  {
    title: "계좌 주인과 지급 승인자",
    help: "별도 이체의 계좌 끝자리를 업체 자료와 대조하고, 공개 결산의 승인 서명을 확인하세요.",
    sources: ["3-2", "3-4", "3-1"],
    fields: ["contractor", "owner", "signature"],
    slots: ["recipient", "approval"],
    choices: ["contractor", "owner", "signature"],
  },
];

export default function PaymentComparison({
  desk,
  state,
  progress,
  disabled,
  onChoose,
  onRead,
}: {
  desk: Investigation;
  state: InvestigationState;
  progress: Progress;
  disabled: boolean;
  onChoose: (slot: string, clue: string) => void;
  onRead: (record: string) => void;
}) {
  const placed = (slot: string) =>
    desk.clues.find((clue) => clue.id === state.placements[slot]);
  const amount = (slot: string) => placed(slot)?.amount;
  const money = (value: number) => `${value.toLocaleString("ko-KR")}원`;
  return (
    <div className="payment-comparison">
      <p className="payment-instructions">
        자료 옆의 선택 목록에서 항목을 고르면 바로 기입됩니다. 다른 항목을
        고르거나 ‘선택 안 함’으로 지울 수 있습니다.
      </p>
      {steps.map((step, index) => (
        <section
          className="payment-step"
          key={step.title}
          aria-label={step.title}
        >
          <header>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.help}</p>
            </div>
            <small>
              {step.slots.filter((slot) => state.placements[slot]).length}/
              {step.slots.length} 기입
            </small>
          </header>
          <div className="payment-step-columns">
            <div className="payment-sources">
              {step.sources.map((source) => {
                const loaded = progress.read.includes(source);
                return (
                  <article
                    className="payment-source"
                    key={source}
                    aria-label={sourceName(source)}
                  >
                    <h4>{sourceName(source)}</h4>
                    {loaded ? (
                      <>
                        <dl>
                          {desk.clues
                            .filter(
                              (clue) =>
                                clue.source === source &&
                                step.fields.includes(clue.id),
                            )
                            .map((clue) => (
                              <div key={clue.id}>
                                <dt>{clue.label}</dt>
                                <dd>
                                  <strong>{clue.value}</strong>
                                  <span>{clue.detail}</span>
                                </dd>
                              </div>
                            ))}
                        </dl>
                        {index < 2 && documentScans[source] && (
                          <details className="payment-scan">
                            <summary>공문 이미지 펼쳐 보기</summary>
                            <DocumentScanViewer pages={documentScans[source]} />
                          </details>
                        )}
                      </>
                    ) : (
                      <p>
                        원문을 열면 금액과 계좌 정보를 이곳에 함께 펼쳐 둡니다.
                      </p>
                    )}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onRead(source)}
                    >
                      {loaded ? "원문 다시 보기 ↗" : "원문 열고 비교하기 ↗"}
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="payment-entries">
              {index === 1 && (
                <p className="payment-reference">
                  선택한 최종 공사비:{" "}
                  <strong>
                    {amount("invoice") === undefined
                      ? "아직 선택하지 않음"
                      : money(amount("invoice")!)}
                  </strong>
                </p>
              )}
              {index === 2 && (
                <p className="payment-reference">
                  선택한 별도 이체:{" "}
                  <strong>
                    {placed("paid-other")?.value ?? "아직 선택하지 않음"}
                  </strong>
                </p>
              )}
              {step.slots.map((slot) => {
                const target = desk.slots.find((item) => item.id === slot)!;
                const current = placed(slot);
                const candidates =
                  slot === "recipient"
                    ? ["contractor", "owner"]
                    : slot === "approval"
                      ? ["signature"]
                      : step.choices;
                const choices = desk.clues.filter(
                  (clue) =>
                    progress.read.includes(clue.source) &&
                    (candidates.includes(clue.id) || clue.id === current?.id),
                );
                return (
                  <div className="payment-entry" key={slot} data-slot={slot}>
                    <label htmlFor={`payment-${slot}`}>{target.label}</label>
                    <select
                      id={`payment-${slot}`}
                      value={state.placements[slot] ?? ""}
                      disabled={disabled || choices.length === 0}
                      onChange={(event) => onChoose(slot, event.target.value)}
                    >
                      <option value="">선택 안 함</option>
                      {choices.map((clue) => (
                        <option value={clue.id} key={clue.id}>
                          {clue.value} · {clue.label}
                        </option>
                      ))}
                    </select>
                    {current && <p>{current.detail}</p>}
                    {choices.length === 0 && (
                      <p>옆의 원문을 먼저 열어 주세요.</p>
                    )}
                  </div>
                );
              })}
              {index === 0 && (
                <output
                  className="receipt-calculation"
                  aria-label="선택한 금액의 차액"
                  aria-live="polite"
                >
                  <span>공개 결산 − 최종 공사비</span>
                  <strong>
                    {amount("published") !== undefined &&
                    amount("invoice") !== undefined
                      ? money(amount("published")! - amount("invoice")!)
                      : "두 금액을 선택하세요"}
                  </strong>
                  <small>
                    선택한 값의 계산 결과입니다. 출처와 비용 범위도 확인하세요.
                  </small>
                </output>
              )}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
