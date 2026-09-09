"use client";
import React, {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Dialog } from "../components";
import SoundControls from "../SoundControls";
import { SoundContext, useGameSound } from "../sound-context";
import { DEFAULT_SOUND_SETTINGS } from "../../lib/sound";
import {
  chapters,
  chapterDone,
  chapterNeeds,
  canOpenChapter,
  canRoute,
  shadowFits,
  audioFits,
  routeFits,
  fragmentFits,
  sketchFits,
  curtainReducer,
  initialCurtainState,
  loadCurtain,
  saveCurtain,
  findings,
  people,
  routeNodes,
  type CurtainState,
  type CurtainAction,
  type Chapter,
  type Placement,
  type Finding,
} from "../../lib/curtain-game";
import { waveform } from "../../lib/curtain-audio";

type Send = (action: CurtainAction) => void;
type PuzzleProps = {
  state: CurtainState;
  send: Send;
  check: (puzzle: Extract<CurtainAction, { type: "check" }>["puzzle"]) => void;
};
const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));
const norm = (n: number) => (n + 360) % 360;
const asset = (name: string) => `curtain/${name}`;

function Prop({
  cell,
  className = "",
  style,
  label,
}: {
  cell: number;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}) {
  const crop =
    cell === 3
      ? "circle(41% at 51% 44%)"
      : cell === 4
        ? "ellipse(46% 35% at 51% 44%)"
        : cell === 5
          ? "inset(7% 10% 17% 12% round 2%)"
          : undefined;
  return (
    <div
      className={`cc-prop ${cell < 3 ? "cc-prop-figure" : ""} ${className}`}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={!label || undefined}
    >
      <span
        className="cc-prop-image"
        style={{
          backgroundImage: `url(${asset("props.png")})`,
          backgroundPosition: `${(cell % 3) * 50}% ${cell < 3 ? 0 : 100}%`,
          clipPath: crop,
        }}
      />
    </div>
  );
}

function Range({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="cc-range">
      <label htmlFor={id}>
        {label}
        <output>
          {value}
          {unit}
        </output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// Pointer movement and keyboard movement share the same bounded coordinate model.
function Movable({
  value,
  onChange,
  label,
  children,
  className = "",
}: {
  value: Placement;
  onChange: (value: Placement) => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    origin: Placement;
    width: number;
    height: number;
  } | null>(null);
  return (
    <button
      type="button"
      className={`cc-movable ${className}`}
      aria-label={label}
      aria-roledescription="방향키로 이동 가능한 조각"
      style={{
        left: `${value.x}%`,
        top: `${value.y}%`,
        transform: `translate(-50%, -50%) rotate(${value.angle}deg)`,
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const box = e.currentTarget.parentElement!.getBoundingClientRect();
        if (!box.width || !box.height) return;
        drag.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          origin: value,
          width: box.width,
          height: box.height,
        };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        onChange({
          ...d.origin,
          x: clamp(d.origin.x + ((e.clientX - d.x) / d.width) * 100, 10, 90),
          y: clamp(d.origin.y + ((e.clientY - d.y) / d.height) * 100, 10, 90),
        });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        const delta = e.shiftKey ? 8 : 2;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-delta, 0],
          ArrowRight: [delta, 0],
          ArrowUp: [0, -delta],
          ArrowDown: [0, delta],
        };
        const move = moves[e.key];
        if (move) {
          e.preventDefault();
          onChange({
            ...value,
            x: clamp(value.x + move[0], 10, 90),
            y: clamp(value.y + move[1], 10, 90),
          });
        }
      }}
    >
      {children}
      <span className="cc-move-grip" aria-hidden="true">
        ✥
      </span>
    </button>
  );
}

function PositionControls({
  value,
  onChange,
  rotation = 45,
  label,
}: {
  value: Placement;
  onChange: (value: Placement) => void;
  rotation?: number;
  label: string;
}) {
  const move = (x: number, y: number) =>
    onChange({
      ...value,
      x: clamp(value.x + x, 10, 90),
      y: clamp(value.y + y, 10, 90),
    });
  return (
    <div className="cc-position-controls">
      <div role="group" aria-label={`${label} 이동`}>
        <button aria-label={`${label} 왼쪽 이동`} onClick={() => move(-2, 0)}>
          ←
        </button>
        <button aria-label={`${label} 위로 이동`} onClick={() => move(0, -2)}>
          ↑
        </button>
        <button aria-label={`${label} 아래로 이동`} onClick={() => move(0, 2)}>
          ↓
        </button>
        <button aria-label={`${label} 오른쪽 이동`} onClick={() => move(2, 0)}>
          →
        </button>
      </div>
      <div role="group" aria-label={`${label} 회전`}>
        <button
          onClick={() =>
            onChange({ ...value, angle: norm(value.angle - rotation) })
          }
          aria-label={`${label} 왼쪽 회전`}
        >
          ↶ {rotation}°
        </button>
        <button
          onClick={() =>
            onChange({ ...value, angle: norm(value.angle + rotation) })
          }
          aria-label={`${label} 오른쪽 회전`}
        >
          {rotation}° ↷
        </button>
      </div>
      <span className="cc-fine">드래그 / 방향키 · Shift로 크게 이동</span>
    </div>
  );
}

function Layout({
  backstage = false,
  caption,
  children,
  tools,
  className = "",
}: {
  backstage?: boolean;
  caption: string;
  children: React.ReactNode;
  tools: React.ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <main className={`cc-layout ${className}`}>
      <section className="cc-workspace" aria-label="직접 조사 화면">
        <div
          className={`cc-scene ${backstage ? "cc-backstage" : ""} ${expanded ? "cc-expanded" : ""}`}
        >
          <img
            className="cc-scenery"
            src={asset(backstage ? "backstage.png" : "stage.png")}
            alt={
              backstage
                ? "해온극장의 낡은 분장대와 의상 창고"
                : "붉은 커튼과 얇은 막이 있는 해온극장 무대"
            }
            draggable={false}
          />
          {children}
        </div>
        <div className="cc-caption">
          <span aria-hidden="true">⌖</span>
          <span>{caption}</span>
          <button
            onClick={() => setExpanded(!expanded)}
            aria-pressed={expanded}
          >
            {expanded ? "기본 크기" : "크게 보기"}
          </button>
        </div>
      </section>
      <aside className="cc-console">{tools}</aside>
    </main>
  );
}

