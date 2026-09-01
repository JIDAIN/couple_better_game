// Generate PWA app icons:
// - Solid pink-orange gradient base (NO transparency, fills entire canvas)
// - Existing illustration zoomed 128% (larger subject, cropped transparent corners)
// - Subtle gradient tint overlay (ensures warm pink-orange tone)
// Result: no white circle + larger subject + consistent warm gradient feel
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "public", "icon-512.png");

const OUTPUTS = [
  { name: "icon-192.png", dir: "public", size: 192 },
  { name: "icon-512.png", dir: "public", size: 512 },
  { name: "apple-touch-icon.png", dir: "public", size: 180 },
  { name: "icon.png", dir: "app", size: 512 },
  { name: "apple-icon.png", dir: "app", size: 180 },
];

const SCALE = 1.28;
const TINT_OPACITY = 0.15;

function bgSvg(size, opacity) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFB6CB" stop-opacity="${opacity}"/>
      <stop offset="35%" stop-color="#FFBFBF" stop-opacity="${opacity}"/>
      <stop offset="70%" stop-color="#FFCCB0" stop-opacity="${opacity}"/>
      <stop offset="100%" stop-color="#FFD6A0" stop-opacity="${opacity}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
</svg>`;
}

async function generate() {
  const bgCache = new Map();
  const getBg = async (size, opacity = 1) => {
    const key = `bg-${size}-${opacity}`;
    if (bgCache.has(key)) return bgCache.get(key);
    const buf = await sharp(Buffer.from(bgSvg(size, opacity))).png().toBuffer();
    bgCache.set(key, buf);
    return buf;
  };

  for (const { name, dir, size } of OUTPUTS) {
    const scaledSize = Math.round(size * SCALE);
    const cropOffset = Math.round((scaledSize - size) / 2);

    // Zoom into the original art: scale up then center-crop
    // This crops out the old semi-transparent corners and enlarges the illustration
    const zoomedArt = await sharp(SOURCE)
      .resize(scaledSize, scaledSize, { fit: "fill", kernel: "lanczos3" })
      .extract({ left: cropOffset, top: cropOffset, width: size, height: size })
      .png()
      .toBuffer();

    // Build layers: solid bg → zoomed art → subtle gradient tint
    const baseBg = await getBg(size, 1);
    const tintOverlay = await getBg(size, TINT_OPACITY);

    await sharp(baseBg)
      .composite([
        { input: zoomedArt },
        { input: tintOverlay },
      ])
      .png()
      .toFile(path.join(ROOT, dir, name));

    console.log(`✓ ${dir}/${name} (${size}x${size})`);
  }

  console.log("\nAll icons generated!");
}

generate().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});