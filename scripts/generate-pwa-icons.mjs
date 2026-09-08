// Regenerates public/favicon.png and public/icons/*.png from src/assets/jil-icon.png.
// Run with: node scripts/generate-pwa-icons.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(root, "..", "src", "assets", "jil-icon.png");
const outDir = path.join(root, "..", "public", "icons");
const publicDir = path.join(root, "..", "public");
const source = readFileSync(sourcePath);

const targets = [
  { file: "pwa-192x192.png", size: 192, dir: outDir },
  { file: "pwa-512x512.png", size: 512, dir: outDir },
  { file: "maskable-icon-512x512.png", size: 512, dir: outDir },
  { file: "apple-touch-icon.png", size: 180, dir: outDir },
  { file: "favicon.png", size: 64, dir: publicDir },
];

for (const { file, size, dir } of targets) {
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(path.join(dir, file));
  console.log(`wrote ${file} (${size}x${size})`);
}
