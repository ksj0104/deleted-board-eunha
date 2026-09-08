import { episodes, recordById } from "./cases";
import { applyAction, freshProgress, gameView, type Progress } from "./game";
import type { GameClient } from "./game-client";
import { isRestoredOrder, validPieceOrder } from "./restoration";
import { comparisonMatches, validOffset } from "./calibration";

// GitHub project sites share an origin, so this key belongs only to this game.
export const LOCAL_SAVE_KEY = "eunha.deleted-board.progress.v1";
type SaveStorage = Pick<Storage, "getItem" | "setItem">;
const invalidSave =
  "저장된 기록을 읽을 수 없습니다. 기존 기록은 그대로 보관했습니다. 이 게임을 플레이했던 주소와 브라우저인지 확인해 주세요.";
const storageUnavailable =
  "브라우저에 기록을 저장할 수 없습니다. 사이트 데이터 저장 허용과 저장 공간을 확인한 뒤 다시 시도해 주세요.";

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const episodeId = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= episodes.length;
const recordIds = (value: unknown) =>
  strings(value) && value.every((id) => recordById(id) !== undefined);
const episodeMap = (
  value: unknown,
  valid: (item: unknown, episode: number) => boolean,
) =>
  object(value) &&
  Object.entries(value).every(
    ([key, item]) => episodeId(Number(key)) && valid(item, Number(key)),
  );

function isProgress(value: unknown): value is Progress {
  if (!object(value)) return false;
  return (
    value.version === 1 &&
    episodeId(value.active) &&
    typeof value.started === "boolean" &&
    Array.isArray(value.solved) &&
    value.solved.every((id, index) => id === index + 1 && episodeId(id)) &&
    value.active <= Math.min(episodes.length, value.solved.length + 1) &&
    recordIds(value.read) &&
    recordIds(value.pinned) &&
    (value.calibration === undefined ||
      (object(value.calibration) &&
        validOffset(value.calibration.offset) &&
        typeof value.calibration.confirmed === "boolean" &&
        (!value.calibration.confirmed ||
          comparisonMatches(value.calibration.offset)))) &&
    (value.restorations === undefined ||
      (object(value.restorations) &&
        Object.entries(value.restorations).every(([id, saved]) => {
          const doc = recordById(id)?.shredded;
          return (
            !!doc &&
            object(saved) &&
            typeof saved.complete === "boolean" &&
            validPieceOrder(doc, saved.order) &&
            (!saved.complete || isRestoredOrder(doc, saved.order))
          );
        }))) &&
    (value.liked === undefined || recordIds(value.liked)) &&
    (value.introduced === undefined ||
      (Array.isArray(value.introduced) && value.introduced.every(episodeId))) &&
    episodeMap(value.notes, (note) => typeof note === "string") &&
    episodeMap(
      value.hints,
      (count) => Number.isInteger(count) && Number(count) >= 0,
    ) &&
    episodeMap(
      value.attempts,
      (count) => Number.isInteger(count) && Number(count) >= 0,
    ) &&
    episodeMap(
      value.drafts,
      (drafts, episode) =>
        object(drafts) &&
        Object.entries(drafts).every(
          ([question, draft]) =>
            episodes[episode - 1].questions.some((q) => q.id === question) &&
            object(draft) &&
            (typeof draft.answer === "string" || strings(draft.answer)) &&
            recordIds(draft.evidence),
        ),
    ) &&
    (value.ending === null ||
      ((value.ending === "public" || value.ending === "audit") &&
        value.solved.length === episodes.length))
  );
}

function readProgress(storage: SaveStorage): Progress {
  let raw: string | null;
  try {
    raw = storage.getItem(LOCAL_SAVE_KEY);
  } catch {
    throw new Error(storageUnavailable);
  }
  if (raw === null) return freshProgress();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(invalidSave);
  }
  if (!isProgress(value)) throw new Error(invalidSave);
  return value;
}

export function createLocalGameClient(
  getStorage: () => SaveStorage = () => window.localStorage,
): GameClient {
  return {
    storage: "browser",
    async request(action) {
      const run = async () => {
        let storage: SaveStorage;
        try {
          storage = getStorage();
        } catch {
          throw new Error(storageUnavailable);
        }
        // Read the latest save for every action, including changes from another tab.
        const current = readProgress(storage);
        if (!action) return gameView(current);
        const { progress, feedback } = applyAction(current, action);
        try {
          storage.setItem(LOCAL_SAVE_KEY, JSON.stringify(progress));
        } catch {
          throw new Error(storageUnavailable);
        }
        return { ...gameView(progress), feedback };
      };
      // Chrome serializes simultaneous writes from tabs on the same origin.
      if (typeof navigator !== "undefined" && navigator.locks)
        return navigator.locks.request(LOCAL_SAVE_KEY, run);
      return run();
    },
  };
}
