import { env } from "cloudflare:workers";
import {
  freshProgress,
  type Progress,
  applyAction,
  type Action,
} from "../lib/game";

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes?: number } }>;
}
interface Database {
  prepare(sql: string): Statement;
}
const schema =
  "CREATE TABLE IF NOT EXISTS game_saves (id TEXT PRIMARY KEY NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)";
async function database() {
  const db = (env as unknown as { DB: Database }).DB;
  if (!db)
    throw new Error("저장소에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.");
  await db.prepare(schema).run();
  return db;
}
export async function readProgress(id: string): Promise<Progress> {
  const db = await database();
  const row = await db
    .prepare("SELECT state FROM game_saves WHERE id = ?")
    .bind(id)
    .first<{ state: string }>();
  return row ? JSON.parse(row.state) : freshProgress();
}
export async function mutateProgress(id: string, action: Action) {
  const db = await database();
  await db
    .prepare(
      "INSERT OR IGNORE INTO game_saves (id, state, revision, updated_at) VALUES (?, ?, 0, ?)",
    )
    .bind(id, JSON.stringify(freshProgress()), new Date().toISOString())
    .run();
  for (let retry = 0; retry < 4; retry++) {
    const row = await db
      .prepare("SELECT state, revision FROM game_saves WHERE id = ?")
      .bind(id)
      .first<{ state: string; revision: number }>();
    if (!row) throw new Error("저장 기록을 찾을 수 없습니다.");
    const result = applyAction(JSON.parse(row.state), action);
    const update = await db
      .prepare(
        "UPDATE game_saves SET state = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
      )
      .bind(
        JSON.stringify(result.progress),
        new Date().toISOString(),
        id,
        row.revision,
      )
      .run();
    if (update.meta.changes === 1) return result;
  }
  throw new Error("다른 창에서 기록을 변경했습니다. 다시 시도해 주세요.");
}
