import { cookies } from "next/headers";
import { readProgress, mutateProgress } from "../../../db/store";
import { gameView, type Action } from "../../../lib/game";

export const dynamic = "force-dynamic";
async function session() {
  const jar = await cookies();
  const existing = jar.get("board_session")?.value;
  if (existing && /^[a-f0-9-]{36}$/.test(existing))
    return { id: existing, fresh: false };
  return { id: crypto.randomUUID(), fresh: true };
}
function response(
  data: unknown,
  request: Request,
  s: { id: string; fresh: boolean },
  status = 200,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (s.fresh)
    headers["Set-Cookie"] =
      `board_session=${s.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  return new Response(JSON.stringify(data), { status, headers });
}
export async function GET(request: Request) {
  const s = await session();
  try {
    return response(gameView(await readProgress(s.id)), request, s);
  } catch (error) {
    console.error("Game load failed", error);
    return response(
      { error: "기록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요." },
      request,
      s,
      503,
    );
  }
}
export async function POST(request: Request) {
  const s = await session();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return response(
      { error: "요청 출처를 확인할 수 없습니다." },
      request,
      s,
      403,
    );
  try {
    const text = await request.text();
    if (text.length > 12000)
      return response({ error: "요청이 너무 큽니다." }, request, s, 413);
    let action: Action;
    try {
      action = JSON.parse(text);
    } catch {
      return response({ error: "요청 형식을 확인해 주세요." }, request, s, 400);
    }
    if (
      !action ||
      typeof action !== "object" ||
      typeof action.type !== "string"
    )
      return response({ error: "요청 형식을 확인해 주세요." }, request, s, 400);
    const { progress, feedback } = await mutateProgress(s.id, action);
    return response({ ...gameView(progress), feedback }, request, s);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "저장하지 못했습니다. 다시 시도해 주세요.";
    console.error("Game action failed", error);
    return response({ error: message }, request, s, 400);
  }
}
