"use client";
import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Game from "./Game";
import CurtainGame from "./curtain/CurtainGame";
import { apiGameClient, type GameClient } from "../lib/game-client";
import { LOCAL_SAVE_KEY } from "../lib/local-game-client";
import {
  CURTAIN_SAVE_KEY,
  chapterDone,
  loadCurtain,
  type Chapter,
} from "../lib/curtain-game";

const libraryTitle = "추리 게임 모음 · 삭제된 게시판 / 마지막 커튼콜";
type Route = "library" | "board" | "curtain";
export function collectionRoute(hash: string): Route {
  if (hash === "#curtain-call") return "curtain";
  // #main is the original game's keyboard skip link, including old bookmarks.
  if (hash === "#deleted-board" || hash === "#main") return "board";
  return "library";
}

const subscribe = (changed: () => void) => {
  window.addEventListener("hashchange", changed);
  return () => window.removeEventListener("hashchange", changed);
};
const snapshot = () => collectionRoute(window.location.hash);
type GameStatus = {
  kind: "loading" | "new" | "playing" | "complete" | "error";
  text: string;
  done: number;
  action: string;
};
const loading: GameStatus = {
  kind: "loading",
  text: "저장된 진행 확인 중…",
  done: 0,
  action: "게임 열기",
};
const unavailable: GameStatus = {
  kind: "error",
  text: "저장 확인 필요 · 게임에서 다시 확인할 수 있습니다",
  done: 0,
  action: "게임 열기",
};
const games = [
  {
    id: "board",
    hash: "#deleted-board",
    number: "01",
    title: "삭제된 게시판",
    subtitle: "은하아파트 기록 추리",
    genre: "기록을 연결하는 추리",
    description: "이사 갔다던 이웃. 지워진 게시판에는 다른 이야기가 남아 있다.",
    image: "story/01.webp",
    imageAlt: "비 내리는 아파트 창가, 게시판을 열어 둔 노트북과 기록자의 책상",
    tags: ["키워드 검색", "기록 대조", "증거 수집"],
    count: 8,
    unit: "사건",
  },
  {
    id: "curtain",
    hash: "#curtain-call",
    number: "02",
    title: "마지막 커튼콜",
    subtitle: "해온극장 공간 추리",
    genre: "장면을 재현하는 추리",
    description:
      "모두가 보았다고 믿는 마지막 인사. 무대의 빛과 흔적을 다시 맞춰 본다.",
    image: "curtain/stage.png",
    imageAlt: "붉은 커튼과 따뜻한 조명 아래 남겨진 해온극장의 빈 무대",
    tags: ["조명 조작", "파형 비교", "파편 맞추기"],
    count: 5,
    unit: "장",
  },
] as const;

