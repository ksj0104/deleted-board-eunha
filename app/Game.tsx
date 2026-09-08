"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  episodes,
  recordById,
  type Question,
  type RecordFile,
} from "../lib/cases";
import type { Draft, Action, Feedback } from "../lib/game";
import {
  apiGameClient,
  type GameClient,
  type GameView as View,
} from "../lib/game-client";
import {
  Dialog,
  Search,
  Empty,
  CodeInput,
  GameErrorContext,
} from "./components";
import CommunityBoard, { ResidentAvatar } from "./CommunityBoard";
import EvidencePicker from "./EvidencePicker";
import StoryPrologue from "./StoryPrologue";
import { recordStats } from "../lib/community";
import InvestigationGuide from "./InvestigationGuide";
import {
  evidenceLimit,
  evidenceSelectionLabel,
  investigationGuides,
  questionPreparation,
} from "../lib/investigation";
import { caseThreads, inquiryDiscovered } from "../lib/narrative";
import InvestigationInbox from "./InvestigationInbox";
import SoundControls from "./SoundControls";
import CctvViewer from "./CctvViewer";
import TimelineComparison from "./TimelineComparison";
import { calibrationFor, comparisonReady } from "../lib/calibration";
import ShreddedDocument from "./ShreddedDocument";
import {
  readableParagraphs,
  recordRestored,
  restorationFor,
} from "../lib/restoration";
import { SoundContext, useGameSound } from "./sound-context";
import type { SoundPlayer } from "../lib/sound";
import {
  deliveries,
  deliveryRecords,
  isPublicRecord,
  worldDate,
  worldStage,
} from "../lib/world";
type DraftEdit = {
  episode: number;
  question: string;
  draft: Draft;
  revision: number;
  failed: boolean;
};
type DraftEdits = Record<string, DraftEdit>;
type Tab = "board" | "inbox" | "evidence" | "deductions" | "notes" | "cases";
const tabs: { id: Tab; label: string; glyph: string }[] = [
  { id: "board", label: "게시판 기록", glyph: "▤" },
  { id: "inbox", label: "받은 자료함", glyph: "✉" },
  { id: "evidence", label: "증거 보관함", glyph: "⌑" },
  { id: "deductions", label: "추리 노트", glyph: "⌘" },
  { id: "notes", label: "나의 메모", glyph: "✎" },
  { id: "cases", label: "사건 목록", glyph: "▦" },
];
const pad = (n: number) => String(n).padStart(2, "0");

export default function Game({
  client = apiGameClient,
}: {
  client?: GameClient;
}) {
  const sound = useGameSound();
  return (
    <SoundContext.Provider value={sound}>
      <GameScreen client={client} sound={sound} />
    </SoundContext.Provider>
  );
}

