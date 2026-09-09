import React from "react";
import { createRoot } from "react-dom/client";
import GameCollection from "../app/GameCollection";
import { createLocalGameClient } from "../lib/local-game-client";
import "../app/globals.css";
import "../app/community.css";
import "../app/investigation.css";
import "../app/curtain/curtain.css";

const client = createLocalGameClient();
createRoot(document.getElementById("root")!).render(
  <GameCollection client={client} />,
);
