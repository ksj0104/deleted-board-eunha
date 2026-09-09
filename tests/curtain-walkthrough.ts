import {
  curtainReducer,
  initialCurtainState,
  type CurtainAction,
  type CurtainState,
} from "../lib/curtain-game";
export function curtainThrough(chapter: number): CurtainState {
  let state = initialCurtainState();
  const act = (action: CurtainAction) => {
    state = curtainReducer(state, action);
  };
  for (let i = 0; i < 3; i++) act({ type: "intro" });
  if (chapter < 1) return state;
  for (const seat of ["front", "left", "booth"] as const) {
    act({ type: "patch", value: { seat, zoom: 2 } });
    act({ type: "observe" });
  }
  if (chapter < 2) return state;
  act({ type: "chapter", chapter: 2 });
  act({ type: "patch", value: { light: "work", scrim: false } });
  act({ type: "patch", value: { light: "back", scrim: true, chair: 52 } });
  act({ type: "check", puzzle: "shadow" });
  act({ type: "patch", value: { take: "b", offset: 1200 } });
  act({ type: "check", puzzle: "audio" });
  if (chapter < 3) return state;
  act({ type: "chapter", chapter: 3 });
  act({ type: "patch", value: { panel: 78 } });
  for (const node of ["rear", "chair", "wing"]) act({ type: "route", node });
  act({ type: "check", puzzle: "route" });
  act({
    type: "patch",
    value: { clasp: "seokyung", fragment: { x: 50, y: 50, angle: 0 } },
  });
  act({ type: "check", puzzle: "clasp" });
  for (const value of ["before", "after"] as const)
    act({ type: "costume", value });
  for (const value of [1, 2]) act({ type: "frame", value });
  if (chapter < 4) return state;
  act({ type: "chapter", chapter: 4 });
  act({ type: "patch", value: { sketch: { x: 50, y: 50, angle: 0 } } });
  act({ type: "check", puzzle: "sketch" });
  act({ type: "patch", value: { drawer: "window" } });
  act({ type: "peel", value: 100 });
  if (chapter < 5) return state;
  act({ type: "chapter", chapter: 5 });
  act({ type: "patch", value: { accused: "seokyung" } });
  act({ type: "check", puzzle: "final" });
  return state;
}
