import type { Action, Feedback, gameView } from "./game";

export type GameView = ReturnType<typeof gameView> & { feedback?: Feedback };
export type GameClient = {
  storage: "server" | "browser";
  request: (action?: Action) => Promise<GameView>;
};

export const apiGameClient: GameClient = {
  storage: "server",
  async request(action) {
    const response = await fetch(
      "/api/game",
      action
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action),
          }
        : { cache: "no-store" },
    );
    const data = (await response.json()) as GameView & { error?: string };
    if (!response.ok)
      throw new Error(data.error ?? "기록을 불러오지 못했습니다.");
    return data;
  },
};
