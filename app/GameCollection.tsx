"use client";
import React, { useSyncExternalStore } from "react";
import Game from "./Game";
import CurtainGame from "./curtain/CurtainGame";
import type { GameClient } from "../lib/game-client";

const subscribe = (changed: () => void) => {
  window.addEventListener("hashchange", changed);
  return () => window.removeEventListener("hashchange", changed);
};
const snapshot = () => window.location.hash === "#curtain-call";
export default function GameCollection({ client }: { client?: GameClient }) {
  const curtain = useSyncExternalStore(subscribe, snapshot, () => false);
  return curtain ? <CurtainGame /> : <Game client={client} />;
}
