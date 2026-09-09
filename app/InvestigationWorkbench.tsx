"use client";
import React, { useRef, useState } from "react";
import type { Progress } from "../lib/game";
import { recordById } from "../lib/cases";
import {
  emptyInvestigation,
  investigationMatches,
  investigationReady,
  sourceName,
  type Investigation,
  type InvestigationState,
} from "../lib/fieldwork";
import RecordArtifact from "./RecordArtifact";
import DocumentScanViewer from "./DocumentScanViewer";
import PaymentComparison from "./PaymentComparison";
import RouteInvestigation from "./RouteInvestigation";
import { documentScans } from "../lib/document-scans";
import { useSound } from "./sound-context";

export default function InvestigationWorkbench({
  desk,
  saved,
  progress,
  onSave,
  onRead,
  onNotes,
  initialFailed = false,
}: {
  desk: Investigation;
  saved: InvestigationState;
  progress: Progress;
  onSave: (state: InvestigationState, confirm: boolean) => Promise<boolean>;
  onRead: (record: string) => void;
  onNotes: () => void;
  initialFailed?: boolean;
}) {
  const [state, setState] = useState(saved);
  const latest = useRef(saved);
  const revision = useRef(0);
  const drag = useRef<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [source, setSource] = useState(
    desk.sources.find((id) => progress.read.includes(id)) ?? desk.sources[0],
  );
  const [status, setStatus] = useState("조사 배치 자동 저장");
  const [failed, setFailed] = useState(initialFailed);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [practice, setPractice] = useState(false);
  const [wipe, setWipe] = useState(50);
  const sound = useSound();
  const complete = saved.confirmed && !practice;
  const material = desk.clues.filter(
    (clue) => clue.source === source && clue.id !== "door-tested",
  );
  const ready = investigationReady(progress, desk);
  const loaded = progress.read.includes(source);
  const commit = async (next: InvestigationState) => {
    if (practice) return;
    const version = ++revision.current;
    setStatus("조사 저장 중…");
    setFailed(false);
    const ok = await onSave(next, false);
    if (revision.current === version) {
      setFailed(!ok);
      setStatus(
        ok ? "조사 배치 저장됨" : "저장하지 못했습니다. 배치는 유지됩니다.",
      );
    }
  };
  const update = (next: InvestigationState) => {
    latest.current = next;
    setState(next);
    setMessage("");
    void commit(next);
  };
  const inspect = (id: string) => {
    if (complete || checking) return;
    setChosen(id);
    sound?.play("select");
    if (!latest.current.inspected.includes(id))
      update({
        ...latest.current,
        inspected: [...latest.current.inspected, id],
      });
  };
  const place = (slot: string, id = chosen) => {
    if (
      complete ||
      checking ||
      !id ||
      !desk.slots.some((value) => value.id === slot)
    )
      return;
    if (!latest.current.inspected.includes(id)) return;
    const placements = Object.fromEntries(
      Object.entries(latest.current.placements).filter(
        ([key, value]) => key !== slot && value !== id,
      ),
    );
    placements[slot] = id;
    update({ ...latest.current, placements });
    setChosen(null);
    sound?.play("select");
  };
  const remove = (slot: string) => {
    if (complete || checking) return;
    const placements = { ...latest.current.placements };
    delete placements[slot];
    update({ ...latest.current, placements });
    sound?.play("deselect");
  };
  const chooseClue = (slot: string, id: string) => {
    if (complete || checking || !desk.slots.some((item) => item.id === slot))
      return;
    if (!id) return remove(slot);
    const clue = desk.clues.find((item) => item.id === id);
    if (!clue || !progress.read.includes(clue.source)) return;
    const placements = Object.fromEntries(
      Object.entries(latest.current.placements).filter(
        ([key, value]) => key !== slot && value !== id,
      ),
    );
    placements[slot] = id;
    update({
      ...latest.current,
      placements,
      inspected: [...new Set([...latest.current.inspected, id])],
    });
    sound?.play("select");
  };
  const confirm = async () => {
    setChecking(true);
    sound?.play("verify");
    const ok = practice
      ? ready && investigationMatches(desk, latest.current)
      : await onSave(latest.current, true);
    if (ok) {
      setPractice(false);
      setFailed(false);
      setMessage("원문과 조사 결과의 대응을 확인했습니다.");
      if (practice) sound?.play("success");
    } else {
      setMessage(
        ready
          ? "연결되지 않거나 원문과 대응하지 않는 항목이 있습니다. 배치는 유지됩니다. 출처와 관찰 내용을 다시 비교하세요."
          : "아직 확인하지 않은 원문을 자료 목록에서 열어 주세요.",
      );
      if (practice) sound?.play("retry");
    }
    setChecking(false);
  };
  const placed = (id: string) =>
    desk.clues.find((clue) => clue.id === state.placements[id]);
  const dropProps = (id: string) => ({
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      if (drag.current) place(id, drag.current);
      drag.current = null;
    },
  });
  const slotView = (id: string) => {
    const target = desk.slots.find((slot) => slot.id === id)!;
    const value = placed(id);
    return (
      <div
        className={`investigation-slot ${value ? "occupied" : ""}`}
        key={id}
        {...dropProps(id)}
        data-slot={id}
      >
        <button
          type="button"
          className="slot-target"
          disabled={complete || checking || !chosen}
          onClick={() => place(id)}
          aria-label={`${target.label}에 놓기`}
        >
          <span>{target.label}</span>
          <strong>
            {value?.value ??
              (chosen ? "선택한 항목 놓기 ＋" : "원본에서 항목을 선택하세요")}
          </strong>
        </button>
        {value && (
          <footer>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setSource(value.source);
                setChosen(null);
              }}
            >
              {value.source} · 출처 보기
            </button>
            {!complete && (
              <button
                type="button"
                className="text-button"
                disabled={checking}
                onClick={() => remove(id)}
                aria-label={`${target.label} 배치 해제`}
              >
                해제
              </button>
            )}
          </footer>
        )}
      </div>
    );
  };
  const observeDoor = () => {
    if (
      complete ||
      checking ||
      !progress.read.includes("4-4") ||
      latest.current.placements.door !== "exit"
    )
      return;
    if (!latest.current.inspected.includes("door-tested"))
      update({
        ...latest.current,
        inspected: [...latest.current.inspected, "door-tested"],
      });
  };

  return (
    <section
      className={`investigation-workbench desk-${desk.id}`}
      aria-label={desk.title}
    >
      <header className="workbench-heading">
        <span className="eyebrow">
          사건 {String(desk.episode).padStart(2, "0")} · 직접 조사
        </span>
        <h2 className="modal-title">{desk.title}</h2>
        <p>{desk.instruction}</p>
      </header>
      {desk.id !== "payments" && desk.id !== "route" && (
        <div className="investigation-source-tabs" aria-label="조사 원문 목록">
          {desk.sources.map((id) => (
            <button
              type="button"
              key={id}
              aria-pressed={source === id}
              onClick={() => {
                setSource(id);
                setChosen(null);
              }}
            >
              <small>
                {progress.read.includes(id) ? "확보" : "미열람"} · {id}
              </small>
              {sourceName(id)}
            </button>
          ))}
        </div>
      )}
      {complete && (
        <div className="investigation-success" role="status">
          <strong>✓ 직접 조사 완료</strong>
          <p>{desk.result}</p>
          <p>
            대조한 원문은 증거 보관함에 함께 보관됩니다. 충분한 단서가 모인
            질문은 추리 노트에서 확인하세요.
          </p>
          <button type="button" className="primary" onClick={onNotes}>
            추리 노트에 정리 ↗
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setPractice(true);
              const next = emptyInvestigation();
              latest.current = next;
              setState(next);
              setChosen(null);
              setMessage("");
            }}
          >
            다시 조사해 보기
          </button>
        </div>
      )}
      {desk.id === "payments" ? (
        <PaymentComparison
          desk={desk}
          state={state}
          progress={progress}
          disabled={complete || checking}
          onChoose={chooseClue}
          onRead={onRead}
        />
      ) : desk.id === "route" ? (
        <RouteInvestigation
          key={String(practice)}
          desk={desk}
          state={state}
          progress={progress}
          disabled={complete || checking}
          onChoose={chooseClue}
          onRead={onRead}
          onObserve={observeDoor}
        />
      ) : (
        <div className="workbench-columns">
          <aside className="workbench-materials">
            <div className="source-heading">
              <span>원문 {source}</span>
              <h3>{sourceName(source)}</h3>
              <button
                type="button"
                className="secondary"
                onClick={() => onRead(source)}
              >
                {loaded ? "원문 창에서 대조 ↗" : "원문을 열어 조사 시작 ↗"}
              </button>
            </div>
            {loaded ? (
              <>
                {documentScans[source] && (
                  <DocumentScanViewer
                    key={source}
                    pages={documentScans[source]}
                  />
                )}
                {material.length > 0 && (
                  <p className="material-help">
                    항목을 눌러 펼친 뒤 비교 칸을 누르세요. 마우스로 끌어 놓아도
                    됩니다.
                  </p>
                )}
                <div className="material-tray">
                  {material.map((clue) => {
                    const inspected =
                      state.inspected.includes(clue.id) || complete;
                    return (
                      <button
                        type="button"
                        className={`clue-card ${inspected ? "inspected" : ""}`}
                        key={clue.id}
                        aria-label={clue.label}
                        aria-pressed={chosen === clue.id}
                        disabled={complete || checking}
                        draggable={inspected && !complete && !checking}
                        onDragStart={(event) => {
                          drag.current = clue.id;
                          event.dataTransfer.setData("text/plain", clue.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          drag.current = null;
                        }}
                        onClick={() => inspect(clue.id)}
                      >
                        <small>
                          {source} · {clue.label}
                        </small>
                        {inspected ? (
                          <>
                            <strong>{clue.value}</strong>
                            <span>{clue.detail}</span>
                          </>
                        ) : (
                          <span className="clue-cover">
                            접힌 면 펼치기 <b aria-hidden="true">↗</b>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <details
                  className="workbench-reference"
                  open={material.length === 0}
                >
                  <summary>이 자료의 전체 원본을 옆에 놓기</summary>
                  <RecordArtifact
                    record={recordById(source)!}
                    showScan={false}
                  />
                </details>
              </>
            ) : (
              <div className="unread-material">
                <span aria-hidden="true">▱</span>
                <p>보관된 원문을 먼저 열면 이곳에서 조사할 수 있습니다.</p>
              </div>
            )}
          </aside>
          <div className="workbench-surface">
            <p className="active-clue" aria-live="polite">
              {chosen
                ? `선택: ${desk.clues.find((clue) => clue.id === chosen)?.value} · 놓을 칸을 누르세요.`
                : "원본에서 발견한 항목을 이곳에 연결하세요."}
            </p>
            {desk.id === "profiles" && (
              <div className="comparison-pairs">
                {[
                  ["identity-a", "identity-b"],
                  ["claim-a", "claim-b"],
                  ["appointment-a", "appointment-b"],
                ].map((pair, i) => (
                  <section key={i}>
                    <h3>
                      {["작성자 흔적", "거주 기록", "약속의 적용 범위"][i]}
                    </h3>
                    <div>{pair.map(slotView)}</div>
                  </section>
                ))}
              </div>
            )}
            {desk.id === "index" && (
              <>
                <div className="index-chain">
                  {["piece-1", "piece-2", "piece-3", "piece-4"].map(slotView)}
                </div>
                <output
                  className="locker-preview"
                  aria-label="현재 연결한 보관함 숫자"
                >
                  {["piece-1", "piece-2", "piece-3", "piece-4"].map((id) => {
                    const value = placed(id);
                    return (
                      <span key={id}>
                        {value && ["a", "b", "c", "d"].includes(value.id)
                          ? value.value.slice(-1)
                          : "·"}
                      </span>
                    );
                  })}
                </output>
                <p>조각의 연결 표식과 숫자가 모두 이어지는지 확인하세요.</p>
                {slotView("seal")}
                {progress.read.includes("5-5") && (
                  <div className="seal-legend">
                    <span>
                      <b>R</b> 변환 없는 원자료
                    </span>
                    <span>
                      <b>V</b> 재배열·편집한 검토본
                    </span>
                  </div>
                )}
              </>
            )}
            {desk.id === "revisions" && (
              <>
                {progress.read.includes("6-1") &&
                  progress.read.includes("6-2") && (
                    <div className="revision-viewer">
                      <h3>N88 초안 ↔ 게시본</h3>
                      <div className="revision-window">
                        <div className="revision-layer">
                          <small>게시본 · 03.19 09:00</small>
                          <strong>커뮤니티 서비스 종료 예정</strong>
                          <p>
                            모든 주민의 찬성으로 결정되었습니다.
                            <br />
                            기존 자료는 별도 보관됩니다.
                          </p>
                        </div>
                        <div
                          className="revision-layer revision-before"
                          style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)` }}
                        >
                          <small>초안 · 03.19 08:41</small>
                          <strong>서버 점검 안내</strong>
                          <p>
                            감사 로그에 남은 초안 제목
                            <br />
                            작성 계정 U09
                          </p>
                        </div>
                      </div>
                      <label>
                        비교 경계 이동
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={wipe}
                          onChange={(event) =>
                            setWipe(Number(event.target.value))
                          }
                          aria-label="초안과 게시본 비교 경계"
                        />
                      </label>
                    </div>
                  )}
                <div className="receipt-pair">
                  {slotView("revision")}
                  {slotView("operator")}
                </div>
                {progress.read.includes("6-5") && (
                  <div className="scheduler-strip">
                    <strong>Q25 · 자동 백업 OFF</strong>
                    <span>DELETE: acct_source, post_revisions</span>
                    <span>KEEP: board_posts, market_images</span>
                  </div>
                )}
                <div className="classification-bins">
                  <section>
                    <h3>영구 삭제 대상</h3>
                    {slotView("delete-a")}
                    {slotView("delete-b")}
                  </section>
                  <section>
                    <h3>보존 대상</h3>
                    {slotView("keep-a")}
                    {slotView("keep-b")}
                  </section>
                </div>
                {slotView("decision")}
              </>
            )}
            {desk.id === "sources" && (
              <>
                <section className="mail-comparison">
                  <h3>봉투의 이름 ↔ 인증된 발신 경로</h3>
                  <div>
                    {slotView("mail")}
                    {slotView("identity")}
                  </div>
                </section>
                <section className="witness-comparison">
                  <h3>같은 날의 안부 확인</h3>
                  <div>
                    {slotView("current-witness")}
                    {slotView("current-self")}
                  </div>
                </section>
                <div className="testimony-timeline">
                  {["entry", "instruction", "response"].map(slotView)}
                </div>
              </>
            )}
            {desk.id === "report" && (
              <div className="report-bins">
                <section>
                  <h3>보고서 본문</h3>
                  <p>독립 원본으로 입증할 내용</p>
                  {["fact-1", "fact-2", "fact-3"].map(slotView)}
                </section>
                <section>
                  <h3>후속 조사</h3>
                  <p>아직 확정하지 않을 주장</p>
                  {["open-1", "open-2"].map(slotView)}
                </section>
                <section className="redaction-bin">
                  <h3>공개 사본에서 가림</h3>
                  <p>동의 범위에 포함되지 않은 정보</p>
                  {["private-1", "private-2"].map(slotView)}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
      <footer className="investigation-actions">
        <p role="status">
          {message ||
            (complete
              ? "조사 결과가 저장되어 있습니다."
              : practice
                ? "다시 조사 중 · 기존 완료 기록 유지"
                : status)}
        </p>
        {!complete && (
          <>
            <span>
              {Object.keys(state.placements).length}/{desk.slots.length} 항목
              배치 · 원문{" "}
              {desk.sources.filter((id) => progress.read.includes(id)).length}/
              {desk.sources.length}
            </span>
            {failed && (
              <button
                type="button"
                className="secondary"
                onClick={() => void commit(latest.current)}
              >
                조사 저장 재시도
              </button>
            )}
            <button
              type="button"
              className="primary"
              disabled={checking}
              onClick={() => void confirm()}
            >
              {checking ? "원문과 대조 중…" : "조사 결과 확인"}
            </button>
          </>
        )}
      </footer>
    </section>
  );
}
