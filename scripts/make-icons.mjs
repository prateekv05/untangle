// One-off: renders PWA icons from the logo path onto an ink tile. Run: node scripts/make-icons.mjs
import sharp from "sharp";

const path = "M5 31C5 12 23 12 23 26C23 36 11 36 11 26C11 18 24 18 30 24L43 24";
const svg = (size, scale) => {
  const s = (size * scale) / 48;
  const off = (size - 48 * s) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#17142b"/><g transform="translate(${off} ${off}) scale(${s})" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></g></svg>`);
};
const jobs = [["icon-192", 192, 0.6], ["icon-512", 512, 0.6], ["maskable-512", 512, 0.45]];
for (const [name, size, scale] of jobs) await sharp(svg(size, scale)).png().toFile(`public/icons/${name}.png`);
