import fs from "node:fs";
import sharp from "sharp";
const assets = JSON.parse(
  fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""),
);
async function run() {
  for (const a of assets) {
    const directory = a.directory || "community";
    fs.mkdirSync(`public/${directory}`, { recursive: true });
    const result = await sharp(a.source)
      .resize({ width: 1536, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(`public/${directory}/${a.key}.webp`);
    console.log(a.key, result.size);
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
