// Regenerates public/icons/*.png from src/assets/pwa/icon-source.svg.
// Run with: node scripts/generate-pwa-icons.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(root, "..", "src", "assets", "pwa", "icon-source.svg");
const outDir = path.join(root, "..", "public", "icons");
const svg = readFileSync(svgPath);

const targets = [
  { file: "pwa-192x192.png", size: 192 },
  { file: "pwa-512x512.png", size: 512 },
  { file: "maskable-icon-512x512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, file));
  console.log(`wrote ${file} (${size}x${size})`);
}
