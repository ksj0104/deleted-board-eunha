"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  episodes,
  recordById,
  type Question,
  type RecordFile,
} from "../lib/cases";
import type { Progress, Draft, Action, Feedback } from "../lib/game";
import {
  Dialog,
  Search,
  Empty,
  CodeInput,
  GameErrorContext,
} from "./components";
import CommunityBoard, { ResidentAvatar } from "./CommunityBoard";
import StoryPrologue from "./StoryPrologue";
import { recordStats } from "../lib/community";
import InvestigationGuide from "./InvestigationGuide";
import { investigationGuides, questionPreparation } from "../lib/investigation";
type Resolution = { title: string; text: string; next: string };
type View = {
  progress: Progress;
  resolutions: Record<string, Resolution>;
  ending: { title: string; label: string; text: string; after: string } | null;
  feedback?: Feedback;
};
type Tab = "board" | "evidence" | "deductions" | "notes" | "cases";
const tabs: { id: Tab; label: string; glyph: string }[] = [
  { id: "board", label: "게시판 기록", glyph: "▤" },
  { id: "evidence", label: "증거 보관함", glyph: "⌑" },
  { id: "deductions", label: "추리 노트", glyph: "⌘" },
  { id: "notes", label: "나의 메모", glyph: "✎" },
  { id: "cases", label: "사건 목록", glyph: "▦" },
];
const pad = (n: number) => String(n).padStart(2, "0");

