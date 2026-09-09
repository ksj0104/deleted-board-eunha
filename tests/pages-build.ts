import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";
import { communityImages } from "../lib/community";
import { inspectionCaptures } from "../lib/calibration";
import { episodes } from "../lib/cases";
import { LOCAL_SAVE_KEY } from "../lib/local-game-client";
import { documentScans } from "../lib/document-scans";
import { CURTAIN_SAVE_KEY } from "../lib/curtain-game";
import { curtainThrough } from "./curtain-walkthrough";

const root = resolve("dist-pages");
const prefix = "/deleted-board-eunha/";
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".png": "image/png",
  ".wav": "audio/wav",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url!, "http://localhost").pathname;
    assert.ok(pathname.startsWith(prefix));
    const file = resolve(
      root,
      decodeURIComponent(pathname.slice(prefix.length)) || "index.html",
    );
    assert.ok(file.startsWith(root + sep));
    const bytes = await readFile(file);
    response.writeHead(200, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
    });
    response.end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});

async function ready(check: () => boolean, label: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  assert.fail(label);
}

try {
  let base = process.env.GAME_PAGES_URL;
  if (!base) {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}${prefix}`;
  }
  const pageUrl = new URL(base);
  const response = await fetch(pageUrl);
  assert.equal(response.status, 200);
  assert.equal(
    new URL(response.url).origin,
    pageUrl.origin,
    "no login redirect",
  );
  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /삭제된 게시판/);
  assert.doesNotMatch(html, /%VITE_PUBLIC_URL%/);
  const parsed = new JSDOM(html, { url: base });
  const scripts = [
    ...parsed.window.document.querySelectorAll<HTMLScriptElement>(
      'script[type="module"][src]',
    ),
  ];
  assert.equal(scripts.length, 1);
  const stylesheet = parsed.window.document.querySelector<HTMLLinkElement>(
    'link[rel="stylesheet"]',
  );
  assert.ok(stylesheet);
  const assets = [scripts[0].src, stylesheet.href];
  for (const asset of assets) {
    const url = new URL(asset);
    assert.equal(url.origin, pageUrl.origin);
    assert.ok(
      url.pathname.startsWith(pageUrl.pathname),
      "assets stay under the project URL",
    );
    const resource = await fetch(url);
    assert.equal(resource.status, 200, asset);
    assert.match(resource.headers.get("content-type")!, /javascript|text\/css/);
    assert.ok((await resource.arrayBuffer()).byteLength > 1000);
  }
  const imagePaths = [
    ...Object.values(communityImages).map((asset) => asset.src),
    ...inspectionCaptures.map((frame) => frame.src),
    ...Object.values(documentScans).flatMap((pages) =>
      pages.map((page) => page.src),
    ),
    ...episodes.flatMap((episode) =>
      episode.records.flatMap((record) =>
        record.shredded
          ? [
              record.shredded.scan!.src,
              ...record.shredded.pieces.map((piece) => piece.src!),
            ]
          : [],
      ),
    ),
    ...episodes.map(
      (episode) => `story/${String(episode.id).padStart(2, "0")}.webp`,
    ),
    ...episodes.flatMap((episode) =>
      episode.records.flatMap(
        (record) => record.surveillance?.frames.map((frame) => frame.src) ?? [],
      ),
    ),
    "og.png",
    "curtain/stage.png",
    "curtain/backstage.png",
    "curtain/props.png",
  ];
  for (const path of imagePaths) {
    const imageResponse: Response = await fetch(new URL(path, pageUrl));
    assert.equal(imageResponse.status, 200, path);
    assert.match(
      imageResponse.headers.get("content-type")!,
      /image\/(webp|png)/,
    );
    assert.ok((await imageResponse.arrayBuffer()).byteLength > 10000, path);
  }
  for (const name of ["a", "b", "c", "recording"]) {
    const resource = await fetch(new URL(`curtain/${name}.wav`, pageUrl));
    assert.equal(resource.status, 200);
    const bytes = new Uint8Array(await resource.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
    assert.ok(bytes.length > 90000);
  }
  const source = await (await fetch(scripts[0].src)).text();
  parsed.window.close();
  let apiCalls = 0;
  const runtimeErrors: string[] = [];
  const boot = (save?: string, curtainSave?: string, hash = "") => {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", (error) =>
      runtimeErrors.push(error.message),
    );
    const dom = new JSDOM(html, {
      url: new URL(hash, base).href,
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole,
    });
    dom.window.structuredClone = structuredClone;
    dom.window.fetch = async () => {
      apiCalls++;
      throw new Error("Static game must not call an API");
    };
    dom.window.HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    dom.window.HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
    if (save) dom.window.localStorage.setItem(LOCAL_SAVE_KEY, save);
    if (curtainSave)
      dom.window.localStorage.setItem(CURTAIN_SAVE_KEY, curtainSave);
    dom.window.eval(source);
    return dom;
  };
  const first = boot();
  try {
    await ready(
      () => !!first.window.document.querySelector(".story-prologue"),
      "production bundle opens the prologue",
    );
    const button = [...first.window.document.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("첫 번째 기록 열기"),
    );
    assert.ok(button);
    const scene =
      first.window.document.querySelector<HTMLImageElement>(".story-scene img");
    assert.equal(scene?.src, new URL("story/01.webp", base).href);
    button.click();
    await ready(
      () => !!first.window.localStorage.getItem(LOCAL_SAVE_KEY),
      "production bundle saves in this browser",
    );
    const save = first.window.localStorage.getItem(LOCAL_SAVE_KEY)!;
    assert.equal(JSON.parse(save).started, true);
    const reopened = boot(save);
    try {
      await ready(
        () => !!reopened.window.document.querySelector(".community-board"),
        "production bundle restores saved play",
      );
      assert.equal(
        reopened.window.document.querySelector(".story-prologue"),
        null,
      );
      assert.equal(reopened.window.localStorage.getItem(LOCAL_SAVE_KEY), save);
      assert.equal(apiCalls, 0);
      assert.deepEqual(runtimeErrors, []);
    } finally {
      reopened.window.close();
    }
  } finally {
    first.window.close();
  }
  const curtain = boot(undefined, undefined, "#curtain-call");
  try {
    await ready(
      () => !!curtain.window.document.querySelector(".cc-intro"),
      "second game boots at its shared hash URL",
    );
    assert.equal(
      curtain.window.document.querySelector<HTMLImageElement>(".cc-intro > img")
        ?.src,
      new URL("curtain/stage.png", base).href,
    );
    for (const label of [
      "카메라 켜기",
      "마지막 장면 확인하기",
      "내가 찍은 장면 조사하기",
    ]) {
      const button = [
        ...curtain.window.document.querySelectorAll("button"),
      ].find((b) => b.textContent?.includes(label));
      assert.ok(button, label);
      button.click();
      await ready(
        () =>
          !curtain.window.document.querySelector(".cc-intro") ||
          ![...curtain.window.document.querySelectorAll("button")].some((b) =>
            b.textContent?.includes(label),
          ),
        label,
      );
    }
    const save = curtain.window.localStorage.getItem(CURTAIN_SAVE_KEY)!;
    assert.equal(JSON.parse(save).started, true);
    assert.equal(curtain.window.localStorage.getItem(LOCAL_SAVE_KEY), null);
    const reopened = boot(undefined, save, "#curtain-call");
    try {
      await ready(
        () => !!reopened.window.document.querySelector(".cc-viewfinder"),
        "second game restores the first investigation",
      );
      assert.equal(
        reopened.window.localStorage.getItem(CURTAIN_SAVE_KEY),
        save,
      );
    } finally {
      reopened.window.close();
    }
    const solved = { ...curtainThrough(5), ending: "voices" };
    const end = boot(
      "preserved board save",
      JSON.stringify(solved),
      "#curtain-call",
    );
    try {
      await ready(
        () => !!end.window.document.querySelector(".cc-ending"),
        "production restores a finished second game",
      );
      const other = [...end.window.document.querySelectorAll("button")].find(
        (b) => b.textContent?.includes("다른 작별 보기"),
      );
      assert.ok(other);
      other.click();
      await ready(
        () =>
          end.window.document.querySelector(".cc-ending h1")?.textContent ===
          "무대의 이름들",
        "both epilogues work in the production bundle",
      );
      assert.equal(
        end.window.localStorage.getItem(LOCAL_SAVE_KEY),
        "preserved board save",
      );
      assert.equal(apiCalls, 0);
      assert.deepEqual(runtimeErrors, []);
    } finally {
      end.window.close();
    }
  } finally {
    curtain.window.close();
  }
  console.log(
    `PASS Pages: ${base} — HTML, CSS/JS, ${imagePaths.length - 1} game images, four WAV files, share image; both games boot and restore isolated saves, Curtain epilogues work; no API calls`,
  );
} finally {
  if (server.listening)
    await new Promise<void>((resolve) => server.close(() => resolve()));
}
