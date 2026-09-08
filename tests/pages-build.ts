import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";
import { communityImages } from "../lib/community";
import { episodes } from "../lib/cases";
import { LOCAL_SAVE_KEY } from "../lib/local-game-client";

const root = resolve("dist-pages");
const prefix = "/deleted-board-eunha/";
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".png": "image/png",
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
  for (const path of [
    ...Object.values(communityImages).map((asset) => asset.src),
    ...episodes.map(
      (episode) => `story/${String(episode.id).padStart(2, "0")}.webp`,
    ),
    "og.png",
  ]) {
    const imageResponse: Response = await fetch(new URL(path, pageUrl));
    assert.equal(imageResponse.status, 200, path);
    assert.match(imageResponse.headers.get("content-type")!, /image\/(webp|png)/);
    assert.ok((await imageResponse.arrayBuffer()).byteLength > 10000, path);
  }
  const source = await (await fetch(scripts[0].src)).text();
  parsed.window.close();
  let apiCalls = 0;
  const runtimeErrors: string[] = [];
  const boot = (save?: string) => {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", (error) =>
      runtimeErrors.push(error.message),
    );
    const dom = new JSDOM(html, {
      url: base,
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
  console.log(
    `PASS Pages: ${base} — HTML, CSS/JS, 14 game images, share image, production bundle start and browser save restoration; no API calls`,
  );
} finally {
  if (server.listening)
    await new Promise<void>((resolve) => server.close(() => resolve()));
}
