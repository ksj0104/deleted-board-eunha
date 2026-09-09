"use client";
import React, { useState } from "react";
import type { Progress } from "../lib/game";
import {
  sourceName,
  type Investigation,
  type InvestigationState,
} from "../lib/fieldwork";
import { useSound } from "./sound-context";
import { acquiredRecord, requestFor } from "../lib/record-requests";

const places = [
  { id: "management", label: "관리동", reader: "R01", x: 16, y: 22 },
  { id: "square", label: "중앙광장", reader: "통과 리더 없음", x: 16, y: 77 },
  { id: "courtyard", label: "동문 안뜰", reader: "R02", x: 49, y: 22 },
  { id: "street", label: "외부 보도", reader: "바깥 철문", x: 83, y: 22 },
  { id: "tunnel", label: "지하 연결통로", reader: "R07", x: 49, y: 77 },
  {
    id: "archive",
    label: "구 세탁실",
    reader: "R09 · 현재 주민 기록실",
    x: 83,
    y: 77,
  },
];
const edges = [
  ["management", "square"],
  ["management", "courtyard"],
  ["courtyard", "street"],
  ["courtyard", "tunnel"],
  ["tunnel", "archive"],
];
const records = ["r01", "r02", "r07", "r09"];

export default function RouteInvestigation({
  desk,
  state,
  progress,
  disabled,
  onChoose,
  onRead,
  onObserve,
}: {
  desk: Investigation;
  state: InvestigationState;
  progress: Progress;
  disabled: boolean;
  onChoose: (slot: string, clue: string) => void;
  onRead: (record: string) => void;
  onObserve: () => void;
}) {
  const tested = state.inspected.includes("door-tested");
  const [power, setPower] = useState(!tested);
  const [doorOpen, setDoorOpen] = useState(tested);
  const sound = useSound();
  const read = (id: string) => progress.read.includes(id);
  const clue = (id: string) => desk.clues.find((item) => item.id === id)!;
  const location = (id: string) =>
    Object.entries(state.placements).find(([, value]) => value === id)?.[0] ??
    "";
  const locations = places.filter((place) =>
    desk.slots.some((slot) => slot.id === place.id),
  );
  const count = records.filter((id) =>
    locations.some((place) => place.id === location(id)),
  ).length;
  const mapReady = read("4-1") && read("4-3");
  const closure = state.placements.closure === "works";
  const prepared = read("4-4") && state.placements.door === "exit";
  const sourceButton = (id: string) => (
    <button
      type="button"
      className="secondary"
      key={id}
      onClick={() => onRead(id)}
    >
      {!acquiredRecord(progress, id)
        ? `${requestFor(id)!.title} 조회`
        : `${read(id) ? "원문 다시 보기" : "자료 열기"} · ${sourceName(id)}`}{" "}
      ↗
    </button>
  );
  const next = !mapReady
    ? "1. 보행 연결도와 방문증 기록을 열어 주세요."
    : count < 4
      ? "1. 각 출입 기록의 리더 번호를 지도와 대조해 장소를 골라 주세요."
      : !read("4-2") || !closure
        ? "2. 공사 안내에서 통행할 수 없는 길을 확인하고 표시하세요."
        : !prepared
          ? "3. 시설 기록을 열고 점검판으로 시험을 준비하세요."
          : !tested
            ? "3. 정전을 재현한 뒤 내부 손잡이를 눌러 보세요."
            : "필요한 조작을 마쳤습니다. 아래 ‘조사 결과 확인’으로 연결을 검증하세요.";
  return (
    <div className="route-investigation">
      <p className="route-next" role="status">
        {disabled && state.confirmed
          ? "저장된 조사 결과를 살펴볼 수 있습니다."
          : next}
      </p>
      <section className="route-step" aria-label="출입 기록과 장소 연결">
        <header>
          <span>1</span>
          <div>
            <h3>기록의 번호를 실제 장소에 연결</h3>
            <p>
              리더는 방문증을 읽는 출입 장치입니다. 지도에서 같은 R 번호를 찾고,
              기록 옆에서 장소를 선택하세요.
            </p>
          </div>
          <small>{count}/4 연결</small>
        </header>
        <div className="route-source-links">
          {["4-1", "4-3"].map(sourceButton)}
        </div>
        <div className="route-layout">
          <div>
            {read("4-1") ? (
              <>
                <p className="route-map-help">
                  가는 선은 통로입니다. 번호 표시는 선택한 기록의 시간순이며,
                  정답 여부는 마지막에 확인합니다.
                </p>
                <div
                  className="route-map-scroll"
                  tabIndex={0}
                  aria-label="보행 지도, 좁은 화면에서는 가로 스크롤"
                >
                  <div
                    className="route-map route-preview"
                    role="img"
                    aria-label="리더 위치: R01 관리동, R02 동문 안뜰, R07 지하 연결통로, R09 구 세탁실(현재 주민 기록실). 관리동은 중앙광장과 동문 안뜰에 연결되고, 동문 안뜰은 외부 보도와 지하 연결통로에 연결됩니다. 지하 연결통로는 구 세탁실로 이어집니다."
                  >
                    {edges.map(([from, to]) => {
                      const a = places.find((p) => p.id === from)!;
                      const b = places.find((p) => p.id === to)!;
                      return (
                        <div
                          key={from + to}
                          className={`map-path ${to === "street" && closure ? "closed-path" : ""}`}
                          style={{
                            left: `${a.x}%`,
                            top: `${a.y}%`,
                            width: `${b.x - a.x || 0.4}%`,
                            height: `${b.y - a.y || 0.6}%`,
                          }}
                        />
                      );
                    })}
                    {places.map((place) => {
                      const index = records.indexOf(state.placements[place.id]);
                      return (
                        <div
                          className={`route-place ${index >= 0 ? "has-record" : ""}`}
                          key={place.id}
                          style={{ left: `${place.x}%`, top: `${place.y}%` }}
                        >
                          <strong>{place.label}</strong>
                          <small>{place.reader}</small>
                          {index >= 0 && (
                            <span>
                              {index + 1}번째 ·{" "}
                              {clue(records[index]).value.slice(0, 5)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <p className="unread-material">
                보행 연결도를 열면 장소와 통로가 표시됩니다.
              </p>
            )}
          </div>
          <div className="route-record-list">
            {read("4-3") ? (
              records.map((id, index) => (
                <div className="route-record" key={id}>
                  <label htmlFor={`route-${id}`}>
                    <span>{index + 1}</span>
                    <strong>{clue(id).value}</strong>
                  </label>
                  <select
                    id={`route-${id}`}
                    aria-label={`${clue(id).label}의 장소`}
                    value={location(id)}
                    disabled={disabled || !mapReady}
                    onChange={(event) => {
                      const target = event.target.value;
                      if (target) onChoose(target, id);
                      else if (location(id)) onChoose(location(id), "");
                    }}
                  >
                    <option value="">장소 선택</option>
                    {locations.map((place) => (
                      <option value={place.id} key={place.id}>
                        {place.label}
                      </option>
                    ))}
                    {location(id) &&
                      !locations.some((place) => place.id === location(id)) && (
                        <option value={location(id)}>
                          이전 배치 ·{" "}
                          {
                            desk.slots.find((slot) => slot.id === location(id))
                              ?.label
                          }
                        </option>
                      )}
                  </select>
                </div>
              ))
            ) : (
              <p className="unread-material">
                방문증 이동 기록을 열면 네 출입 시각이 표시됩니다.
              </p>
            )}
          </div>
        </div>
        {mapReady && (
          <ol className="route-sequence" aria-label="내가 연결한 시간순 동선">
            {records.map((id) => (
              <li key={id}>
                <small>{clue(id).value.slice(0, 5)}</small>
                <strong>
                  {places.find((place) => place.id === location(id))?.label ??
                    "장소 미선택"}
                </strong>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="route-step" aria-label="공사로 막힌 길 확인">
        <header>
          <span>2</span>
          <div>
            <h3>‘동문 통과’와 바깥으로 나간 일을 구분</h3>
            <p>
              동문 안뜰에 들어간 것과 외부 보도로 나간 것은 다릅니다. 그날 닫힌
              구간을 확인하세요.
            </p>
          </div>
        </header>
        <div className="route-source-links">{sourceButton("4-2")}</div>
        {read("4-2") && (
          <div className="route-control-card">
            <strong>{clue("works").value}</strong>
            <p>{clue("works").detail}</p>
            <button
              className="secondary"
              type="button"
              disabled={disabled}
              aria-pressed={closure}
              onClick={() => onChoose("closure", closure ? "" : "works")}
            >
              {closure ? "폐쇄 구간 표시 지우기" : "지도에 폐쇄 구간 표시"}
            </button>
            {closure && (
              <p className="route-blocked">
                동문 안뜰 ── × 통행 불가 × ── 외부 보도
              </p>
            )}
          </div>
        )}
      </section>
      <section className="route-step" aria-label="정전 상태의 비상문 시험">
        <header>
          <span>3</span>
          <div>
            <h3>정전 때문에 안에 갇혔는지 시험</h3>
            <p>
              시설 기록의 조건을 모형에 적용합니다. 점검판 준비 → 정전 재현 →
              내부 손잡이 순서로 조작하세요.
            </p>
          </div>
        </header>
        <div className="route-source-links">{sourceButton("4-4")}</div>
        {read("4-4") && (
          <div className="route-control-card">
            <strong>{clue("exit").value}</strong>
            <p>{clue("exit").detail}</p>
            <button
              type="button"
              className="secondary"
              disabled={disabled}
              aria-pressed={prepared}
              onClick={() => {
                onChoose("door", prepared ? "" : "exit");
                setDoorOpen(false);
              }}
            >
              {prepared ? "점검판 준비 해제" : "점검판으로 시험 준비"}
            </button>
          </div>
        )}
        <div
          className={`door-model ${doorOpen && prepared ? "door-is-open" : ""}`}
        >
          <div className="door-leaf" aria-hidden="true">
            R09
            <br />
            내부 비상문
          </div>
          <div className="route-door-controls">
            <h4>현재 전원: {power ? "정상" : "정전"}</h4>
            <div
              className="route-power"
              role="group"
              aria-label="비상문 시험 전원"
            >
              <button
                className="secondary"
                type="button"
                disabled={disabled || !prepared}
                aria-pressed={power}
                onClick={() => {
                  setPower(true);
                  setDoorOpen(false);
                }}
              >
                정상 전원
              </button>
              <button
                className="secondary"
                type="button"
                disabled={disabled || !prepared}
                aria-pressed={!power}
                onClick={() => {
                  setPower(false);
                  setDoorOpen(false);
                }}
              >
                정전 재현
              </button>
            </div>
            <button
              type="button"
              className="primary"
              disabled={disabled || !prepared}
              onClick={() => {
                setDoorOpen(true);
                sound?.play("open");
                if (!power) onObserve();
              }}
            >
              내부 손잡이 누르기
            </button>
            <p role="status">
              {!prepared
                ? "시설 기록을 열고 점검판으로 시험을 준비하면 조작할 수 있습니다."
                : doorOpen
                  ? power
                    ? "정상 전원에서 문이 열렸습니다. 정전을 재현한 뒤 다시 시험하세요."
                    : "정전 상태에서도 내부 손잡이로 문이 열렸습니다."
                  : power
                    ? "정전 재현을 누른 다음 내부 손잡이를 눌러 주세요."
                    : "정전 상태입니다. 이제 내부 손잡이를 눌러 결과를 관찰하세요."}
            </p>
            {tested && (
              <p className="route-observed">
                정전 개방 시험 관찰 기록 있음 · 저장 상태는 아래에서 확인하세요.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