export default function Game() {
  const [view, setView] = useState<View | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const [tab, setTab] = useState<Tab>("board");
  const [query, setQuery] = useState("");
  const [tool, setTool] = useState<"evidence" | "deductions" | null>(null);
  const [showPrologue, setShowPrologue] = useState(false);
  const [focusedQuestion, setFocusedQuestion] = useState<string>();
  const [showGoals, setShowGoals] = useState(false);
  const [selected, setSelected] = useState<RecordFile | null>(null);
  const [recordWindow, setRecordWindow] = useState(0);
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
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notePending = useRef<{ episode: number; text: string } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/game", { cache: "no-store" });
      const data = (await r.json()) as View & { error?: string };
      if (!r.ok) throw new Error(data.error);
      setView(data);
      setNotes(data.progress.notes);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "기록을 불러오지 못했습니다.",
      );
    }
  }, []);
  useEffect(() => {
    // load updates state after the network promise resolves or rejects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const send = useCallback((action: Action): Promise<View | null> => {
    setPending((n) => n + 1);
    setError("");
    const job = queue.current
      .catch(() => null)
      .then(async () => {
        try {
          const r = await fetch("/api/game", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action),
          });
          const data = (await r.json()) as View & { error?: string };
          if (!r.ok) throw new Error(data.error);
          setView(data);
          return data;
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "저장하지 못했습니다. 다시 시도해 주세요.",
          );
          return null;
        } finally {
          setPending((n) => n - 1);
        }
      });
    queue.current = job;
    return job;
  }, []);
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
      if (pending || noteDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [pending, noteDirty]);
  const goTab = (next: Tab) => {
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
    flushNote();
    setQuery("");
    setFocusedQuestion(id);
    setTool("deductions");
  };
  const visit = async (id: number) => {
    flushNote();
    const data = await send({ type: "visit", episode: id });
    if (data) {
      setTab("board");
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
            다시 연결하기
          </button>
        )}
      </div>
    );
  const p = view.progress,
    e = episodes[p.active - 1],
    maxEpisode = Math.min(8, p.solved.length + 1),
    solved = p.solved.includes(e.id);
  const evidence = p.pinned.map(recordById).filter((r): r is RecordFile => !!r);
  const search = query.trim().toLocaleLowerCase();
  const source = evidence;
  const visible = source.filter(
    (r) =>
      !search ||
      [
        r.title,
        r.author,
        r.id,
        ...r.paragraphs,
        ...(r.comments ?? []).map((c) => c.text),
        ...(r.attachment?.rows.flat() ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search),
  );
  const level = p.hints[e.id] ?? 0;
  const makeDraft = (q: Question): Draft =>
    p.drafts[e.id]?.[q.id] ?? {
      answer: q.kind === "order" ? [...q.options!] : "",
      evidence: [],
    };
  const saveDraft = (q: Question, draft: Draft) => {
    setFeedback(null);
    void send({ type: "draft", episode: e.id, question: q.id, draft });
  };
  const solve = async () => {
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
      <div className={`app-shell ${fontLarge ? "large-text" : ""}`}>
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
            <div className="save-status" role="status">
              <span className={error ? "status-dot error-dot" : "status-dot"} />
              {error
                ? "저장 확인 필요"
                : noteDirty
                  ? "메모 저장 대기"
                  : pending
                    ? "기록 저장 중…"
                    : "자동 저장됨"}
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
                  CASE {pad(e.id)} <span className="eyebrow-divider">/</span>{" "}
                  {e.mechanic}
                </div>
                <h1>
                  {tab === "cases"
                    ? "지워진 자리의 이야기"
                    : tab === "notes"
                      ? "나의 메모"
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
                      : tab === "evidence"
                        ? "수집한 증거는 다음 사건에서도 다시 살펴볼 수 있습니다."
                        : tab === "deductions"
                          ? "가설을 세우고, 그 가설을 뒷받침하는 기록을 선택하세요."
                          : e.subtitle}
                </p>
              </div>
              <div className="case-stamp">
                <span>은하아파트</span>
                <strong>{pad(e.id)}</strong>
                <small>{solved ? "해결된 사건" : "조사 진행 중"}</small>
              </div>
            </div>
            {tab === "board" && (
              <>
                <InvestigationGuide
                  episode={e}
                  progress={p}
                  feedback={feedback}
                  onQuestion={openQuestion}
                  onOpen={openRecord}
                  onHint={() => setShowHint(true)}
                  onResolution={() => setShowResolution(e.id)}
                />
                <CommunityBoard
                  key={e.id}
                  episode={e}
                  progress={p}
                  onOpen={openRecord}
                  onStory={() => setShowPrologue(true)}
                />
              </>
            )}
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
                    noteTimer.current = setTimeout(flushNote, 700);
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
                  진행은 현재 브라우저의 익명 기록으로 서버에 저장됩니다. 쿠키를
                  지우면 기존 기록에 다시 연결할 수 없습니다. 이 게임의 인물과
                  사건은 모두 허구입니다.
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
                전 사건에서 수집한 기록 <strong>{evidence.length}</strong>개
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
                  <p>{r.paragraphs[0]}</p>
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
              <p>
                {e.title} · {e.objective}
              </p>
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
                  각 질문에 답을 입력하고, 바로 아래에서 근거를 선택하세요.
                </strong>
                글을 수집한 것만으로는 근거가 연결되지 않습니다. 세 질문을 채운
                뒤 맨 아래 ‘세 가설 검증하기’를 누르면 됩니다.
              </p>
              <button className="secondary" onClick={() => setShowHint(true)}>
                힌트 {level}/3
              </button>
            </div>
            {solved && (
              <div className="solved-banner">
                <span>✓ 이 사건을 해결했습니다.</span>
                <button onClick={() => setShowResolution(e.id)}>
                  해설 다시 읽기 ↗
                </button>
              </div>
            )}
            {e.questions.map((q, i) => {
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
                  <div className="question-guidance">
                    <p>{investigationGuides[e.id - 1].tips[q.id]}</p>
                    <span>
                      ①{" "}
                      {q.kind === "code"
                        ? "값 입력 후 ‘입력 적용’"
                        : q.kind === "order"
                          ? "위아래 화살표로 순서 정하기"
                          : "답 하나 선택"}{" "}
                      → ② 아래에서 근거 {q.evidenceCount}개 선택
                    </span>
                  </div>
                  {q.kind === "choice" && (
                    <fieldset className="choice-list" disabled={pending > 0}>
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
                              saveDraft(q, { ...draft, answer: option })
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
                      disabled={pending > 0}
                      onCommit={(answer) => saveDraft(q, { ...draft, answer })}
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
                              disabled={j === 0 || pending > 0}
                              onClick={() => {
                                const a = [...arr];
                                [a[j - 1], a[j]] = [a[j], a[j - 1]];
                                saveDraft(q, { ...draft, answer: a });
                              }}
                            >
                              ↑
                            </button>
                            <button
                              aria-label={`${item} 아래로`}
                              disabled={j === arr.length - 1 || pending > 0}
                              onClick={() => {
                                const a = [...arr];
                                [a[j + 1], a[j]] = [a[j], a[j + 1]];
                                saveDraft(q, { ...draft, answer: a });
                              }}
                            >
                              ↓
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="proof-heading">
                    <span>
                      뒷받침하는 증거{" "}
                      <strong>
                        {
                          draft.evidence.filter((id) => p.pinned.includes(id))
                            .length
                        }
                        /{q.evidenceCount}
                      </strong>
                    </span>
                    <small>정확히 {q.evidenceCount}개 선택</small>
                  </div>
                  <p className="proof-help">
                    수집한 글 중 이 답을 직접 뒷받침하는 기록에 체크하세요.
                    ‘원문’을 눌러 다시 읽을 수 있습니다.
                  </p>
                  {evidence.length ? (
                    <div className="proof-options">
                      {evidence.map((r) => {
                        const checked =
                          draft.evidence.includes(r.id) &&
                          p.pinned.includes(r.id);
                        return (
                          <div className="proof-option" key={r.id}>
                            <label className={checked ? "selected" : ""}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={
                                  pending > 0 ||
                                  (!checked &&
                                    draft.evidence.filter((id) =>
                                      p.pinned.includes(id),
                                    ).length >= q.evidenceCount)
                                }
                                onChange={() => {
                                  const valid = draft.evidence.filter((id) =>
                                    p.pinned.includes(id),
                                  );
                                  saveDraft(q, {
                                    ...draft,
                                    evidence: checked
                                      ? valid.filter((id) => id !== r.id)
                                      : [...valid, r.id],
                                  });
                                }}
                              />
                              <span className="proof-id">{r.id}</span>
                              <span>{r.title}</span>
                            </label>
                            <button
                              className="proof-read"
                              aria-label={r.title + " 원문 읽기"}
                              onClick={() => openRecord(r)}
                            >
                              원문 ↗
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      className="collect-prompt"
                      onClick={() => goTab("board")}
                    >
                      게시판에서 증거 수집하기 ↗
                    </button>
                  )}
                  {result && !(result.answer && result.evidence) && (
                    <p className="feedback" role="status">
                      {!result.answer
                        ? "가설을 기록과 다시 대조해 보세요."
                        : "가설은 맞습니다."}{" "}
                      {!result.evidence &&
                        `이 가설을 직접 입증하는 증거 ${q.evidenceCount}개를 다시 선택해 주세요.`}
                    </p>
                  )}
                </section>
              );
            })}
            <div className="submit-row">
              <p>
                답과 근거 준비{" "}
                {
                  e.questions.filter((q) => {
                    const s = questionPreparation(e, q, p, feedback);
                    return s.confirmed || (s.ready && !s.needsReview);
                  }).length
                }
                /3 <span>·</span> 시도 횟수 제한 없음 <span>·</span>{" "}
                {p.attempts[e.id] ?? 0}회 검토
              </p>
              <button
                className="primary"
                onClick={solve}
                disabled={pending > 0}
              >
                세 가설 검증하기 <span>→</span>
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
              RECORD {selected.id} <span>{selected.board}</span>
              {selected.deleted && (
                <span className="restored">삭제 전 원문 복원</span>
              )}
            </div>
            <h2 className="document-title">{selected.title}</h2>
            <div className="document-meta">
              <ResidentAvatar name={selected.author} />
              <span>{selected.author}</span>
              <time>2026.{selected.date}</time>
              <span>조회 {recordStats(selected).views}</span>
              {selected.status && (
                <span className="post-status">{selected.status}</span>
              )}
            </div>
            <div className="document-body">
              {selected.paragraphs.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>
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
                <h3>댓글 {selected.comments.length}</h3>
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
            <div className="post-reactions">
              <button
                className="secondary"
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
            <footer className="document-footer">
              <span>
                {p.pinned.includes(selected.id)
                  ? "✓ 증거 보관함에 저장된 기록"
                  : "이 기록이 단서가 될 수 있을까요?"}
              </span>
              <button
                disabled={pending > 0}
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
              else setShowPrologue(false);
            }}
          />
        )}
        {help && (
          <Dialog label="플레이 안내" onClose={() => setHelp(false)}>
            <div className="eyebrow coral">HOW TO INVESTIGATE</div>
            <h2 className="modal-title">기록자의 안내서</h2>
            <div className="help-copy">
              <p>
                <strong>게시판 기록</strong>에서 글을 열어 읽으세요. 삭제 표시가
                있는 글도 보관본에서 복원되어 있습니다. 검색은 본문과 첨부
                표까지 찾습니다.
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
                메모와 진행은 익명 세션으로 서버에 자동 저장됩니다. 쿠키 삭제나
                다른 브라우저로 접속하면 새 게임이 시작됩니다.
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
                } else void visit(showResolution + 1);
              }}
            >
              {showResolution === 8
                ? "기록의 공개 범위 결정하기"
                : `사건 ${pad(showResolution + 1)} 열기`}{" "}
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
