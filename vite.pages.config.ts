import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const path = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));
const repository =
  process.env.GITHUB_REPOSITORY ?? "ksj0104/deleted-board-eunha";
const [owner, name] = repository.split("/");
const publicUrl = `https://${owner}.github.io/${name === `${owner}.github.io` ? "" : `${name}/`}`;

export default defineConfig({
  root: path("./static"),
  publicDir: path("./public"),
  base: "./",
  plugins: [
    react(),
    {
      name: "pages-public-url",
      transformIndexHtml: {
        order: "pre",
        handler: (html) => html.replaceAll("%VITE_PUBLIC_URL%", publicUrl),
      },
    },
  ],
  build: { outDir: path("./dist-pages"), emptyOutDir: true },
});