function GameLibrary({ client }: { client: GameClient }) {
  const [statuses, setStatuses] = useState({
    board: loading,
    curtain: loading,
  });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    let active = true;
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      void Promise.allSettled([
        Promise.resolve().then(() => client.request()),
        Promise.resolve().then(() => loadCurtain(() => window.localStorage)),
      ]).then(([boardResult, curtainResult]) => {
        if (!active || request !== revision) return;
        let board = unavailable;
        let curtain = unavailable;
        if (boardResult.status === "fulfilled") {
          const p = boardResult.value.progress;
          board =
            p.solved.length === 8
              ? {
                  kind: "complete",
                  text: "8 / 8 사건 해결 · 이야기 완료",
                  done: 8,
                  action: "기록 다시 열기",
                }
              : p.started
                ? {
                    kind: "playing",
                    text: `${p.solved.length} / 8 사건 해결 · 사건 ${String(p.active).padStart(2, "0")} 조사 중`,
                    done: p.solved.length,
                    action: "이어하기",
                  }
                : {
                    kind: "new",
                    text: "아직 열지 않은 이야기",
                    done: 0,
                    action: "시작하기",
                  };
        }
        if (
          curtainResult.status === "fulfilled" &&
          !curtainResult.value.blocked
        ) {
          const s = curtainResult.value.state;
          const done = [1, 2, 3, 4, 5].filter((c) =>
            chapterDone(s, c as Chapter),
          ).length;
          curtain = s.solved
            ? {
                kind: "complete",
                text: "5 / 5장 조사 완료 · 결말 다시 보기 가능",
                done: 5,
                action: "극장 다시 열기",
              }
            : s.started || s.intro > 0
              ? {
                  kind: "playing",
                  text: s.started
                    ? `${done} / 5장 조사 완료 · ${s.chapter}장 진행 중`
                    : "프롤로그 진행 중",
                  done,
                  action: "이어하기",
                }
              : {
                  kind: "new",
                  text: "아직 열지 않은 이야기",
                  done: 0,
                  action: "시작하기",
                };
        }
        setStatuses({ board, curtain });
      });
    };
    const storage = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === LOCAL_SAVE_KEY ||
        event.key === CURTAIN_SAVE_KEY
      )
        refresh();
    };
    refresh();
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", refresh);
    };
  }, [client]);
  return (
    <main className="game-library" aria-labelledby="game-library-title">
      <header className="library-header">
        <a href="#" aria-label="추리 게임 모음 메인">
          <span aria-hidden="true">▤</span> 기록 속으로
        </a>
        <span>두 개의 이야기, 서로 다른 추리.</span>
      </header>
      <section className="library-intro">
        <p className="library-eyebrow">CHOOSE YOUR STORY</p>
        <h1 id="game-library-title" tabIndex={-1} ref={heading}>
          어떤 사건부터
          <br className="library-mobile-break" /> 열어 볼까요?
        </h1>
        <p>
          기록을 따라가거나, 장면을 직접 바꾸거나.
          <br />
          마음이 가는 이야기에서 조사를 시작하세요.
        </p>
      </section>
      <nav className="library-games" aria-label="플레이할 게임 선택">
        {games.map((game) => {
          const status = statuses[game.id];
          return (
            <a
              key={game.id}
              className={`library-card library-${game.id}`}
              href={game.hash}
              aria-labelledby={`${game.id}-title`}
              aria-describedby={`${game.id}-description ${game.id}-status`}
            >
              <div className="library-cover">
                <img
                  src={game.image}
                  alt={game.imageAlt}
                  width="1536"
                  height="1024"
                  draggable={false}
                />
                <div className="library-cover-top">
                  <span>GAME {game.number}</span>
                  <span>
                    {game.count}
                    {game.unit === "사건" ? "개 사건" : "개 장"}
                  </span>
                </div>
                <span className="library-genre">{game.genre}</span>
              </div>
              <div className="library-card-body">
                <p className="library-subtitle">{game.subtitle}</p>
                <h2 id={`${game.id}-title`}>{game.title}</h2>
                <p
                  className="library-description"
                  id={`${game.id}-description`}
                >
                  {game.description}
                </p>
                <ul className="library-tags" aria-label="플레이 방식">
                  {game.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
                <div className="library-card-bottom">
                  <div className={`library-status ${status.kind}`}>
                    <span id={`${game.id}-status`} role="status">
                      {status.text}
                    </span>
                    <div className="library-progress" aria-hidden="true">
                      {Array.from({ length: game.count }, (_, index) => (
                        <i
                          key={index}
                          className={index < status.done ? "done" : ""}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="library-play">
                    {status.action}
                    <span aria-hidden="true">↗</span>
                  </span>
                </div>
              </div>
            </a>
          );
        })}
      </nav>
      <footer className="library-footer">
        <span>
          <i aria-hidden="true" />
          {client.storage === "browser"
            ? "로그인 없이 플레이 · 이 브라우저에 자동 저장"
            : "게임별 진행 자동 저장"}
        </span>
        <p>다른 이야기를 선택해도 각 게임의 진행은 이어집니다.</p>
      </footer>
    </main>
  );
}

export default function GameCollection({
  client = apiGameClient,
}: {
  client?: GameClient;
}) {
  const route = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "library" as const,
  );
  useEffect(() => {
    document.title =
      route === "board"
        ? "삭제된 게시판 · 은하아파트 기록 추리"
        : route === "curtain"
          ? "마지막 커튼콜 · 해온극장 공간 추리"
          : libraryTitle;
  }, [route]);
  return route === "curtain" ? (
    <CurtainGame />
  ) : route === "board" ? (
    <Game client={client} />
  ) : (
    <GameLibrary client={client} />
  );
}