function GameScreen({
  client,
  sound,
}: {
  client: GameClient;
  sound: SoundPlayer;
}) {
  const clickIntent = useRef(0);
  const [showComparison, setShowComparison] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const [blocking, setBlocking] = useState(0);
  const [draftEdits, setDraftEdits] = useState<DraftEdits>({});
  const [tab, setTab] = useState<Tab>("board");
  const [query, setQuery] = useState("");
  const [tool, setTool] = useState<"evidence" | "deductions" | null>(null);
  const [showPrologue, setShowPrologue] = useState(false);
  const [focusedQuestion, setFocusedQuestion] = useState<string>();
  const [showGoals, setShowGoals] = useState(false);
  const [selected, setSelected] = useState<RecordFile | null>(null);
  const [recordWindow, setRecordWindow] = useState(0);
  const [boardSession, setBoardSession] = useState(0);
  const [help, setHelp] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showResolution, setShowResolution] = useState<number | null>(null);
  const [showEnding, setShowEnding] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteDirty, setNoteDirty] = useState(false);
  const [fontLarge, setFontLarge] = useState(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const savedView = useRef<View | null>(null);
  const draftEditsRef = useRef<DraftEdits>({});
  const draftRevision = useRef(0);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notePending = useRef<{ episode: number; text: string } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const updateDraftEdits = useCallback(
    (update: (edits: DraftEdits) => DraftEdits) => {
      const next = update(draftEditsRef.current);
      draftEditsRef.current = next;
      setDraftEdits(next);
    },
    [],
  );
  const load = useCallback(async () => {
    try {
      const data = await client.request();
      setLoadError("");
      savedView.current = data;
      setView(data);
      setNotes(data.progress.notes);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "기록을 불러오지 못했습니다.",
      );
    }
  }, [client]);
  useEffect(() => {
    // load updates state after the storage promise resolves or rejects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const send = useCallback(
    (action: Action, edit?: DraftEdit): Promise<View | null> => {
      setPending((n) => n + 1);
      const blocksEditing = ["solve", "visit", "reset", "pin"].includes(
        action.type,
      );
      if (blocksEditing) setBlocking((n) => n + 1);
      setError("");
      const key = edit ? `${edit.episode}/${edit.question}` : "";
      const isLatestEdit = () =>
        !!edit && draftEditsRef.current[key]?.revision === edit.revision;
      const job = queue.current
        .catch(() => null)
        .then(async () => {
          try {
            // A newer complete draft replaces a write that has not started yet.
            if (edit && !isLatestEdit()) return null;
            if (
              action.type === "solve" &&
              Object.values(draftEditsRef.current).some(
                (d) =>
                  d.episode ===
                  (action.episode ?? savedView.current?.progress.active),
              )
            )
              throw new Error(
                "아직 저장되지 않은 추리가 있습니다. 다시 저장한 뒤 검증해 주세요.",
              );
            const requestAction = edit
              ? {
                  ...action,
                  draft: {
                    ...edit.draft,
                    evidence: edit.draft.evidence.filter((id) =>
                      savedView.current?.progress.pinned.includes(id),
                    ),
                  },
                }
              : action;
            const data = await client.request(requestAction);
            if (action.type === "pin")
              sound.play(
                data.progress.pinned.includes(action.record!)
                  ? "collect"
                  : "release",
              );
            else if (action.type === "like")
              sound.play(
                data.progress.liked?.includes(action.record!)
                  ? "select"
                  : "deselect",
              );
            else if (action.type === "restore" || action.type === "calibrate")
              sound.play("success");
            else if (action.type === "hint") sound.play("notice");
            else if (action.type === "start" || action.type === "intro")
              sound.play("open");
            else if (action.type === "ending") sound.play("success");
            else if (action.type === "solve" && data.feedback)
              sound.play(
                Object.values(data.feedback).every(
                  (f) => f.answer && f.evidence,
                )
                  ? "success"
                  : "retry",
              );
            savedView.current = data;
            setView(data);
            if (action.type === "reset") updateDraftEdits(() => ({}));
            else if (isLatestEdit())
              updateDraftEdits((edits) => {
                const next = { ...edits };
                delete next[key];
                return next;
              });
            return data;
          } catch (e) {
            // A superseded request must not mark the newer selection as failed.
            if (edit && !isLatestEdit()) return null;
            if (
              !["read", "note", "draft", "arrange", "align"].includes(
                action.type,
              )
            )
              sound.play("retry");
            if (edit)
              updateDraftEdits((edits) => ({
                ...edits,
                [key]: { ...edits[key], failed: true },
              }));
            setError(
              e instanceof Error
                ? e.message
                : "저장하지 못했습니다. 다시 시도해 주세요.",
            );
            return null;
          } finally {
            setPending((n) => n - 1);
            if (blocksEditing) setBlocking((n) => n - 1);
          }
        });
      queue.current = job;
      return job;
    },
    [client, sound, updateDraftEdits],
  );
  const persistDraft = (episode: number, question: string, draft: Draft) => {
    const edit: DraftEdit = {
      episode,
      question,
      draft,
      revision: ++draftRevision.current,
      failed: false,
    };
    updateDraftEdits((edits) => ({
      ...edits,
      [`${episode}/${question}`]: edit,
    }));
    void send({ type: "draft", episode, question, draft }, edit);
  };
  const unsavedDrafts = Object.values(draftEdits);
  const failedDrafts = unsavedDrafts.filter((d) => d.failed);
  const retryDrafts = () => {
    for (const edit of Object.values(draftEditsRef.current))
      if (edit.failed) persistDraft(edit.episode, edit.question, edit.draft);
  };
  const flushNote = useCallback(() => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    const note = notePending.current;
    if (note) {
      notePending.current = null;
      void send({ type: "note", ...note }).then((data) => {
        if (data && !notePending.current) setNoteDirty(false);
        else if (!data && !notePending.current) notePending.current = note;
      });
    }
  }, [send]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (pending || noteDirty || unsavedDrafts.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [pending, noteDirty, unsavedDrafts.length]);
  const goTab = (next: Tab) => {
    sound.play(
      next === "evidence" || next === "deductions" ? "open" : "select",
    );
    flushNote();
    setQuery("");
    setFocusedQuestion(undefined);
    if (next === "evidence" || next === "deductions") {
      setTool(next);
      return;
    }
    setTool(null);
    setTab(next);
    mainRef.current?.focus();
  };
  const openQuestion = (id?: string) => {
    sound.play("open");
    flushNote();
    setQuery("");
    setFocusedQuestion(id);
    setTool("deductions");
  };
  const visit = async (id: number, destination: Tab = "board") => {
    sound.play("open");
    flushNote();
    const data = await send({ type: "visit", episode: id });
    if (data) {
      setTab(destination);
      setTool(null);
      setQuery("");
      setFeedback(null);
      setShowResolution(null);
      setShowHint(false);
      setSelected(null);
      setShowPrologue(false);
      setFocusedQuestion(undefined);
      setShowGoals(false);
      mainRef.current?.focus();
    }
  };
  const openRecord = (r: RecordFile) => {
    sound.play("open");
    setRecordWindow((n) => n + 1);
    setSelected(r);
    if (!view?.progress.read.includes(r.id))
      void send({ type: "read", record: r.id });
  };
  if (!view)
    return (
      <div className="loading-screen">
        <div className="brand-mark">▤</div>
        <p className="eyebrow">EUNHA COMMUNITY ARCHIVE</p>
        <h1>삭제된 게시판</h1>
        <p role={loadError ? "alert" : "status"}>
          {loadError || "보관된 기록을 불러오고 있습니다…"}
        </p>
        {loadError && (
          <button
            className="primary"
            onClick={() => {
              setLoadError("");
              void load();
            }}
          >
            {client.storage === "browser" ? "다시 불러오기" : "다시 연결하기"}
          </button>
        )}
      </div>
    );
  // Saved state remains authoritative; outstanding local edits are overlaid
  // so an older response cannot undo a newer checkbox or answer change.
  const p = {
    ...view.progress,
    drafts: unsavedDrafts.reduce(
      (drafts, edit) => ({
        ...drafts,
        [edit.episode]: {
          ...drafts[edit.episode],
          [edit.question]: {
            ...edit.draft,
            evidence: edit.draft.evidence.filter((id) =>
              view.progress.pinned.includes(id),
            ),
          },
        },
      }),
      view.progress.drafts,
    ),
  };
  const e = episodes[p.active - 1],
    maxEpisode = Math.min(8, p.solved.length + 1),
    solved = p.solved.includes(e.id);
  const evidence = p.pinned.map(recordById).filter((r): r is RecordFile => !!r);
  const discoveredQuestions = e.questions.filter((q) =>
    inquiryDiscovered(e, q, p),
  );
  const search = query.trim().toLocaleLowerCase();
  const source = [...evidence].reverse();
  const visible = source.filter(
    (r) =>
      !search ||
      [
        r.title,
        r.author,
        r.id,
        ...readableParagraphs(r, p),
        ...(r.comments ?? []).map((c) => c.text),
        ...(r.attachment?.rows.flat() ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search),
  );
  const level = p.hints[e.id] ?? 0;
  const latestDelivery = deliveries[worldStage(p) - 1];
  const unreadAttachments = deliveries
    .slice(0, worldStage(p))
    .flatMap((d) => deliveryRecords(d.episode))
    .filter((r) => !p.read.includes(r.id)).length;
  const makeDraft = (q: Question): Draft =>
    p.drafts[e.id]?.[q.id] ?? {
      answer: q.kind === "order" ? [...q.options!] : "",
      evidence: [],
    };
  const saveDraft = (q: Question, update: (draft: Draft) => Draft) => {
    setFeedback(null);
    const latest =
      draftEditsRef.current[`${e.id}/${q.id}`]?.draft ??
      savedView.current?.progress.drafts[e.id]?.[q.id] ??
      makeDraft(q);
    const next = update({
      ...latest,
      evidence: latest.evidence.filter((id) => p.pinned.includes(id)),
    });
    sound.play(
      next.evidence.length < latest.evidence.length ? "deselect" : "select",
    );
    persistDraft(e.id, q.id, next);
  };
  const solve = async () => {
    sound.play("verify");
    const data = await send({ type: "solve", episode: e.id });
    if (data) {
      setFeedback(data.feedback ?? null);
      if (
        data.feedback &&
        Object.values(data.feedback).every((f) => f.answer && f.evidence)
      )
        setShowResolution(e.id);
    }
  };
  const exportReport = () => {
    const text = [
      "삭제된 게시판 — 나의 사건 기록",
      `해결 ${p.solved.length}/8 · 결말: ${view.ending?.title ?? "진행 중"}`,
      "",
      ...p.solved.flatMap((id) => [
        `${pad(id)}. ${episodes[id - 1].title}`,
        view.resolutions[id].text,
        `메모: ${notes[id] ?? ""}`,
        "",
      ]),
      view.ending?.text ?? "",
      view.ending?.after ?? "",
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "삭제된-게시판-사건기록.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <GameErrorContext.Provider value={error}>
      <div
        className={`app-shell ${fontLarge ? "large-text" : ""}`}
        onPointerDownCapture={() => sound.unlock()}
        onKeyDownCapture={() => sound.unlock()}
        onClickCapture={() => {
          clickIntent.current = sound.getIntent();
          sound.unlock();
        }}
        onClick={(event) => {
          const target = event.target as Element;
          const button = target.closest?.("button, summary");
          if (
            button &&
            !button.hasAttribute("disabled") &&
            !button.closest('[data-sound="silent"]') &&
            clickIntent.current === sound.getIntent()
          )
            sound.play("select");
        }}
      >
        <a className="skip-link" href="#main">
          본문으로 건너뛰기
        </a>
        <aside className="sidebar">
          <button
            className="brand"
            onClick={() => goTab("cases")}
            aria-label="삭제된 게시판 · 사건 목록"
          >
            <span className="brand-mark">▤</span>
            <span>
              삭제된 게시판<small>DELETED BOARD</small>
            </span>
          </button>
          <div className="archive-label">
            <span className="live-dot" /> 은하아파트 보관 기록{" "}
            <span className="tiny-lock">읽기 전용</span>
          </div>
          <div className="sidebar-section">기록자의 책상</div>
          <nav aria-label="주 메뉴">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`nav-button ${(tool ?? tab) === t.id ? "active" : ""}`}
                aria-current={!tool && tab === t.id ? "page" : undefined}
                aria-haspopup={
                  t.id === "evidence" || t.id === "deductions"
                    ? "dialog"
                    : undefined
                }
                onClick={() => goTab(t.id)}
              >
                <span className="nav-glyph" aria-hidden="true">
                  {t.glyph}
                </span>
                {t.label}
                {t.id === "evidence" && (
                  <span className="nav-count">{p.pinned.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-case">
            <span className="eyebrow">CURRENT CASE / {pad(e.id)}</span>
            <h3>{e.title}</h3>
            <p>{e.mechanic}</p>
            <div
              className="segments"
              aria-label={`8개 사건 중 ${p.solved.length}개 해결`}
            >
              {episodes.map((ep) => (
                <span
                  key={ep.id}
                  className={
                    p.solved.includes(ep.id)
                      ? "done"
                      : ep.id === e.id
                        ? "current"
                        : ""
                  }
                />
              ))}
            </div>
            <small>{p.solved.length} / 8 사건 해결</small>
          </div>
          <div className="sidebar-bottom">
            <button onClick={() => setHelp(true)}>ⓘ 플레이 안내</button>
            <button
              onClick={() => setFontLarge(!fontLarge)}
              aria-pressed={fontLarge}
            >
              가<span className="small-a">가</span>{" "}
              {fontLarge ? "기본 글자 크기" : "큰 글자 모드"}
            </button>
            <p>
              기억은 흐려져도,
              <br />
              기록은 남는다.
            </p>
            <span className="edition">ARCHIVE EDITION · 2026</span>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumb">
              은하아파트 <span>/</span> 사건 {pad(e.id)} <span>/</span>{" "}
              <strong>{tabs.find((t) => t.id === tab)?.label}</strong>
            </div>
            <div className="topbar-tools">
              <SoundControls />
              <div className="save-status" role="status">
                <span
                  className={error ? "status-dot error-dot" : "status-dot"}
                />
                {error || failedDrafts.length
                  ? "저장 확인 필요"
                  : noteDirty
                    ? "메모 저장 대기"
                    : pending || unsavedDrafts.length
                      ? "기록 저장 중…"
                      : "자동 저장됨"}
              </div>
            </div>
          </header>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => setError("")}>닫기</button>
            </div>
          )}
          <main
            id="main"
            ref={mainRef}
            tabIndex={-1}
            className={`main ${tab === "board" ? "community-main" : ""}`}
          >
            <div className="case-masthead">
              <div>
                <div className="eyebrow coral">
                  {tab === "board" || tab === "inbox"
                    ? `EUNHA · 2026.${worldDate(p)}`
                    : `CASE ${pad(e.id)} / ${e.mechanic}`}
                </div>
                <h1>
                  {tab === "cases"
                    ? "지워진 자리의 이야기"
                    : tab === "notes"
                      ? "나의 메모"
                      : tab === "board"
                        ? "주민마당"
                        : tab === "inbox"
                          ? "받은 자료함"
                          : tab === "evidence"
                            ? "흩어진 조각들"
                            : tab === "deductions"
                              ? "기록을 연결할 시간"
                              : e.title}
                </h1>
                <p>
                  {tab === "cases"
                    ? "여덟 개의 사건을 따라, 하나의 진실에 도착하세요."
                    : tab === "notes"
                      ? "기록 사이에서 발견한 연결을 적어 두세요."
                      : tab === "board"
                        ? "이웃의 일상과 오래된 기록이 쌓이는 곳."
                        : tab === "inbox"
                          ? "조사하며 받은 회신과 원본 자료를 보관합니다."
                          : tab === "evidence"
                            ? "수집한 증거는 다음 사건에서도 다시 살펴볼 수 있습니다."
                            : tab === "deductions"
                              ? "가설을 세우고, 그 가설을 뒷받침하는 기록을 선택하세요."
                              : e.subtitle}
                </p>
              </div>
              <div className="case-stamp">
                <span>은하아파트</span>
                <strong>
                  {tab === "board" || tab === "inbox" ? "▤" : pad(e.id)}
                </strong>
                <small>
                  {tab === "board" || tab === "inbox"
                    ? "주민 기록"
                    : solved
                      ? "해결된 사건"
                      : "조사 진행 중"}
                </small>
              </div>
            </div>
            <div hidden={tab !== "board"}>
              {unreadAttachments > 0 && (
                <div className="incoming-mail-notice">
                  <div>
                    <span>✉ 받은 자료 {unreadAttachments}개 미확인</span>
                    <strong>{latestDelivery.subject}</strong>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => goTab("inbox")}
                  >
                    받은 자료 확인 ↗
                  </button>
                </div>
              )}
              <CommunityBoard
                key={`${boardSession}/${p.started ? "playing" : "new"}`}
                progress={p}
                onOpen={openRecord}
                onStory={() => setShowPrologue(true)}
              />
            </div>
            <div hidden={tab !== "inbox"}>
              <InvestigationInbox
                key={p.started ? "playing" : "new"}
                progress={p}
                onOpen={openRecord}
              />
            </div>
            {tab === "notes" && (
              <section className="notes-panel">
                <div className="note-heading">
                  <h2>
                    사건 {pad(e.id)} · {e.title}
                  </h2>
                  <span>{(notes[e.id] ?? "").length} / 3,000</span>
                </div>
                <label className="sr-only" htmlFor="notebook">
                  사건 메모
                </label>
                <textarea
                  id="notebook"
                  placeholder={
                    "떠오른 생각을 자유롭게 적어 보세요.\n\n누가 어떤 글을 남겼는지, 서로 모순되는 기록은 무엇인지…"
                  }
                  maxLength={3000}
                  value={notes[e.id] ?? ""}
                  onBlur={flushNote}
                  onChange={(event) => {
                    const text = event.target.value;
                    setNotes((n) => ({ ...n, [e.id]: text }));
                    setNoteDirty(true);
                    if (noteTimer.current) clearTimeout(noteTimer.current);
                    notePending.current = { episode: e.id, text };
                    if (client.storage === "browser") flushNote();
                    else noteTimer.current = setTimeout(flushNote, 700);
                  }}
                />
                <footer>
                  <span>메모는 사건별로 자동 저장됩니다.</span>
                  <button className="secondary" onClick={flushNote}>
                    메모 저장
                  </button>
                </footer>
              </section>
            )}
            {tab === "cases" && (
              <>
                <section className="campaign-intro">
                  <div>
                    <span className="eyebrow">THE COMPLETE STORY</span>
                    <h2>
                      한 사람이 사라졌다.
                      <br />
                      게시판도 사라질 예정이다.
                    </h2>
                    <p>
                      평범한 공지와 오래된 쪽지, 숫자가 맞지 않는 장부.
                      <br />
                      기록을 읽고 연결하며 은하아파트의 비밀을 밝혀내세요.
                    </p>
                  </div>
                  <div className="campaign-progress">
                    <strong>
                      {pad(p.solved.length)}
                      <span>/08</span>
                    </strong>
                    <p>복원한 사건</p>
                  </div>
                </section>
                <div className="cases-grid">
                  {episodes.map((ep) => (
                    <button
                      key={ep.id}
                      className={`case-card ${ep.id > maxEpisode ? "locked" : ""}`}
                      disabled={ep.id > maxEpisode || pending > 0}
                      onClick={() => visit(ep.id)}
                    >
                      <div>
                        <span className="file-number">CASE {pad(ep.id)}</span>
                        <span>
                          {p.solved.includes(ep.id)
                            ? "✓ 해결"
                            : ep.id > maxEpisode
                              ? "잠김"
                              : "조사 가능 ↗"}
                        </span>
                      </div>
                      <h2>{ep.title}</h2>
                      <p>{ep.subtitle}</p>
                      <footer>
                        <span>{ep.mechanic}</span>
                        <span>{ep.duration}</span>
                      </footer>
                    </button>
                  ))}
                </div>
                <div className="campaign-actions">
                  {p.solved.length === 8 && (
                    <button
                      className="primary"
                      onClick={() => setShowEnding(true)}
                    >
                      {view.ending
                        ? "결말 다시 읽기"
                        : "최종 공개 범위 결정하기"}{" "}
                      →
                    </button>
                  )}
                  <button
                    className="secondary"
                    onClick={exportReport}
                    disabled={!p.solved.length}
                  >
                    사건 기록 내려받기
                  </button>
                  <button
                    className="subtle-button"
                    onClick={() => setShowReset(true)}
                  >
                    처음부터 다시 시작
                  </button>
                </div>
                <p className="privacy-note">
                  {client.storage === "browser"
                    ? "진행은 이 브라우저에 자동 저장됩니다. 같은 주소에서 이어서 플레이할 수 있으며, 사이트 데이터를 삭제하면 기록도 사라집니다. "
                    : "진행은 현재 브라우저의 익명 기록으로 서버에 저장됩니다. 쿠키를 지우면 기존 기록에 다시 연결할 수 없습니다. "}
                  이 게임의 인물과 사건은 모두 허구입니다.
                </p>
              </>
            )}
          </main>
          <footer className="workspace-footer">
            <span>은하아파트 커뮤니티 · 기록 보존본</span>
            <span>ARCHIVE IS NOT EMPTY.</span>
          </footer>
        </div>
        {p.started && (
          <div className="investigation-dock" aria-label="조사 도구">
            <button onClick={() => setShowGoals(true)} aria-haspopup="dialog">
              해결 목표
            </button>
            <button onClick={() => goTab("evidence")} aria-haspopup="dialog">
              ⌑ 증거 보관함 <b>{p.pinned.length}</b>
            </button>
            <button onClick={() => goTab("deductions")} aria-haspopup="dialog">
              ✎ 추리 노트
            </button>
          </div>
        )}
        {showGoals && (
          <Dialog
            wide
            label="현재 사건의 해결 목표"
            onClose={() => setShowGoals(false)}
          >
            <InvestigationGuide
              episode={e}
              progress={p}
              feedback={feedback}
              onQuestion={(id) => {
                setShowGoals(false);
                openQuestion(id);
              }}
              onOpen={(r) => {
                setShowGoals(false);
                openRecord(r);
              }}
              onHint={() => {
                setShowGoals(false);
                setShowHint(true);
              }}
              onResolution={() => {
                setShowGoals(false);
                setShowResolution(e.id);
              }}
            />
          </Dialog>
        )}
        {tool === "evidence" && (
          <Dialog wide label="증거 보관함" onClose={() => setTool(null)}>
            <div className="tool-window-heading">
              <span className="eyebrow coral">EVIDENCE CABINET</span>
              <h2>증거 보관함</h2>
              <p>게시판을 그대로 두고, 모아 둔 기록을 대조하세요.</p>
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setTool("deductions");
                }}
              >
                추리 노트로 전환 ↗
              </button>
            </div>
            <div className="evidence-toolbar">
              <p>
                전 사건에서 수집한 기록 <strong>{evidence.length}</strong>개 ·
                최근 수집순
              </p>
              <Search query={query} onChange={setQuery} />
            </div>
            <div className="evidence-grid">
              {visible.map((r) => (
                <button
                  className="evidence-card"
                  key={r.id}
                  onClick={() => openRecord(r)}
                >
                  <div>
                    <span className="file-number">FILE {r.id}</span>
                    <span className="coral">⌑</span>
                  </div>
                  {r.photo && (
                    <img
                      className="evidence-photo"
                      src={r.photo.src}
                      alt={r.photo.alt}
                      width="300"
                      height="140"
                      loading="lazy"
                    />
                  )}
                  <span className="category">{r.board}</span>
                  <h3>{r.title}</h3>
                  <p>
                    {r.surveillance
                      ? `${r.surveillance.camera} 보관 캡처 5장 · 원문에서 이미지 확인`
                      : r.shredded
                        ? "복원한 결산 수정 쪽지 · 두 지급 내역과 회신"
                        : r.paragraphs[0]}
                  </p>
                  <footer>
                    {r.author}
                    <span>열어보기 ↗</span>
                  </footer>
                </button>
              ))}
            </div>
            {!visible.length && (
              <Empty
                text={
                  evidence.length
                    ? "일치하는 증거가 없습니다."
                    : "아직 수집한 증거가 없습니다."
                }
                detail="게시글을 열고 ‘증거 수집’ 버튼을 눌러 보관하세요."
                onReset={() => goTab("board")}
              />
            )}
          </Dialog>
        )}
        {tool === "deductions" && (
          <Dialog
            wide
            label="추리 노트"
            onClose={() => setTool(null)}
            focusTarget={
              focusedQuestion
                ? `question-${e.id}-${focusedQuestion}`
                : undefined
            }
          >
            <div className="tool-window-heading">
              <span className="eyebrow coral">
                CASE {pad(e.id)} · DEDUCTION NOTES
              </span>
              <h2>추리 노트</h2>
              <p>{caseThreads[e.id - 1].question}</p>
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setTool("evidence");
                }}
              >
                증거 보관함으로 전환 ↗
              </button>
            </div>
            <div className="deduction-intro">
              <p>
                <strong>
                  읽은 기록에서 생긴 의문을 정리하고, 근거와 연결하세요.
                </strong>
                글을 수집한 것만으로는 근거가 연결되지 않습니다. 추리를 정리한
                뒤 ‘내 추리 검증하기’를 누르세요.
              </p>
              <button className="secondary" onClick={() => setShowHint(true)}>
                힌트 {level}/3
              </button>
            </div>
            {failedDrafts.length > 0 && (
              <div className="error-banner">
                <span>
                  선택한 내용은 유지되어 있습니다. 저장하지 못한 추리를 다시
                  저장해 주세요.
                </span>
                <button disabled={pending > 0} onClick={retryDrafts}>
                  추리 다시 저장
                </button>
              </div>
            )}
            {solved && (
              <div className="solved-banner">
                <span>✓ 이 사건을 해결했습니다.</span>
                <button onClick={() => setShowResolution(e.id)}>
                  해설 다시 읽기 ↗
                </button>
              </div>
            )}
            {!discoveredQuestions.length && (
              <div className="notebook-start">
                <h3>먼저 사건의 출발점을 확인하세요</h3>
                <p>{caseThreads[e.id - 1].entryReason}</p>
                <button
                  className="primary"
                  onClick={() => openRecord(e.records[0])}
                >
                  {e.records[0].title} 읽기 ↗
                </button>
              </div>
            )}
            {discoveredQuestions.map((q, i) => {
              const draft = makeDraft(q),
                result = feedback?.[q.id];
              return (
                <section
                  className="deduction-card"
                  key={`${e.id}-${q.id}`}
                  id={`question-${e.id}-${q.id}`}
                  tabIndex={-1}
                >
                  <div className="question-header">
                    <span className="question-number">{pad(i + 1)}</span>
                    <h2>{q.prompt}</h2>
                    {result && (
                      <span
                        className={`verdict ${result.answer && result.evidence ? "correct" : ""}`}
                      >
                        {result.answer && result.evidence
                          ? "입증 완료"
                          : "재검토"}
                      </span>
                    )}
                  </div>
                  <div className="deduction-motivation">
                    <strong>
                      {caseThreads[e.id - 1].inquiries[q.id].title}
                    </strong>
                    <p>{caseThreads[e.id - 1].inquiries[q.id].because}</p>
                    <p>
                      <b>전체 사건과 이어지는 이유</b>
                      {caseThreads[e.id - 1].inquiries[q.id].leadsTo}
                    </p>
                  </div>
                  <div className="question-guidance">
                    <p>{investigationGuides[e.id - 1].tips[q.id]}</p>
                    <span>
                      ①{" "}
                      {q.kind === "code"
                        ? "값 입력 후 ‘입력 적용’"
                        : q.kind === "order"
                          ? "위아래 화살표로 순서 정하기"
                          : "답 하나 선택"}{" "}
                      → ② 아래에서 근거 {evidenceSelectionLabel(q)} 선택
                    </span>
                  </div>
                  {q.kind === "choice" && (
                    <fieldset className="choice-list" disabled={blocking > 0}>
                      <legend className="sr-only">{q.prompt}</legend>
                      {q.options!.map((option, j) => (
                        <label
                          className={draft.answer === option ? "chosen" : ""}
                          key={option}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={option}
                            checked={draft.answer === option}
                            onChange={() =>
                              saveDraft(q, (current) => ({
                                ...current,
                                answer: option,
                              }))
                            }
                          />
                          <span className="option-letter">
                            {String.fromCharCode(65 + j)}
                          </span>
                          <span>{option}</span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {q.kind === "code" && (
                    <CodeInput
                      key={`${e.id}-${q.id}`}
                      value={
                        typeof draft.answer === "string" ? draft.answer : ""
                      }
                      placeholder={q.placeholder!}
                      label={q.prompt}
                      disabled={blocking > 0}
                      onCommit={(answer) =>
                        saveDraft(q, (current) => ({ ...current, answer }))
                      }
                    />
                  )}
                  {q.kind === "order" && (
                    <ol className="order-list">
                      {(draft.answer as string[]).map((item, j, arr) => (
                        <li key={item}>
                          <span className="order-index">{j + 1}</span>
                          <span>{item}</span>
                          <div>
                            <button
                              aria-label={`${item} 위로`}
                              disabled={j === 0 || blocking > 0}
                              onClick={() => {
                                saveDraft(q, (current) => {
                                  const a = [...(current.answer as string[])];
                                  [a[j - 1], a[j]] = [a[j], a[j - 1]];
                                  return { ...current, answer: a };
                                });
                              }}
                            >
                              ↑
                            </button>
                            <button
                              aria-label={`${item} 아래로`}
                              disabled={j === arr.length - 1 || blocking > 0}
                              onClick={() => {
                                saveDraft(q, (current) => {
                                  const a = [...(current.answer as string[])];
                                  [a[j + 1], a[j]] = [a[j], a[j + 1]];
                                  return { ...current, answer: a };
                                });
                              }}
                            >
                              ↓
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  <EvidencePicker
                    records={evidence}
                    selectedIds={draft.evidence}
                    minimum={q.evidenceCount}
                    maximum={evidenceLimit(q)}
                    disabled={blocking > 0}
                    onRead={openRecord}
                    onCollect={() => goTab("board")}
                    onToggle={(id) => {
                      saveDraft(q, (current) => {
                        const removing = current.evidence.includes(id);
                        if (
                          !removing &&
                          current.evidence.length >= evidenceLimit(q)
                        )
                          return current;
                        return {
                          ...current,
                          evidence: removing
                            ? current.evidence.filter((record) => record !== id)
                            : [...current.evidence, id],
                        };
                      });
                    }}
                  />
                  {result && !(result.answer && result.evidence) && (
                    <p className="feedback" role="status">
                      {!result.answer
                        ? "가설을 기록과 다시 대조해 보세요."
                        : "가설은 맞습니다."}{" "}
                      {!result.evidence &&
                        (result.evidenceMessage ??
                          `이 가설을 입증하는 증거 ${evidenceSelectionLabel(q)}를 다시 선택해 주세요.`)}
                    </p>
                  )}
                </section>
              );
            })}
            {discoveredQuestions.length < e.questions.length && (
              <div className="remaining-inquiries">
                <p>
                  다른 기록을 읽으면 지금의 추리를 이어 갈 새로운 의문이
                  나타납니다.
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    setSelected(null);
                    goTab("board");
                  }}
                >
                  게시판에서 기록 계속 읽기 ↗
                </button>
              </div>
            )}
            <div className="submit-row">
              <p>
                현재 추리와 근거 준비{" "}
                {
                  discoveredQuestions.filter((q) => {
                    const s = questionPreparation(e, q, p, feedback);
                    return s.confirmed || (s.ready && !s.needsReview);
                  }).length
                }
                /{discoveredQuestions.length} <span>·</span> 시도 횟수 제한 없음{" "}
                <span>·</span> {p.attempts[e.id] ?? 0}회 검토
              </p>
              <button
                className="primary"
                onClick={solve}
                disabled={
                  blocking > 0 ||
                  failedDrafts.some((d) => d.episode === e.id) ||
                  !discoveredQuestions.length
                }
              >
                내 추리 검증하기 <span>→</span>
              </button>
            </div>
          </Dialog>
        )}
        {selected && (
          <Dialog
            key={`${selected.id}-${recordWindow}`}
            wide
            label={selected.title}
            onClose={() => setSelected(null)}
          >
            <div className="document-kicker">
              {isPublicRecord(selected) ? "공개 게시글" : "받은 첨부"} ·{" "}
              {selected.id} <span>{selected.board}</span>
              {selected.deleted && (
                <span className="restored">삭제 전 원문 복원</span>
              )}
            </div>
            <h2 className="document-title">{selected.title}</h2>
            <div className="document-meta">
              {isPublicRecord(selected) && (
                <ResidentAvatar name={selected.author} />
              )}
              <span>{selected.author}</span>
              <time>2026.{selected.date}</time>
              {isPublicRecord(selected) ? (
                <span>조회 {recordStats(selected).views}</span>
              ) : (
                <span>
                  받은 시각 2026.
                  {deliveries[Number(selected.id.split("-")[0]) - 1].date}
                </span>
              )}
              {selected.status && (
                <span className="post-status">{selected.status}</span>
              )}
            </div>
            {selected.shredded ? (
              <ShreddedDocument
                record={selected}
                saved={restorationFor(selected, p)}
                onSave={async (order, verify) =>
                  !!(await send({
                    type: verify ? "restore" : "arrange",
                    record: selected.id,
                    pieces: order,
                  }))
                }
              />
            ) : selected.surveillance ? (
              <CctvViewer
                footage={selected.surveillance}
                offset={
                  calibrationFor(p).confirmed
                    ? calibrationFor(p).offset
                    : undefined
                }
              />
            ) : (
              <div className="document-body">
                {selected.paragraphs.map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              </div>
            )}
            {selected.photo && (
              <figure className="document-photo">
                <a
                  href={selected.photo.src}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="첨부 사진 크게 보기"
                >
                  <img
                    src={selected.photo.src}
                    alt={selected.photo.alt}
                    width="1000"
                    height="1000"
                  />
                </a>
                <figcaption>{selected.photo.caption}</figcaption>
              </figure>
            )}
            {selected.attachment && (
              <section className="attachment">
                <h3>↳ {selected.attachment.title}</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {selected.attachment.columns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.attachment.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {selected.comments && (
              <section className="comments">
                <h3>
                  {isPublicRecord(selected)
                    ? `댓글 ${selected.comments.length}`
                    : "보관된 부가 기록"}
                </h3>
                {selected.comments.map((c, i) => (
                  <div className="resident-comment" key={i}>
                    <ResidentAvatar name={c.author} />
                    <div>
                      <strong>{c.author}</strong>
                      {c.date && <time>{c.date}</time>}
                      <p>{c.text}</p>
                    </div>
                  </div>
                ))}
              </section>
            )}
            {recordRestored(selected, p) &&
              e.questions.some((q) =>
                caseThreads[e.id - 1].inquiries[q.id].discoveredBy.includes(
                  selected.id,
                ),
              ) && (
                <section className="record-inquiries">
                  <h3>이 기록을 읽고 생긴 의문</h3>
                  {e.questions
                    .filter((q) =>
                      caseThreads[e.id - 1].inquiries[
                        q.id
                      ].discoveredBy.includes(selected.id),
                    )
                    .map((q) => (
                      <div key={q.id}>
                        <strong>
                          {caseThreads[e.id - 1].inquiries[q.id].title}
                        </strong>
                        <p>{caseThreads[e.id - 1].inquiries[q.id].because}</p>
                        <button
                          className="text-button"
                          disabled={pending > 0}
                          onClick={() => openQuestion(q.id)}
                        >
                          이 의문을 추리 노트에 정리 ↗
                        </button>
                      </div>
                    ))}
                </section>
              )}
            {isPublicRecord(selected) && (
              <div className="post-reactions">
                <button
                  className="secondary"
                  data-sound="silent"
                  aria-pressed={(p.liked ?? []).includes(selected.id)}
                  disabled={pending > 0}
                  onClick={() => send({ type: "like", record: selected.id })}
                >
                  ♡ 공감{" "}
                  {recordStats(selected).likes +
                    ((p.liked ?? []).includes(selected.id) ? 1 : 0)}
                </button>
                <span>댓글과 조회수는 보관 당시의 모습입니다.</span>
              </div>
            )}
            {["2-1", "2-2"].includes(selected.id) && (
              <section className="record-comparison-entry">
                <p>
                  {comparisonReady(p)
                    ? "두 자료에서 같은 동작을 찾았다면 함께 놓고 대조해 보세요."
                    : "정문 작동 기록과 C2 보관 화면의 원문을 모두 열면 함께 대조할 수 있습니다."}
                </p>
                <button
                  type="button"
                  className="secondary"
                  disabled={!comparisonReady(p)}
                  onClick={() => {
                    sound.play("open");
                    setShowComparison(true);
                  }}
                >
                  기록 대조 열기
                </button>
                {calibrationFor(p).confirmed && <span>✓ 대조 결과 저장됨</span>}
              </section>
            )}
            <footer className="document-footer">
              <span>
                {p.pinned.includes(selected.id)
                  ? "✓ 증거 보관함에 저장된 기록"
                  : !recordRestored(selected, p)
                    ? "복원을 마치면 증거로 수집할 수 있습니다"
                    : "이 기록이 단서가 될 수 있을까요?"}
              </span>
              <button
                disabled={pending > 0 || !recordRestored(selected, p)}
                data-sound="silent"
                className={
                  p.pinned.includes(selected.id) ? "secondary" : "primary"
                }
                onClick={() => send({ type: "pin", record: selected.id })}
              >
                {p.pinned.includes(selected.id) ? "수집 해제" : "⌑ 증거 수집"}
              </button>
            </footer>
            <div className="document-tools">
              <p className="record-next-help">
                단서를 찾았다면 증거로 수집한 뒤, 추리 노트에서 해당 질문의
                근거로 선택하세요.
              </p>
              <button className="text-button" onClick={() => goTab("evidence")}>
                증거 보관함 열기 ↗
              </button>
              <button
                className="text-button"
                onClick={() => goTab("deductions")}
              >
                추리 노트 열기 ↗
              </button>
            </div>
          </Dialog>
        )}
        {showComparison && (
          <Dialog
            wide
            label="기록 대조"
            onClose={() => setShowComparison(false)}
          >
            <TimelineComparison
              saved={calibrationFor(p)}
              onSave={async (offset, confirm) =>
                !!(await send({
                  type: confirm ? "calibrate" : "align",
                  offset,
                }))
              }
            />
          </Dialog>
        )}
        {(!p.started ||
          showPrologue ||
          !(p.introduced ?? []).includes(e.id)) && (
          <StoryPrologue
            episode={!p.started ? episodes[0] : e}
            first={!p.started}
            pending={pending > 0}
            onContinue={() => {
              if (pending > 0) return;
              if (!p.started) void send({ type: "start" });
              else if (!(p.introduced ?? []).includes(e.id))
                void send({ type: "intro", episode: e.id }).then((data) => {
                  if (data) setShowPrologue(false);
                });
              else {
                sound.play("close");
                setShowPrologue(false);
              }
            }}
          />
        )}
        {help && (
          <Dialog label="플레이 안내" onClose={() => setHelp(false)}>
            <div className="eyebrow coral">HOW TO INVESTIGATE</div>
            <h2 className="modal-title">기록자의 안내서</h2>
            <div className="help-copy">
              <p>
                <strong>게시판 기록</strong>에는 공개된 주민 글이 계속 쌓입니다.
                <strong>받은 자료함</strong>에는 회신과 비공개 원본이
                도착합니다. 삭제된 글의 복원본도 받은 자료에서 확인할 수
                있습니다.
              </p>
              <p>
                <strong>증거 수집</strong>을 누르면 증거 보관함에 남습니다. 다음
                사건에서도 이전 증거를 사용할 수 있습니다.
              </p>
              <p>
                <strong>추리 노트</strong>에서 가설마다 답과 지정된 개수의
                증거를 선택하세요. 순서는 화살표로 바꾸고 숫자 답안은 ‘입력
                적용’을 누르세요.
              </p>
              <p>
                틀려도 불이익은 없습니다. <strong>힌트 3단계</strong>는 관찰
                방향부터 구체적인 해답까지 차례대로 열립니다. 시간 제한도
                없습니다.
              </p>
              <p>
                {client.storage === "browser"
                  ? "메모와 진행은 이 브라우저에 자동 저장됩니다. 새로고침하거나 창을 닫아도 같은 주소에서 이어서 플레이할 수 있습니다. 사이트 데이터를 삭제하거나 다른 기기·브라우저를 사용하면 새 게임이 시작됩니다."
                  : "메모와 진행은 익명 세션으로 서버에 자동 저장됩니다. 쿠키 삭제나 다른 브라우저로 접속하면 새 게임이 시작됩니다."}
              </p>
              <p>
                모든 사건을 해결하면 공개 범위에 따른{" "}
                <strong>두 가지 결말</strong>을 볼 수 있습니다. 사건 목록에서
                완료한 보고서를 내려받을 수 있습니다.
              </p>
            </div>
          </Dialog>
        )}
        {showHint && (
          <Dialog label="사건 힌트" onClose={() => setShowHint(false)}>
            <div className="eyebrow coral">
              A SMALL NUDGE / CASE {pad(e.id)}
            </div>
            <h2 className="modal-title">조금 다른 각도에서.</h2>
            {!level && (
              <p className="modal-prose">
                첫 힌트는 관찰 방향을 알려줍니다. 세 번째 힌트에는 답과 근거가
                직접 나옵니다.
              </p>
            )}
            {e.hints.slice(0, level).map((hint, i) => (
              <div className="hint" key={i}>
                <span>HINT {i + 1}</span>
                <p>{hint}</p>
              </div>
            ))}
            <button
              className="primary full"
              data-sound="silent"
              disabled={level >= 3 || pending > 0}
              onClick={() => send({ type: "hint", episode: e.id })}
            >
              {level >= 3
                ? "모든 힌트를 확인했습니다"
                : `${level + 1}단계 힌트 열기`}
            </button>
          </Dialog>
        )}
        {showResolution && view.resolutions[showResolution] && (
          <Dialog label="사건 해결" onClose={() => setShowResolution(null)}>
            <div className="solved-seal">✓</div>
            <div className="eyebrow coral">
              CASE {pad(showResolution)} / RESOLVED
            </div>
            <h2 className="modal-title">
              {view.resolutions[showResolution].title}
            </h2>
            <p className="modal-prose">
              {view.resolutions[showResolution].text}
            </p>
            <div className="next-lead">
              {view.resolutions[showResolution].next}
            </div>
            <button
              className="primary full"
              disabled={pending > 0}
              onClick={() => {
                if (showResolution === 8) {
                  setShowResolution(null);
                  setShowEnding(true);
                } else void visit(showResolution + 1, "inbox");
              }}
            >
              {showResolution === 8
                ? "기록의 공개 범위 결정하기"
                : "도착한 회신 확인하기"}{" "}
              →
            </button>
          </Dialog>
        )}
        {showEnding && (
          <Dialog wide label="마지막 기록" onClose={() => setShowEnding(false)}>
            <div className="eyebrow coral">THE LAST RECORD / EPILOGUE</div>
            {view.ending ? (
              <>
                <h2 className="modal-title">{view.ending.title}</h2>
                <p className="modal-prose">{view.ending.text}</p>
                <div className="ending-after">{view.ending.after}</div>
                <div className="credits">
                  <strong>삭제된 게시판</strong>
                  <p>
                    여덟 개의 사건, 하나의 진실.
                    <br />
                    끝까지 기록을 읽어 주셔서 감사합니다.
                  </p>
                  <span>8 / 8 CASES RESTORED</span>
                </div>
                <div className="ending-buttons">
                  <button className="primary" onClick={exportReport}>
                    나의 사건 기록 내려받기 ↓
                  </button>
                  <button
                    className="secondary"
                    disabled={pending > 0}
                    onClick={() =>
                      send({
                        type: "ending",
                        ending: p.ending === "public" ? "audit" : "public",
                      })
                    }
                  >
                    다른 선택의 결말 읽기
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="modal-title">무엇을, 누구에게 남길까요.</h2>
                <p className="modal-prose">
                  원본은 이미 세 곳에 안전하게 보관되었고 삭제 작업은
                  중지되었습니다. 두 선택 모두 서윤의 보호처와 개인 연락처를
                  공개하지 않습니다.
                </p>
                <div className="ending-choices">
                  <button
                    disabled={pending > 0}
                    onClick={() => send({ type: "ending", ending: "public" })}
                  >
                    <span>01 / 주민 공개</span>
                    <h3>가린 사본, 열린 이야기</h3>
                    <p>
                      개인정보를 가린 보고서를 주민에게 공개하고 원본은 감사
                      담당자에게 전달합니다.
                    </p>
                    <strong>이 기록을 남기기 →</strong>
                  </button>
                  <button
                    disabled={pending > 0}
                    onClick={() => send({ type: "ending", ending: "audit" })}
                  >
                    <span>02 / 한정 제출</span>
                    <h3>조용하고 단단한 보존</h3>
                    <p>
                      감사 담당자에게 보고서와 원본을 제출하고 주민에게는 보존
                      완료와 감사 착수를 알립니다.
                    </p>
                    <strong>이 기록을 남기기 →</strong>
                  </button>
                </div>
              </>
            )}
          </Dialog>
        )}
        {showReset && (
          <Dialog label="새 게임 시작 확인" onClose={() => setShowReset(false)}>
            <h2 className="modal-title">처음부터 다시 시작할까요?</h2>
            <p className="modal-prose">
              현재 브라우저의 진행, 수집 증거, 메모가 초기화됩니다. 완료한
              사건은 먼저 기록으로 내려받을 수 있습니다.
            </p>
            <div className="ending-buttons">
              <button className="secondary" onClick={exportReport}>
                사건 기록 내려받기
              </button>
              <button
                className="primary"
                disabled={pending > 0}
                onClick={async () => {
                  if (noteTimer.current) clearTimeout(noteTimer.current);
                  notePending.current = null;
                  const data = await send({ type: "reset" });
                  if (data) {
                    setShowReset(false);
                    setBoardSession((session) => session + 1);
                    setNotes({});
                    setNoteDirty(false);
                    setTab("board");
                    setQuery("");
                    setTool(null);
                    setFeedback(null);
                    setSelected(null);
                    setShowPrologue(false);
                  }
                }}
              >
                초기화하고 시작
              </button>
            </div>
          </Dialog>
        )}
      </div>
    </GameErrorContext.Provider>
  );
}
