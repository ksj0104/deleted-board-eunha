import React from "react";
import { createRoot } from "react-dom/client";
import Game from "../app/Game";
import { createLocalGameClient } from "../lib/local-game-client";
import "../app/globals.css";
import "../app/community.css";

const client = createLocalGameClient();
createRoot(document.getElementById("root")!).render(<Game client={client} />);
