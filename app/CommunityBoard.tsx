"use client";
import React, { useState } from "react";
import type { RecordFile } from "../lib/cases";
import { communityImages, recordStats } from "../lib/community";
import { episodeStories } from "../lib/stories";
import type { Progress } from "../lib/game";
import { Empty, Search } from "./components";
import { communityRecords, worldDate, worldStage } from "../lib/world";

export function ResidentAvatar({ name }: { name: string }) {
  const colors = ["#52736d", "#927056", "#687a91", "#86738c", "#7d8558"];
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      aria-hidden="true"
      className="resident-avatar"
      style={{ background: colors[hash % colors.length] }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default function CommunityBoard({
  progress,
  onOpen,
  onStory,
}: {
  progress: Progress;
  onOpen: (r: RecordFile) => void;
  onStory: () => void;
}) {
  const [query, setQuery] = useState("");
  const [board, setBoard] = useState("전체");
  const [sort, setSort] = useState("newest");
  const [photos, setPhotos] = useState(false);
  const [page, setPage] = useState(1);
  const source = communityRecords(progress);
  const boards = ["전체", ...new Set(source.map((r) => r.board))];
  const search = query.trim().toLocaleLowerCase();
  const filtered = source
    .filter(
      (r) =>
        (board === "전체" || board === r.board) &&
        (!photos || r.photo) &&
        (!search ||
          [
            r.title,
            r.author,
            r.id,
            ...r.paragraphs,
            ...(r.comments ?? []).flatMap((c) => [c.author, c.text]),
            ...(r.attachment?.rows.flat() ?? []),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(search)),
    )
    .sort((a, b) =>
      sort === "comments"
        ? (b.comments?.length ?? 0) - (a.comments?.length ?? 0) ||
          b.date.localeCompare(a.date)
        : sort === "oldest"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * 12, currentPage * 12);
  const reset = () => {
    setQuery("");
    setBoard("전체");
    setPhotos(false);
    setPage(1);
  };
  const photoPosts = source
    .filter((r) => r.photo)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const recentComments = source
    .filter((r) => r.comments?.length)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  return (
    <section className="community-board" aria-label="은하아파트 주민 게시판">
      <div className="community-cover">
        <img
          src={communityImages.courtyard.src}
          alt={communityImages.courtyard.alt}
          width="1536"
          height="1024"
        />
        <div className="community-cover-copy">
          <span>EUNHA APARTMENT · 우리 동네 이야기</span>
          <h2>은하아파트 주민마당</h2>
          <p>별일 없는 하루도, 여기서는 이야기가 됩니다.</p>
        </div>
        <span className="archive-pill">2026.{worldDate(progress)}</span>
      </div>
      <div className="community-notice">
        <strong>마을 알림</strong>
        <span>{episodeStories[worldStage(progress) - 1].communityNote}</span>
        <button className="text-button" onClick={onStory}>
          도입 이야기 다시 보기 ↗
        </button>
      </div>
      <div className="community-columns">
        <div className="community-feed">
          <div className="section-heading">
            <h2>
              이웃들의 이야기 <span>{source.length}</span>
            </h2>
            <span className="muted">조회수·댓글은 보관 당시 기록</span>
          </div>
          <div className="board-filters community-filters">
            {boards.map((b) => (
              <button
                key={b}
                className={board === b ? "selected" : ""}
                aria-pressed={board === b}
                onClick={() => {
                  setBoard(b);
                  setPage(1);
                }}
              >
                {b}
              </button>
            ))}
          </div>
          <div className="community-controls">
            <Search
              query={query}
              onChange={(q) => {
                setQuery(q);
                setPage(1);
              }}
            />
            <div>
              <select
                aria-label="글 정렬"
                value={sort}
                onChange={(ev) => {
                  setSort(ev.target.value);
                  setPage(1);
                }}
              >
                <option value="newest">최신 글순</option>
                <option value="oldest">오래된 글순</option>
                <option value="comments">댓글 많은 순</option>
              </select>
            </div>
          </div>
          <div className="feed-summary">
            <span>총 {filtered.length}개의 글</span>
            <button
              aria-pressed={photos}
              className={photos ? "photo-toggle active" : "photo-toggle"}
              onClick={() => {
                setPhotos(!photos);
                setPage(1);
              }}
            >
              ▧ 사진이 있는 글
            </button>
          </div>
          <div className="record-table community-table">
            {shown.map((r) => (
              <button
                className={`record-row community-row ${progress.read.includes(r.id) ? "read" : ""}`}
                key={r.id}
                onClick={() => onOpen(r)}
              >
                <div className="community-row-copy">
                  <div className="post-labels">
                    <span className="category">{r.board}</span>
                    {r.status && (
                      <span className="post-status">{r.status}</span>
                    )}
                    {r.deleted && <span className="restored">복원</span>}
                    {progress.pinned.includes(r.id) && (
                      <span className="pinned-mark" aria-label="수집한 증거">
                        ⌑
                      </span>
                    )}
                  </div>
                  <strong>
                    {r.title}
                    <span className="comment-count">
                      [{r.comments?.length ?? 0}]
                    </span>
                  </strong>
                  <p className="post-preview">{r.paragraphs[0]}</p>
                  <div className="community-row-meta">
                    <ResidentAvatar name={r.author} />
                    <span>{r.author}</span>
                    <time>{r.date}</time>
                    <span>조회 {recordStats(r).views}</span>
                    {r.attachment && <span>첨부 1</span>}
                  </div>
                </div>
                {r.photo && (
                  <img
                    className="post-thumbnail"
                    src={r.photo.src}
                    alt={r.photo.alt}
                    width="84"
                    height="84"
                    loading="lazy"
                  />
                )}
              </button>
            ))}
            {!shown.length && (
              <Empty
                text="일치하는 기록이 없습니다."
                detail="검색어나 게시판 분류를 바꿔 보세요."
                onReset={reset}
              />
            )}
          </div>
          <nav className="board-pagination" aria-label="게시글 페이지">
            <button
              className="secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              ← 이전 글
            </button>
            <span aria-live="polite">
              {currentPage} / {pages} 페이지
            </span>
            <button
              className="secondary"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              다음 글 →
            </button>
          </nav>
        </div>
        <aside className="community-rail" aria-label="주민마당 소식">
          <section>
            <div className="rail-heading">
              <span>이웃의 사진첩</span>
              <small>OUR MOMENTS</small>
            </div>
            <div className="neighborhood-photos">
              {photoPosts.map((r) => (
                <button key={r.id} onClick={() => onOpen(r)}>
                  <img
                    src={r.photo!.src}
                    alt={r.photo!.alt}
                    width="240"
                    height="150"
                    loading="lazy"
                  />
                  <span>{r.title}</span>
                  <small>{r.author}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="neighbor-replies">
            <div className="rail-heading">오가는 이야기</div>
            {recentComments.map((r) => (
              <button key={r.id} onClick={() => onOpen(r)}>
                <strong>{r.comments![0].author}</strong>
                <p>{r.comments![0].text}</p>
                <small>↳ {r.title}</small>
              </button>
            ))}
          </section>
          <div className="community-guidelines">
            <strong>함께 쓰는 주민마당</strong>
            <p>
              거래가 끝나면 완료 표시를,
              <br />
              도움받은 글에는 짧은 인사를.
              <br />
              이웃의 개인 정보는 소중하게.
            </p>
            <span>은하아파트 주민 자치회</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