function Done({ children }: { children: React.ReactNode }) {
  return (
    <div className="cc-done">
      <span aria-hidden="true">✓</span>
      {children}
    </div>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="cc-eyebrow">{children}</p>;
}

const seatInfo = {
  front: {
    name: "F-07 · 내 카메라",
    point: [50, 88],
    quote: "“인사를 분명히 찍었어요.”",
    seen: "막 너머 윤곽. 얼굴의 눈·코는 구별되지 않는다.",
    short: "정면 · 얇은 막",
    path: "M50 88 L40 40 L60 40 Z",
  },
  left: {
    name: "A-02 · 왼쪽 관객",
    point: [14, 79],
    quote: "“늘 입던 외투였는데요.”",
    seen: "왼쪽 세트가 머리를 가린다. 보이는 것은 외투 아래쪽뿐이다.",
    short: "왼쪽 · 세트에 가림",
    path: "M14 79 L37 47 L49 58 Z",
  },
  booth: {
    name: "조정실 · 이도윤",
    point: [86, 91],
    quote: "“조명이 들어와서, 준비된 줄 알았죠.”",
    seen: "먼 거리에서 막에 비친 형태만 보인다. 큐 실행은 생존 확인이 아니다.",
    short: "조정실 · 먼 거리",
    path: "M86 91 L42 40 L59 40 Z",
  },
} as const;

function SeatsPuzzle({ state, send }: PuzzleProps) {
  const info = seatInfo[state.seat];
  return (
    <Layout
      caption="정면 원본은 그대로 두고, 아래 도해에서 각 목격자의 시야를 대조합니다."
      tools={
        <>
          <Eyebrow>01 / 객석의 기억</Eyebrow>
          <h2>
            같은 인사,
            <br />
            서로 다른 시야.
          </h2>
          <p>{info.quote}</p>
          <div className="cc-seat-options">
            {Object.entries(seatInfo).map(([id, seat]) => (
              <button
                key={id}
                aria-pressed={state.seat === id}
                onClick={() =>
                  send({
                    type: "patch",
                    value: { seat: id as CurtainState["seat"], zoom: 1 },
                  })
                }
              >
                <span>{seat.name}</span>
                <b>
                  {state.observed.includes(id as CurtainState["seat"])
                    ? "✓"
                    : "↗"}
                </b>
              </button>
            ))}
          </div>
          <Range
            label="시야 확대"
            value={state.zoom}
            min={1}
            max={2.6}
            step={0.1}
            unit="×"
            onChange={(zoom) => send({ type: "patch", value: { zoom } })}
          />
          <p className="cc-fine">
            확대해서 얼굴을 구별할 수 있는지 살펴보세요. 1.6배부터 관찰을 기록할
            수 있습니다.
          </p>
          <button
            className="cc-primary"
            disabled={state.zoom < 1.6 || state.observed.includes(state.seat)}
            onClick={() => send({ type: "observe" })}
          >
            {state.observed.includes(state.seat)
              ? "기록한 시점"
              : "이 시야 기록하기"}
          </button>
          {state.observed.includes(state.seat) && <Done>{info.seen}</Done>}
          <p className="cc-progress-copy">
            시점 {state.observed.length} / 3 확인
          </p>
        </>
      }
    >
      <div className="cc-film-label">
        <span className="cc-record-dot" /> ORIGINAL · 21:10:06
      </div>
      <div className="cc-original-figure">
        <Prop cell={0} className="cc-shadow-prop" />
      </div>
      <div className="cc-viewfinder" aria-label={`${info.short} 확대 도해`}>
        <span>{info.short}</span>
        <div className={`cc-scope cc-scope-${state.seat}`}>
          <Prop
            cell={0}
            className="cc-shadow-prop"
            style={{
              transform: `scale(${state.zoom * (state.seat === "booth" ? 0.48 : 0.8)})`,
            }}
          />
          {state.seat === "left" && (
            <div className="cc-obstruction">세트에 가린 범위</div>
          )}
        </div>
        <small>{state.zoom.toFixed(1)}× · 시야 재현</small>
      </div>
      <div className="cc-sight-map">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="정면 카메라, 왼쪽 관객, 뒤쪽 조정실의 시선과 세트 위치"
        >
          <rect
            x="28"
            y="24"
            width="45"
            height="37"
            rx="3"
            className="cc-map-stage"
          />
          <path d={info.path} className="cc-sight-cone" />
          <path d="M27 40 L43 48" className="cc-map-wall" />
          <path d="M39 39 H66" className="cc-map-scrim" />
          <circle cx="52" cy="42" r="3" className="cc-chair-dot" />
          {Object.entries(seatInfo).map(([key, s]) => (
            <circle
              key={key}
              cx={s.point[0]}
              cy={s.point[1]}
              r="4"
              className={state.seat === key ? "cc-dot active" : "cc-dot"}
            />
          ))}
          <text x="48" y="22">
            무대
          </text>
          <text x="43" y="71">
            객석
          </text>
        </svg>
        <span>위에서 본 시야 도해</span>
      </div>
    </Layout>
  );
}

function ShadowPuzzle({ state, send, check }: PuzzleProps) {
  const lit = state.light === "work" && !state.scrim;
  return (
    <Layout
      caption="수사팀이 확보한 공간과 소품의 재현입니다. 원본 촬영물은 바뀌지 않습니다."
      tools={
        <>
          <Eyebrow>02 / 빛의 재현</Eyebrow>
          <h2>
            막 뒤를
            <br />
            밝혀 보세요.
          </h2>
          <p>
            의자와 외투가 남아 있었습니다. 먼저 막을 걷고 작업등을 켜서 안쪽을
            봅니다.
          </p>
          <div className="cc-switches">
            <button
              aria-pressed={!state.scrim}
              onClick={() =>
                send({ type: "patch", value: { scrim: !state.scrim } })
              }
            >
              {state.scrim ? "막 걷기" : "막 다시 내리기"}
            </button>
            <button
              aria-pressed={state.light === "work"}
              onClick={() =>
                send({
                  type: "patch",
                  value: { light: state.light === "back" ? "work" : "back" },
                })
              }
            >
              {state.light === "back" ? "작업등 켜기" : "공연 역광 켜기"}
            </button>
          </div>
          {state.sawWood && (
            <Done>
              외투 사이로 나무 관절이 보입니다. 원본의 그림자 자리에 놓아
              보세요.
            </Done>
          )}
          <Range
            label="의자 위치"
            value={state.chair}
            min={10}
            max={90}
            onChange={(chair) => send({ type: "patch", value: { chair } })}
          />
          <p className="cc-fine">
            점선이 원본에 남은 윤곽입니다. 의자를 맞춘 뒤 막과 조명을 공연
            상태로 돌려 비교하세요.
          </p>
          <button className="cc-primary" onClick={() => check("shadow")}>
            원본에 겹쳐 보기
          </button>
          {state.findings.includes("shadow") && (
            <Done>
              윤곽이 겹칩니다. 그림자만으로 사람을 확인할 수 없었습니다.
            </Done>
          )}
        </>
      }
    >
      <div className="cc-film-label">
        RECONSTRUCTION · {lit ? "작업등 / 측면 확인" : "공연 역광"}
      </div>
      <div className={`cc-light-wash ${lit ? "work" : "back"}`} />
      <div className="cc-target-chair" style={{ left: "52%" }}>
        <Prop cell={0} className="cc-shadow-prop" />
        <span>원본 윤곽</span>
      </div>
      <div
        className={`cc-working-chair ${lit ? "exposed" : ""}`}
        style={{ left: `${state.chair}%` }}
      >
        <Prop
          cell={lit ? 1 : 0}
          className={lit ? "cc-lit-prop" : "cc-shadow-prop"}
          label={
            lit
              ? "외투 안으로 나무 관절이 드러난 의상용 마네킹"
              : "외투를 입고 의자에 앉은 형태의 그림자"
          }
        />
      </div>
      {state.scrim && <div className="cc-scrim-effect" />}
      <div className="cc-stage-settings">
        <span>{state.scrim ? "막 내림" : "막 걷음"}</span>
        <span>{state.light === "back" ? "역광" : "작업등"}</span>
      </div>
    </Layout>
  );
}

function Wave({
  bars,
  offset = 0,
  className = "",
}: {
  bars: number[];
  offset?: number;
  className?: string;
}) {
  return (
    <g
      className={className}
      transform={`translate(${(offset / 6000) * 600} 0)`}
    >
      {bars.map((v, i) => (
        <line
          key={i}
          x1={(i * 600) / bars.length}
          x2={(i * 600) / bars.length}
          y1={54 - v * 66}
          y2={54 + v * 66}
        />
      ))}
    </g>
  );
}

function AudioPuzzle({ state, send, check }: PuzzleProps) {
  const original = useMemo(() => waveform("recording"), []);
  const take = useMemo(() => waveform(state.take), [state.take]);
  const [error, setError] = useState("");
  return (
    <Layout
      backstage
      caption="인사 직전의 마이크 두드림과 긁힘. 실제 음원과 파형은 같은 녹음 데이터를 사용합니다."
      tools={
        <>
          <Eyebrow>02 / 소리의 재현</Eyebrow>
          <h2>
            우연히 같을 수<br />
            없는 작은 소리.
          </h2>
          <p>
            공연과 낮 녹음의 시작점은 다릅니다. 비슷한 파형을 골라 가로로 밀어
            보세요.
          </p>
          <div className="cc-choice-row" role="group" aria-label="녹음 테이크">
            {(["a", "b", "c"] as const).map((id, n) => (
              <button
                key={id}
                aria-pressed={state.take === id}
                onClick={() => send({ type: "patch", value: { take: id } })}
              >
                테이크 0{n + 1}
              </button>
            ))}
          </div>
          <Range
            label="녹음 시작점 이동"
            value={state.offset}
            min={0}
            max={2000}
            step={50}
            unit=" ms"
            onChange={(offset) => send({ type: "patch", value: { offset } })}
          />
          <div className="cc-choice-row">
            <button
              onClick={() =>
                send({
                  type: "patch",
                  value: { offset: clamp(state.offset - 50, 0, 2000) },
                })
              }
            >
              ← 50 ms
            </button>
            <button
              onClick={() =>
                send({
                  type: "patch",
                  value: { offset: clamp(state.offset + 50, 0, 2000) },
                })
              }
            >
              50 ms →
            </button>
          </div>
          <button className="cc-primary" onClick={() => check("audio")}>
            두 트랙 대조하기
          </button>
          {state.findings.includes("audio") && (
            <Done>
              짧은 긁힘까지 같습니다. 원래 예정된 사전 녹음이 그대로
              재생됐습니다.
            </Done>
          )}
          <p className="cc-fine">
            소리를 듣지 않아도 색이 다른 두 파형의 모양과 간격으로 풀 수
            있습니다.
          </p>
        </>
      }
    >
      <div className="cc-audio-desk">
        <div className="cc-machine-header">
          <span>HAEON / SOUND DESK</span>
          <b>인사 직전 구간</b>
        </div>
        <div className="cc-track-title">
          <span className="cc-gold-key" />내 공연 영상
          <audio
            aria-label="공연 영상 소리"
            controls
            preload="none"
            src={asset("recording.wav")}
            onError={() =>
              setError(
                "음원을 재생할 수 없습니다. 파형 비교는 그대로 사용할 수 있습니다.",
              )
            }
          />
        </div>
        <svg
          className="cc-wave"
          viewBox="0 0 600 108"
          role="img"
          aria-label="공연 소리 파형"
        >
          <path d="M0 54 H600" className="cc-wave-axis" />
          <Wave bars={original} className="cc-wave-original" />
        </svg>
        <div className="cc-track-title">
          <span className="cc-blue-key" />
          테이크 {state.take.toUpperCase()}
          <audio
            key={state.take}
            aria-label="선택한 녹음 소리"
            controls
            preload="none"
            src={asset(`${state.take}.wav`)}
            onError={() =>
              setError(
                "음원을 재생할 수 없습니다. 파형 비교는 그대로 사용할 수 있습니다.",
              )
            }
          />
        </div>
        <svg
          className="cc-wave"
          viewBox="0 0 600 108"
          role="img"
          aria-label="선택한 녹음을 공연 소리에 포갠 파형"
        >
          <path d="M0 54 H600" className="cc-wave-axis" />
          <Wave bars={original} className="cc-wave-ghost" />
          <Wave bars={take} offset={state.offset} className="cc-wave-take" />
        </svg>
        <div className="cc-wave-ruler">
          {[0, 1, 2, 3, 4, 5, 6].map((t) => (
            <span key={t}>{t}s</span>
          ))}
        </div>
        <p>금색 = 공연 · 청록색 = 낮 녹음</p>
        {error && <p role="alert">{error}</p>}
      </div>
    </Layout>
  );
}

function FloorPlan({
  state,
  send,
  playback = false,
}: {
  state: CurtainState;
  send?: Send;
  playback?: boolean;
}) {
  const points = state.route
    .map((id) => routeNodes.find((n) => n.id === id)!)
    .map((n) => `${n.x},${n.y}`)
    .join(" ");
  return (
    <div className="cc-floor-host">
      <div className="cc-floor-plan">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="분장실, 뒤 통로, 의자, 날개막과 객석 시야를 표시한 배치도"
        >
          <rect
            x="4"
            y="8"
            width="21"
            height="31"
            rx="2"
            className="cc-map-room"
          />
          <path
            d="M25 12 H94 V53 H70 V88 H29 V49 H4"
            className="cc-plan-outline"
          />
          <path d="M25 23 H34 L54 43 H84" className="cc-hidden-corridor" />
          <path d="M30 98 L34 56 H78 L87 98" className="cc-audience-cone" />
          <path
            d={`M${28 + state.panel * 0.27} 35 L${42 + state.panel * 0.27} 35`}
            className="cc-moving-set"
          />
          <text x={28 + state.panel * 0.27} y="32">
            이동식 세트
          </text>
          <text x="36" y="17">
            기존 뒤 통로
          </text>
          <text x="41" y="98">
            객석 시야
          </text>
          <polyline points={points} className="cc-route-line" />
          {state.route.map((id, i) => {
            const node = routeNodes.find((n) => n.id === id)!;
            return (
              <circle
                key={`${id}-${i}`}
                cx={node.x}
                cy={node.y}
                r="2"
                className="cc-route-dot"
              />
            );
          })}
        </svg>
        {routeNodes.map((node) => (
          <button
            key={node.id}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            className={`cc-map-node ${state.route.includes(node.id) ? "visited" : ""}`}
            aria-label={`동선: ${node.label}`}
            disabled={
              !send ||
              (!canRoute(state, node.id) && state.route.at(-1) !== node.id)
            }
            onClick={() => send?.({ type: "route", node: node.id })}
          >
            <i aria-hidden="true">{node.id === "chair" ? "▤" : "•"}</i>
            <span>{node.label}</span>
          </button>
        ))}
        {playback && (
          <span
            className="cc-route-person"
            style={{
              left: `${routeNodes.find((n) => n.id === state.route.at(-1))!.x}%`,
              top: `${routeNodes.find((n) => n.id === state.route.at(-1))!.y}%`,
            }}
          >
            서
          </span>
        )}
      </div>
    </div>
  );
}

function RoutePuzzle({ state, send, check }: PuzzleProps) {
  return (
    <Layout
      backstage
      caption="실측한 극장 배치도. 금색 통로는 기존 구조이며, 넓은 부채꼴은 관객에게 보이는 범위입니다."
      tools={
        <>
          <Eyebrow>03 / 동선 재현</Eyebrow>
          <h2>
            사라진 사람이
            <br />
            걸어간 쪽.
          </h2>
          <p>
            분장실에서 의자를 거쳐 오른쪽 날개막으로 가야 합니다. 객석에
            드러나지 않는 길을 연결하세요.
          </p>
          <div className="cc-choice-row">
            <button
              onClick={() => send({ type: "patch", value: { panel: 20 } })}
            >
              리허설 배치
            </button>
            <button
              onClick={() => send({ type: "patch", value: { panel: 78 } })}
            >
              인사 직전 배치
            </button>
          </div>
          <Range
            label="이동식 세트 위치"
            value={state.panel}
            onChange={(panel) => send({ type: "patch", value: { panel } })}
          />
          <p className="cc-fine">
            {state.panel < 78
              ? "세트가 뒤 통로 출구를 막고 있습니다. 두 촬영 시점의 배치를 비교해 보세요."
              : "뒤 통로 출구가 열렸습니다. 점을 순서대로 눌러 이동하세요."}
          </p>
          <button onClick={() => send({ type: "reset-route" })}>
            동선 지우기
          </button>
          <button className="cc-primary" onClick={() => check("route")}>
            이 동선 재현하기
          </button>
          {state.findings.includes("route") && (
            <Done>세트를 옮기면 객석에서 보이지 않는 길이 생깁니다.</Done>
          )}
          <p className="cc-fine">
            소품을 옮길 수 있다는 사실만으로 범인이 정해지지는 않습니다. 의상
            흔적과 실제 위치도 비교하세요.
          </p>
        </>
      }
    >
      <div className="cc-plan-board">
        <div className="cc-machine-header">
          <span>HAEON / FLOOR PLAN</span>
          <b>분장실 → 인사 준비 → 날개막</b>
        </div>
        <FloorPlan state={state} send={send} />
        <p>선으로 이어진 지점만 이동할 수 있습니다.</p>
      </div>
    </Layout>
  );
}

function ClaspPuzzle({ state, send, check }: PuzzleProps) {
  const owner = people.find((p) => p.id === state.clasp)!;
  const [photo, setPhoto] = useState<"before" | "after">("before");
  return (
    <Layout
      backstage
      caption="분장실에서 회수한 파편과 확보된 의상 장식의 확대 비교. 꽃잎 무늬와 절단면을 함께 맞춥니다."
      tools={
        <>
          <Eyebrow>03 / 물리적 접촉</Eyebrow>
          <h2>
            작은 조각이
            <br />
            떨어져 나온 자리.
          </h2>
          <p>
            장식을 고르고 파편을 돌려 끼워 보세요. 재질만 비슷한 것으로는
            부족합니다.
          </p>
          <div className="cc-owner-list">
            {people
              .filter((p) => p.cell >= 0)
              .map((p) => (
                <button
                  key={p.id}
                  aria-label={`${p.name} ${p.mark}`}
                  aria-pressed={state.clasp === p.id}
                  onClick={() =>
                    send({ type: "patch", value: { clasp: p.id } })
                  }
                >
                  <Prop cell={p.cell} />
                  <span>
                    {p.name}
                    <small>{p.mark}</small>
                  </span>
                </button>
              ))}
          </div>
          <PositionControls
            value={state.fragment}
            label="파편"
            onChange={(fragment) =>
              send({ type: "patch", value: { fragment } })
            }
          />
          <button className="cc-primary" onClick={() => check("clasp")}>
            절단면 맞춰 보기
          </button>
          {state.claspFit && (
            <>
              <Done>
                무늬와 파손면이 이어집니다. 언제부터 깨져 있었는지도 확인해야
                합니다.
              </Done>
              <div className="cc-choice-row">
                {(["before", "after"] as const).map((time) => (
                  <button
                    key={time}
                    aria-pressed={
                      photo === time && state.costumes.includes(time)
                    }
                    onClick={() => {
                      setPhoto(time);
                      send({ type: "costume", value: time });
                    }}
                  >
                    {time === "before" ? "공연 전 착용" : "인사 직전 착용"}
                    {state.costumes.includes(time) ? " ✓" : ""}
                  </button>
                ))}
              </div>
              <p className="cc-fine">
                {photo === "before"
                  ? "20:58 단체 촬영: 서경의 작업 외투에 온전한 황동 장식. 의상은 이날 교환되지 않았다."
                  : "21:09 날개막 영상: 같은 외투의 오른쪽 꽃잎이 없다. 바로 뒤 발견된 분장실 파편과 맞는다."}
              </p>
            </>
          )}
        </>
      }
    >
      <div className="cc-comparison-desk">
        <div className="cc-machine-header">
          <span>CONTACT / MATCH</span>
          <b>{owner.name}의 의상</b>
        </div>
        <div className="cc-clasp-canvas">
          <Prop
            cell={owner.cell < 0 ? 3 : owner.cell}
            className="cc-clasp-base"
            style={{
              clipPath:
                "polygon(0 0, 52% 0, 48% 30%, 62% 42%, 55% 58%, 80% 66%, 100% 60%, 100% 100%, 0 100%)",
            }}
          />
          <Movable
            label="회수한 황동 파편"
            value={state.fragment}
            onChange={(fragment) =>
              send({ type: "patch", value: { fragment } })
            }
            className="cc-fragment"
          >
            <Prop
              cell={3}
              style={{
                clipPath:
                  "polygon(52% 0, 100% 0, 100% 60%, 80% 66%, 55% 58%, 62% 42%, 48% 30%)",
              }}
            />
          </Movable>
        </div>
        <div className="cc-desk-legend">
          <span>고정: 확보한 의상</span>
          <span>✥ 이동: 현장 파편</span>
        </div>
        {state.claspFit && (
          <div className="cc-costume-photo">
            <Prop
              cell={3}
              style={
                photo === "after"
                  ? {
                      clipPath:
                        "polygon(0 0, 52% 0, 48% 30%, 62% 42%, 55% 58%, 80% 66%, 100% 60%, 100% 100%, 0 100%)",
                    }
                  : {}
              }
            />
            <div>
              <span>착용 장식 확대도</span>
              <b>{photo === "before" ? "20:58 · 온전함" : "21:09 · 파손"}</b>
              <span>정서경 · 같은 작업 외투</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

const clips = [
  {
    stamp: "20:58–21:01",
    label: "인사 준비 전",
    position: "wing",
    note: "서경이 날개막에 서 있다. 외투의 장식은 온전하다.",
  },
  {
    stamp: "21:02–21:08",
    label: "연속 구간 확인",
    position: "",
    note: "날개막은 계속 비어 있다. 영상은 끊기지 않고 이어진다.",
  },
  {
    stamp: "21:09",
    label: "뒤 통로에서 복귀",
    position: "rear",
    note: "서경이 세트 뒤에서 들어온다. 외투 장식의 꽃잎이 떨어져 있다.",
  },
] as const;

function PositionPuzzle({ state, send }: PuzzleProps) {
  const clip = clips[state.frame];
  return (
    <Layout
      caption="무대 고정 영상의 인물 위치를 도해로 옮겼습니다. 가려진 통로 안의 행동은 영상에 없습니다."
      tools={
        <>
          <Eyebrow>03 / 위치 대조</Eyebrow>
          <h2>
            “계속 여기
            <br />
            있었어요.”
          </h2>
          <p>
            서경이 말한 자리를 연속 촬영 구간과 비교합니다. 타임라인을 움직여
            보세요.
          </p>
          <Range
            label="촬영 구간"
            value={state.frame}
            min={0}
            max={2}
            onChange={(value) => send({ type: "frame", value })}
          />
          <div className="cc-clip-buttons">
            {clips.map((c, index) => (
              <button
                key={c.stamp}
                aria-pressed={state.frame === index}
                onClick={() => send({ type: "frame", value: index })}
              >
                {c.stamp}
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          <p>{clip.note}</p>
          {state.findings.includes("position") && (
            <Done>
              비어 있던 구간과 복귀 방향이 서경의 설명과 맞지 않습니다.
            </Done>
          )}
          <details className="cc-details">
            <summary>다른 사람의 위치도 비교</summary>
            <p>
              같은 구간, 유리는 무대 전체 영상에, 도윤은 조정실 카메라에, 은주는
              수선대 카메라에 계속 남습니다. 한 프레임만으로 긴 시간의 위치를
              판단하지 않습니다.
            </p>
            <p>
              분장실의 다툼 소리는 21:04 무대용 주변 마이크에 남았습니다. 부상의
              정확한 시각과 법적 판단은 수사로 이어집니다.
            </p>
          </details>
        </>
      }
    >
      <div className="cc-film-label">
        <span className="cc-record-dot" /> FIXED CAMERA · {clip.stamp}
      </div>
      <div className="cc-position-overlay">
        <div className="cc-claimed-position">
          <span>서경이 말한 자리</span>
          {clip.position === "wing" ? <b>서경</b> : <i>비어 있음</i>}
        </div>
        {clip.position === "rear" && (
          <div className="cc-returning">
            <span>세트 뒤에서</span>
            <b>서경 →</b>
          </div>
        )}
        <div className="cc-position-stage">
          <span>유리 · 무대 위</span>
          <div className="cc-video-strip">
            <span>●</span>
            <span>●</span>
            <span>●</span>
            <span>●</span>
            <span>●</span>
          </div>
          <small>끊김 없는 연속 구간</small>
        </div>
      </div>
      <div className="cc-time-strip">
        {clips.map((c, index) => (
          <button
            key={c.stamp}
            className={state.frame === index ? "active" : ""}
            onClick={() => send({ type: "frame", value: index })}
          >
            {c.stamp}
          </button>
        ))}
      </div>
    </Layout>
  );
}

// Functional set drawings, deliberately shared by both documents. Matching
// geometry is deterministic; independently generated pictures cannot leak clues.
function SetDrawing({ original = false }: { original?: boolean }) {
  return (
    <svg
      viewBox="0 0 240 200"
      role="img"
      aria-label={
        original
          ? "옛 초고의 세 칸 창문과 계단이 있는 무대 배치"
          : "현재 공연의 세 칸 창문과 계단이 있는 무대 배치"
      }
      className={original ? "cc-sketch-old" : "cc-sketch-new"}
    >
      <path d="M20 168 H225 M28 168 V35 H103 V168 M28 35 Q65 -1 103 35 M53 24 V168 M78 23 V168 M28 77 H103 M28 121 H103 M122 168 V147 H143 V125 H164 V103 H188 V168 M194 164 V116 H222 V164 M190 136 H228" />
      <circle cx="119" cy="183" r="5" />
      <path d="M7 10 H15 M11 6 V14 M218 183 H226 M222 179 V187" />
    </svg>
  );
}

function ArchivePuzzle({ state, send, check }: PuzzleProps) {
  const revealed = state.peel >= 85;
  return (
    <Layout
      backstage
      caption="백은주가 보관해 온 초고와 공연 자료. 같은 창문과 계단 배치를 겹쳐 출처를 확인합니다."
      tools={
        <>
          <Eyebrow>04 / 남겨진 작품</Eyebrow>
          <h2>
            무대는 같은데,
            <br />
            이름이 다르다.
          </h2>
          {!state.sketchFit ? (
            <>
              <p>
                낡은 무대 그림을 현재 도면 위에 포개세요. 창문과 계단이 동시에
                맞아야 합니다.
              </p>
              <PositionControls
                label="옛 도면"
                rotation={15}
                value={state.sketch}
                onChange={(sketch) =>
                  send({ type: "patch", value: { sketch } })
                }
              />
              <button className="cc-primary" onClick={() => check("sketch")}>
                두 무대 대조하기
              </button>
            </>
          ) : (
            <>
              <Done>
                창문과 계단이 정확히 겹칩니다. 그림의 보관 표식을 의상 서랍에서
                찾아보세요.
              </Done>
              <div
                className="cc-drawer-choices"
                role="group"
                aria-label="의상 서랍"
              >
                {[
                  { id: "stairs", icon: "▟", name: "계단" },
                  { id: "window", icon: "▥", name: "세 칸 창문" },
                  { id: "chair", icon: "▤", name: "의자" },
                ].map((d) => (
                  <button
                    key={d.id}
                    aria-pressed={state.drawer === d.id}
                    onClick={() =>
                      send({ type: "patch", value: { drawer: d.id } })
                    }
                  >
                    <b>{d.icon}</b>
                    {d.name} 서랍
                  </button>
                ))}
              </div>
              {state.drawer && state.drawer !== "window" && (
                <p className="cc-fine">
                  {state.drawer === "stairs"
                    ? "계단 서랍: 지난 공연의 바닥 미끄럼 방지 테이프와 여분 못. 초고 묶음은 없다."
                    : "의자 서랍: 의자 다리에 붙일 펠트와 수선 영수증. 초고 묶음은 없다."}
                </p>
              )}
              {state.drawer === "window" && (
                <>
                  <p>
                    봉투의 이름 위에 새 표지가 덧붙어 있습니다. 가장자리부터
                    들어 올려 보세요.
                  </p>
                  <Range
                    label="덧붙인 표지 들어 올리기"
                    value={state.peel}
                    onChange={(value) => send({ type: "peel", value })}
                  />
                </>
              )}
            </>
          )}
          {state.findings.includes("author") && (
            <blockquote className="cc-voice">
              <b>백은주</b>“다은이가 여기서 밤마다 썼어. 서경이가 종이를 사다
              줬지. 오늘은 언니가 그 이름을 꼭 돌려놓겠다고 했는데…”
              <small>
                원본 봉투·초고와 당시 집필 목격이 함께 확인되었습니다.
              </small>
            </blockquote>
          )}
        </>
      }
    >
      <div
        className={`cc-archive-table ${state.sketchFit && state.drawer === "window" ? "opened" : ""}`}
      >
        {state.sketchFit && state.drawer === "window" ? (
          <div className="cc-paper-pair">
            <article className="cc-paper cc-original-script">
              <span>해온극장 / 보관 원본</span>
              <h3>창문을 남겨 두세요</h3>
              <SetDrawing original />
              <p className="cc-manuscript-line">
                “나갈 때 불은 끄되,
                <br />
                창문 하나는 남겨 두세요.”
              </p>
              <div className="cc-author-reveal">
                <b>정다은 作</b>
                <div
                  className="cc-cover-label"
                  style={{ clipPath: `inset(0 ${state.peel}% 0 0)` }}
                >
                  한정우 작품집
                </div>
              </div>
              <small>
                {revealed
                  ? "1998년 초고 · 정다은의 원본 봉투와 함께 보관"
                  : "표지를 들어 올리면 아래 이름이 보입니다."}
              </small>
            </article>
            <article className="cc-paper cc-current-program">
              <span>해온극장 폐관 공연</span>
              <h3>
                창문을
                <br />
                남겨 두세요
              </h3>
              <div className="cc-program-mark">창 / 1998—2026</div>
              <p>작·연출 한정우</p>
              <small>폐관 기록용 최종 프로그램</small>
            </article>
          </div>
        ) : (
          <div className="cc-sketch-board">
            <div className="cc-machine-header">
              <span>1998 / 2026</span>
              <b>무대 그림 대조</b>
            </div>
            <div className="cc-sketch-canvas">
              <div className="cc-sketch-fixed">
                <SetDrawing />
              </div>
              <Movable
                label="옛 도면 조각"
                value={state.sketch}
                onChange={(sketch) =>
                  send({ type: "patch", value: { sketch } })
                }
                className="cc-sketch-piece"
              >
                <SetDrawing original />
              </Movable>
            </div>
            <div className="cc-desk-legend">
              <span>청록색 = 현재 무대</span>
              <span>금색 = 옛 초고</span>
            </div>
            {state.sketchFit && (
              <div className="cc-storage-mark">
                원본 봉투 보관 표식 <b>▥</b> 세 칸 창문
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

const endingCopy = {
  names: {
    title: "무대의 이름들",
    line: "빈 무대 위로, 늦게 도착한 이름들이 흐른다.",
    speech:
      "창문을 남겨 두세요 · 정다은 작\n연기 오유리 · 음향 이도윤 · 의상 백은주\n그리고 해온극장을 함께 만든 사람들",
    final:
      "마지막 영상에는 얼굴 없는 인사 대신, 작품을 만든 사람들의 이름이 남았다.",
  },
  voices: {
    title: "하지 못한 인사",
    line: "이번에는 녹음된 목소리로 대신하지 않았다.",
    speech:
      "유리: ‘다은 선생님의 대사로 끝내고 싶어요.’\n도윤: ‘이번 마이크는 켜져 있어요.’\n은주: ‘잘 가, 다은아. 늦어서 미안해.’",
    final:
      "남은 단원들이 빈 객석 앞에서 인사했다. 서툴고 서로 겹치는, 그들 자신의 말이었다.",
  },
};

function FinalPuzzle({ state, send, check }: PuzzleProps) {
  const [frame, setFrame] = useState(0);
  const [running, setRunning] = useState(false);
  const moments = [
    "21:04 · 분장실에서 다툼",
    "21:07 · 세트 뒤 통로",
    "21:08 · 마네킹과 외투 배치",
    "21:09 · 오른쪽 날개막으로 복귀",
    "21:10 · 예정된 녹음과 역광",
  ];
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(
      () =>
        setFrame((previous) => {
          if (previous >= 4) return 4;
          return previous + 1;
        }),
      1800,
    );
    const stop = window.setTimeout(() => setRunning(false), 9000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [running]);
  if (state.ending) {
    const copy = endingCopy[state.ending];
    return (
      <main className="cc-ending">
        <img
          src={asset("stage.png")}
          alt="모든 인사가 끝난 해온극장의 빈 무대"
        />
        <div className="cc-ending-content">
          <Eyebrow>THE LAST CURTAIN CALL</Eyebrow>
          <h1>{copy.title}</h1>
          <p>{copy.line}</p>
          <div className="cc-end-credits">{copy.speech}</div>
          <p>{copy.final}</p>
          <div className="cc-ending-actions">
            <button
              className="cc-primary"
              onClick={() =>
                send({
                  type: "ending",
                  value: state.ending === "names" ? "voices" : "names",
                })
              }
            >
              다른 작별 보기
            </button>
            <button onClick={() => send({ type: "ending", value: null })}>
              극장으로 돌아가기
            </button>
          </div>
          <small>
            사건 해결 · 모든 발견과 두 결말은 이 브라우저에 저장됩니다.
          </small>
        </div>
      </main>
    );
  }
  return (
    <Layout
      caption={
        state.solved
          ? "입증된 사실을 바탕으로 구성한 사건의 흐름입니다. 정확한 부상 시각을 단정하지 않습니다."
          : "앞선 조사에서 확인한 빛·소리·통로가 자동으로 배치되었습니다."
      }
      tools={
        <>
          <Eyebrow>05 / 마지막 재현</Eyebrow>
          <h2>
            {state.solved ? (
              <>
                누가 인사했는지,
                <br />
                이제 안다.
              </>
            ) : (
              <>
                이 장면을
                <br />
                완성한 사람.
              </>
            )}
          </h2>
          {!state.solved ? (
            <>
              <p>
                분장실에 닿은 흔적, 비어 있던 자리, 돌아온 방향. 세 가지가 같은
                사람을 가리켜야 합니다.
              </p>
              <div className="cc-suspect-list">
                {people.map((p) => (
                  <button
                    key={p.id}
                    aria-label={`${p.name} ${p.role}`}
                    aria-pressed={state.accused === p.id}
                    onClick={() =>
                      send({ type: "patch", value: { accused: p.id } })
                    }
                  >
                    <b>{p.name}</b>
                    <span>{p.role}</span>
                  </button>
                ))}
              </div>
              <button
                className="cc-primary"
                disabled={!state.accused}
                onClick={() => check("final")}
              >
                이 인물로 사건 재현하기
              </button>
              <p className="cc-fine">
                필요한 발견 {state.findings.length} / 7 · 잘못된 재현에는 개별
                정답을 표시하지 않습니다.
              </p>
            </>
          ) : (
            <>
              <Done>
                정서경의 접촉 흔적과 거짓 위치 설명이 가짜 인사 준비로
                연결됩니다.
              </Done>
              <blockquote className="cc-voice">
                “이름 한 줄이면 됐어요. 그런데 그 사람은 끝까지 자기 극장이라고…
                그때 도움을 불렀어야 했어요.”
                <small>
                  재현 뒤 서경의 진술. 범행 입증을 대신하는 자료는 아닙니다.
                </small>
              </blockquote>
              <p>
                동생의 작품은 되찾아야 했습니다. 그 일이 서경의 공격과 은폐를
                정당화하지는 않습니다.
              </p>
              <h3>영상 끝에 어떤 작별을 남길까요?</h3>
              <button
                className="cc-primary"
                onClick={() => send({ type: "ending", value: "names" })}
              >
                무대의 이름들
              </button>
              <button onClick={() => send({ type: "ending", value: "voices" })}>
                하지 못한 인사
              </button>
            </>
          )}
        </>
      }
    >
      <div className="cc-film-label">
        RECONSTRUCTION · {state.solved ? moments[frame] : "조사 결과 배치"}
      </div>
      <div
        className={`cc-light-wash ${!state.solved || frame >= 4 ? "back" : "work"}`}
      />
      {(!state.solved || frame >= 2) && (
        <div className="cc-original-figure">
          <Prop
            cell={0}
            className={
              !state.solved || frame >= 4 ? "cc-shadow-prop" : "cc-lit-prop"
            }
          />
        </div>
      )}
      <div className="cc-final-route">
        <FloorPlan
          state={{
            ...state,
            route: state.solved
              ? ["room", "rear", "chair", "wing"].slice(
                  0,
                  Math.min(frame + 1, 4),
                )
              : ["room", "rear", "chair", "wing"],
            panel: 78,
          }}
          playback={state.solved}
        />
      </div>
      <div className="cc-final-inventory">
        {(["shadow", "audio", "contact", "author"] as Finding[]).map((id) => (
          <div key={id}>
            <b>{findings[id].icon}</b>
            <span>{findings[id].title}</span>
          </div>
        ))}
      </div>
      {state.solved && (
        <div className="cc-replay-controls">
          <button
            onClick={() => {
              setFrame(0);
              setRunning(true);
            }}
            disabled={running}
          >
            {running ? "재현 중…" : "▶ 사건 흐름 재생"}
          </button>
          <Range
            label="재현 장면"
            value={frame}
            min={0}
            max={4}
            onChange={(n) => {
              setRunning(false);
              setFrame(n);
            }}
          />
        </div>
      )}
    </Layout>
  );
}

function Intro({ state, send }: { state: CurtainState; send: Send }) {
  const copy = [
    {
      eyebrow: "해온극장 / 마지막 공연",
      title: (
        <>
          마지막
          <br />
          <em>커튼콜</em>
        </>
      ),
      text: "당신은 폐관 공연을 촬영하러 왔다. 오늘 밤, 모두가 보았다고 믿는 한 장면이 사건의 중심이 된다.",
      button: "카메라 켜기",
    },
    {
      eyebrow: "21:10 / 그림자 인사",
      title: (
        <>
          “오늘이 마지막
          <br />
          공연입니다.”
        </>
      ),
      text: "막 뒤의 의자에 익숙한 외투의 윤곽. 스피커에서 나온 목소리. 객석에 박수가 번진다.",
      button: "마지막 장면 확인하기",
    },
    {
      eyebrow: "21:16 / 분장실",
      title: (
        <>
          나는 그가 살아 있는
          <br />
          모습을 찍었다고 생각했다.
        </>
      ),
      text: "한정우가 분장실에서 숨진 채 발견됐다. 내 영상이 마지막 생존의 증거라지만, 나는 그의 얼굴을 찍지 못했다.",
      button: "내가 찍은 장면 조사하기",
    },
  ][state.intro];
  return (
    <main className={`cc-intro cc-intro-${state.intro}`}>
      <img
        src={asset(state.intro === 2 ? "backstage.png" : "stage.png")}
        alt={
          state.intro === 2
            ? "불 켜진 분장실, 주인 없는 의자"
            : "폐관을 앞둔 해온극장의 마지막 무대"
        }
      />
      {state.intro === 1 && (
        <div className="cc-intro-figure">
          <Prop cell={0} className="cc-shadow-prop" />
        </div>
      )}
      <div className="cc-intro-content">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
        <button className="cc-primary" onClick={() => send({ type: "intro" })}>
          {copy.button}
          <span>→</span>
        </button>
        <small>
          {state.intro === 0
            ? "공간을 살피고 · 빛을 바꾸고 · 흔적을 맞추는 추리"
            : "마우스·터치·키보드로 조사 / 진행 자동 저장"}
        </small>
      </div>
      {state.intro === 0 && (
        <div className="cc-intro-props">
          <span>오늘 공연의 장치</span>
          <div>
            <Prop cell={2} />
            <span>그림자 인사용 의자</span>
          </div>
          <div>
            <Prop cell={1} />
            <span>의상용 마네킹</span>
          </div>
          <p>
            얇은 막과 역광, 미리 준비된 인사 음성.
            <br />
            극장이 오래 써 온 마지막 인사 방식이다.
          </p>
        </div>
      )}
    </main>
  );
}

export default function CurtainGame() {
  const sound = useGameSound();
  const settings = useSyncExternalStore(
    sound.subscribe,
    sound.getSettings,
    () => DEFAULT_SOUND_SETTINGS,
  );
  const [loaded, setLoaded] = useState(() =>
    typeof window === "undefined"
      ? { state: initialCurtainState(), error: "", blocked: false }
      : loadCurtain(() => window.localStorage),
  );
  const [state, setState] = useState(loaded.state);
  const current = useRef(state);
  const [saveError, setSaveError] = useState(loaded.error);
  const [modal, setModal] = useState<
    "case" | "findings" | "reset" | "help" | null
  >(null);
  const [station, setStation] = useState("");
  const [notice, setNotice] = useState("");
  const [hint, setHint] = useState(false);
  const mainHeading = useRef<HTMLHeadingElement>(null);
  const [ambient, setAmbient] = useState("");
  const [ambientNote, setAmbientNote] = useState("");
  useEffect(() => {
    const before = document.title;
    document.title = "마지막 커튼콜 · 해온극장 공간 추리";
    return () => {
      document.title = before;
    };
  }, []);
  useEffect(() => {
    document
      .querySelectorAll<HTMLAudioElement>(".curtain-game audio")
      .forEach((audio) => {
        audio.volume = settings.volume;
        audio.muted = !settings.enabled;
      });
  }, [settings, station, state.chapter, state.take]);
  const reload = () => {
    const next = loadCurtain(() => window.localStorage);
    setLoaded(next);
    setState(next.state);
    current.current = next.state;
    setSaveError(next.error);
  };
  const send: Send = (action) => {
    if (loaded.blocked) return;
    const previous = current.current;
    const next = curtainReducer(previous, action);
    current.current = next;
    setState(next);
    setSaveError(saveCurtain(() => window.localStorage, next));
    if (next.findings.length > previous.findings.length) {
      const id = next.findings.at(-1)!;
      setNotice(`발견 보관: ${findings[id].title}`);
      sound.play("collect");
    } else if (action.type !== "patch" && action.type !== "peel")
      sound.play("select");
  };
  const check: PuzzleProps["check"] = (puzzle) => {
    const before = current.current;
    const after = curtainReducer(before, { type: "check", puzzle });
    send({ type: "check", puzzle });
    const success =
      puzzle === "shadow"
        ? shadowFits(before)
        : puzzle === "audio"
          ? audioFits(before)
          : puzzle === "route"
            ? routeFits(before)
            : puzzle === "clasp"
              ? fragmentFits(before)
              : puzzle === "sketch"
                ? sketchFits(before)
                : after.solved;
    setNotice(
      success
        ? puzzle === "final"
          ? "사건 재현을 완료했습니다. 마지막 작별을 선택할 수 있습니다."
          : "대조 결과가 이어집니다. 관찰한 내용이 보관되었습니다."
        : puzzle === "final"
          ? "이 재현은 확인한 기록 전체를 설명하지 못합니다. 발견한 흔적과 동선을 다시 살펴보세요."
          : "아직 원본과 맞지 않습니다. 배치와 비교 기준을 다시 살펴보세요.",
    );
    sound.play(success ? "success" : "retry");
  };
  const changeChapter = (chapter: Chapter) => {
    send({ type: "chapter", chapter });
    setStation("");
    setNotice("");
    setHint(false);
    mainHeading.current?.focus();
  };
  const puzzleProps = { state, send, check };
  const chapter = chapters[state.chapter - 1];
  const stations =
    state.chapter === 2
      ? [
          {
            id: "light",
            label: "◐ 빛과 의자",
            done: state.findings.includes("shadow"),
          },
          {
            id: "audio",
            label: "≋ 소리 대조",
            done: state.findings.includes("audio"),
          },
        ]
      : state.chapter === 3
        ? [
            {
              id: "route",
              label: "↝ 통로",
              done: state.findings.includes("route"),
            },
            {
              id: "clasp",
              label: "◇ 파편",
              done: state.findings.includes("contact"),
            },
            {
              id: "position",
              label: "↔ 위치",
              done: state.findings.includes("position"),
            },
          ]
        : [];
  const selected = stations.some((s) => s.id === station)
    ? station
    : stations[0]?.id;
  const hintText =
    state.chapter === 1
      ? "한 시점씩 1.6배 이상 확대해 기록하세요. 시야를 바꾸면 확대만 초기화되고 기록은 유지됩니다."
      : state.chapter === 2
        ? selected === "audio"
          ? "뾰족한 봉우리 세 개의 간격을 먼저 비교하세요. 같은 모양을 찾은 다음 가로 위치를 맞춥니다."
          : "막을 걷고 작업등을 켜면 안쪽을 볼 수 있습니다. 확인한 다음에는 막을 내리고 역광으로 바꿔 원본 윤곽에 맞춥니다."
        : state.chapter === 3
          ? selected === "clasp"
            ? "꽃잎의 곡선과 꺾인 절단선을 함께 보세요. 맞춘 뒤에는 공연 전후의 착용 모습도 확인합니다."
            : selected === "position"
              ? "비어 있던 연속 구간과 다시 나타난 방향을 둘 다 살펴보세요."
              : "두 배치 버튼을 번갈아 눌러 보세요. 뒤 통로 출구가 열린 배치에서 의자를 거쳐 날개막으로 갑니다."
          : state.chapter === 4
            ? "창문의 세 기둥과 계단 모서리를 동시에 맞춥니다. 회전부터 바로잡으면 이동 방향을 찾기 쉽습니다."
            : "동기는 현장 흔적을 설명하는 배경입니다. 분장실 파편과 돌아온 방향, 비어 있던 자리를 먼저 연결하세요.";
  return (
    <SoundContext.Provider value={sound}>
      <div
        className="curtain-game"
        onPointerDownCapture={() => sound.unlock()}
        onKeyDownCapture={() => sound.unlock()}
      >
        <svg className="cc-filter-defs" aria-hidden="true">
          <defs>
            <filter id="cc-shadow" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.02  0 0 0 0 0.015  0 0 0 0 0.012  -1 -1 -1 0 2.1"
              />
              <feGaussianBlur stdDeviation="0.65" />
              <feComposite in2="SourceAlpha" operator="in" />
            </filter>
          </defs>
        </svg>
        <header className="cc-header">
          <a className="cc-home-link" href="#">
            ← 삭제된 게시판
          </a>
          <a className="cc-wordmark" href="#curtain-call">
            마지막 커튼콜 <span>HAEON THEATRE</span>
          </a>
          <div className="cc-header-tools">
            <SoundControls
              title="극장의 소리"
              description="조작 효과음과 조사 음원의 음량을 조절합니다. 음향 퍼즐은 파형만으로도 풀 수 있습니다."
            />
            <button onClick={() => setModal("help")} aria-label="조작 안내">
              ?
            </button>
          </div>
        </header>
        {saveError && (
          <div className="cc-save-error" role="alert">
            <p>{saveError}</p>
            <button
              onClick={
                loaded.blocked
                  ? reload
                  : () =>
                      setSaveError(
                        saveCurtain(() => window.localStorage, current.current),
                      )
              }
            >
              {loaded.blocked ? "저장 다시 불러오기" : "저장 다시 시도"}
            </button>
            {loaded.blocked && (
              <button onClick={() => setModal("reset")}>새 조사 시작</button>
            )}
          </div>
        )}
        {loaded.blocked ? (
          <div className="cc-save-block">
            <h1>기록을 보존하고 있습니다.</h1>
            <p>위의 저장 안내를 확인해 주세요.</p>
          </div>
        ) : !state.started ? (
          <Intro state={state} send={send} />
        ) : (
          <>
            {!state.ending && (
              <>
                <div className="cc-chapter-heading">
                  <div>
                    <Eyebrow>ACT 0{state.chapter} / 05</Eyebrow>
                    <h1 ref={mainHeading} tabIndex={-1}>
                      {chapter.title}
                    </h1>
                  </div>
                  <div className="cc-investigation-tools">
                    <button onClick={() => setModal("case")}>
                      사건과 조사 이유
                    </button>
                    <button
                      aria-label={`발견 보관함 ${state.findings.length}개`}
                      onClick={() => setModal("findings")}
                    >
                      발견 {state.findings.length}
                      <span>↗</span>
                    </button>
                  </div>
                </div>
                <div className="cc-station-bar">
                  <nav aria-label="이번 장의 조사">
                    {stations.length ? (
                      stations.map((s) => (
                        <button
                          key={s.id}
                          aria-current={selected === s.id ? "page" : undefined}
                          onClick={() => {
                            setStation(s.id);
                            setNotice("");
                            setHint(false);
                          }}
                        >
                          {s.label}
                          {s.done && <span> ✓</span>}
                        </button>
                      ))
                    ) : (
                      <span>
                        {state.chapter === 1
                          ? "객석과 촬영 시야"
                          : state.chapter === 4
                            ? "무대 그림 · 의상 서랍"
                            : "모든 발견을 한 장면으로"}
                      </span>
                    )}
                  </nav>
                  <button onClick={() => setHint(!hint)} aria-expanded={hint}>
                    조작 힌트 {hint ? "−" : "+"}
                  </button>
                </div>
                {hint && <div className="cc-hint">{hintText}</div>}
              </>
            )}
            {state.chapter === 1 ? (
              <SeatsPuzzle {...puzzleProps} />
            ) : state.chapter === 2 ? (
              selected === "audio" ? (
                <AudioPuzzle {...puzzleProps} />
              ) : (
                <ShadowPuzzle {...puzzleProps} />
              )
            ) : state.chapter === 3 ? (
              selected === "clasp" ? (
                <ClaspPuzzle {...puzzleProps} />
              ) : selected === "position" ? (
                <PositionPuzzle {...puzzleProps} />
              ) : (
                <RoutePuzzle {...puzzleProps} />
              )
            ) : state.chapter === 4 ? (
              <ArchivePuzzle {...puzzleProps} />
            ) : (
              <FinalPuzzle {...puzzleProps} />
            )}
            {!state.ending && (
              <>
                <div className="cc-feedback" role="status" aria-live="polite">
                  {notice ||
                    (chapterDone(state, state.chapter)
                      ? "이 장의 조사를 마쳤습니다. 다음 장으로 이어갈 수 있습니다."
                      : `${chapter.question} · ${chapterNeeds[state.chapter].filter((id) => state.findings.includes(id)).length} / ${chapterNeeds[state.chapter].length || 1} 조사 완료`)}
                </div>
                <footer className="cc-chapter-footer">
                  <nav aria-label="장 선택">
                    {chapters.map((c, i) => (
                      <button
                        key={c.title}
                        aria-label={`${i + 1}장 ${c.title}`}
                        aria-current={
                          state.chapter === i + 1 ? "step" : undefined
                        }
                        disabled={!canOpenChapter(state, (i + 1) as Chapter)}
                        onClick={() => changeChapter((i + 1) as Chapter)}
                      >
                        <span>
                          {chapterDone(state, (i + 1) as Chapter)
                            ? "✓"
                            : `0${i + 1}`}
                        </span>
                        <b>{c.title}</b>
                      </button>
                    ))}
                  </nav>
                  {state.chapter < 5 && (
                    <button
                      className="cc-primary cc-next"
                      disabled={!chapterDone(state, state.chapter)}
                      onClick={() =>
                        changeChapter((state.chapter + 1) as Chapter)
                      }
                    >
                      다음 장으로 →
                    </button>
                  )}
                </footer>
                <div className="cc-ambient">
                  <button
                    aria-expanded={!!ambient}
                    onClick={() => {
                      setAmbient(ambient ? "" : "open");
                      setAmbientNote("");
                    }}
                  >
                    극장 구석의 물건들 {ambient ? "−" : "+"}
                  </button>
                  {ambient && (
                    <div>
                      <button
                        onClick={() => {
                          send({ type: "visit", value: "mug" });
                          setAmbientNote(
                            "식은 커피 옆에 붙은 쪽지. ‘막공 끝나면 국수 먹자. 곱빼기는 도윤이 쏘기.’",
                          );
                        }}
                      >
                        커피잔
                      </button>
                      <button
                        onClick={() => {
                          send({ type: "visit", value: "costume" });
                          setAmbientNote(
                            "소매 안쪽의 여러 겹 수선 자국. ‘유리야, 이번에는 커튼에 걸리지 말자. — 은주’",
                          );
                        }}
                      >
                        수선한 소매
                      </button>
                      <button
                        onClick={() => {
                          send({ type: "visit", value: "speaker" });
                          setAmbientNote(
                            "스피커 뒤의 낡은 스티커. ‘커튼콜 끝나기 전에는 전원 뽑지 말 것!’",
                          );
                        }}
                      >
                        스피커 뒤
                      </button>
                      <p role="status">
                        {ambientNote || "누군가 오랫동안 일하고 기다리던 자리."}
                      </p>
                    </div>
                  )}
                  <span>
                    {saveError ? "저장 확인 필요" : "이 브라우저에 자동 저장됨"}
                  </span>
                </div>
              </>
            )}
          </>
        )}
        {modal && (
          <Dialog
            label={
              modal === "case"
                ? "사건과 조사 이유"
                : modal === "findings"
                  ? "발견 보관함"
                  : modal === "reset"
                    ? "새 조사 시작 확인"
                    : "조작 안내"
            }
            onClose={() => setModal(null)}
            wide={modal === "findings"}
          >
            <div className="cc-dialog-content">
              {modal === "case" && (
                <>
                  <Eyebrow>CASE / 마지막 커튼콜</Eyebrow>
                  <h2>누가, 어떻게 마지막 인사를 만들었나.</h2>
                  <p>
                    한정우는 마지막 인사 직후 분장실에서 숨진 채 발견됐습니다.
                    당신이 찍은 영상은 그가 살아 있었다는 증거로 쓰이고
                    있습니다.
                  </p>
                  <h3>{chapter.question}</h3>
                  <p>{chapter.why}</p>
                  <ul>
                    {chapterNeeds[state.chapter].map((id) => (
                      <li key={id}>
                        {state.findings.includes(id) ? "✓ " : "○ "}
                        {id === "sight"
                          ? "세 목격 시점 확인"
                          : id === "shadow"
                            ? "빛과 의자 배치 재현"
                            : id === "audio"
                              ? "공연 소리와 녹음 대조"
                              : id === "route"
                                ? "세트 배치와 동선 재현"
                                : id === "contact"
                                  ? "파편 맞추기와 공연 전후 착용 대조"
                                  : id === "position"
                                    ? "연속 영상의 위치 대조"
                                    : "옛 무대 그림과 원본 표지 조사"}
                      </li>
                    ))}
                  </ul>
                  <p>
                    직접 조작할 화면은 수사팀이 확보한 자료의 재현입니다. 현장
                    원본은 보존됩니다.
                  </p>
                </>
              )}
              {modal === "findings" && (
                <>
                  <Eyebrow>OBSERVATIONS / {state.findings.length}</Eyebrow>
                  <h2>내가 직접 확인한 것</h2>
                  {state.findings.length ? (
                    <div className="cc-finding-list">
                      {[...state.findings].reverse().map((id) => (
                        <article key={id}>
                          <span>{findings[id].icon}</span>
                          <div>
                            <h3>{findings[id].title}</h3>
                            <p>{findings[id].detail}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>시야를 확대해 첫 관찰을 기록해 보세요.</p>
                  )}
                </>
              )}
              {modal === "help" && (
                <>
                  <h2>글을 읽기보다, 장면을 바꿔 보세요.</h2>
                  <p>
                    무대 위에서는 조명과 막을 바꾸고, 조사대에서는 조각을 직접
                    움직입니다. 발견한 내용은 자동으로 보관되고 다음 장에
                    이어집니다.
                  </p>
                  <ul>
                    <li>
                      파편·그림: 드래그 또는 방향키. Shift + 방향키로 크게 이동.
                    </li>
                    <li>
                      슬라이더: 드래그 또는 좌우 방향키. 터치로도 조작 가능.
                    </li>
                    <li>
                      음향: 두 파형의 모양과 간격으로 비교. 소리를 듣지 않아도
                      해결 가능.
                    </li>
                    <li>막히면 ‘조작 힌트’ 또는 ‘사건과 조사 이유’를 확인.</li>
                  </ul>
                  <p>
                    이 브라우저의 저장 공간에 진행을 보관합니다. 같은 주소와
                    브라우저로 돌아오면 이어집니다.
                  </p>
                  <button onClick={() => setModal("reset")}>
                    마지막 커튼콜 처음부터 다시
                  </button>
                </>
              )}
              {modal === "reset" && (
                <>
                  <h2>새 조사로 시작할까요?</h2>
                  <p>
                    이 브라우저에 저장된 마지막 커튼콜의 진행을 초기화합니다.
                    삭제된 게시판의 진행은 그대로 유지됩니다.
                  </p>
                  <div className="cc-choice-row">
                    <button onClick={() => setModal(null)}>취소</button>
                    <button
                      className="cc-primary"
                      onClick={() => {
                        const fresh = initialCurtainState();
                        const error = saveCurtain(
                          () => window.localStorage,
                          fresh,
                        );
                        if (error) {
                          setSaveError(error);
                          setModal(null);
                          return;
                        }
                        setLoaded({ state: fresh, error: "", blocked: false });
                        setState(fresh);
                        current.current = fresh;
                        setSaveError("");
                        setModal(null);
                        setNotice("");
                        setStation("");
                      }}
                    >
                      진행 초기화
                    </button>
                  </div>
                </>
              )}
            </div>
          </Dialog>
        )}
      </div>
    </SoundContext.Provider>
  );
}
