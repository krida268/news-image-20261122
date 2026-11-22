// The World in One Image - 22 November 2026.
// A front page drawn from scratch: the day's world news as one picture.
// Node 22, standard library only. No network, no clock, same bytes every run.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

const PAPER: RGB = [245, 239, 221];
const INK: RGB = [20, 20, 20];
const NAVY: RGB = [28, 42, 74];
const RED: RGB = [178, 34, 34];
const WHITE: RGB = [255, 255, 255];
const NIGHT: RGB = [14, 27, 51];
const RIDGE: RGB = [27, 44, 77];
const RIDGE2: RGB = [35, 54, 94];
const ROAD: RGB = [42, 42, 46];
const FLAME1: RGB = [255, 106, 0];
const FLAME2: RGB = [255, 180, 0];
const FLAME3: RGB = [255, 224, 102];
const SMOKE: RGB = [138, 143, 152];
const SEA: RGB = [47, 111, 178];
const LAND: RGB = [61, 158, 77];
const SUN: RGB = [255, 196, 0];
const CHART: RGB = [192, 57, 43];
const GRID: RGB = [216, 216, 216];
const SKYDAY: RGB = [201, 214, 232];
const BUILD: RGB = [58, 63, 74];
const LIGHT: RGB = [255, 220, 120];
const HILL: RGB = [46, 125, 62];
const BEAM: RGB = [255, 233, 168];
const MOON: RGB = [245, 239, 221];

// ---------- PNG encoding ----------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function pngEncode(px: Buffer): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    px.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- pixels ----------
const px = Buffer.alloc(W * H * 3);
function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}
function hline(x0: number, x1: number, y: number, c: RGB): void {
  for (let x = x0; x <= x1; x++) setPixel(x, y, c);
}
function vline(x: number, y0: number, y1: number, c: RGB): void {
  for (let y = y0; y <= y1; y++) setPixel(x, y, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let x = cx - dx; x <= cx + dx; x++) setPixel(x, cy + dy, c);
  }
}
function fillPoly(points: [number, number][], c: RGB): void {
  let minY = H;
  let maxY = 0;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) {
        xs.push(Math.round(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = xs[i]; x <= xs[i + 1]; x++) setPixel(x, y, c);
    }
  }
}

// ---------- 5x7 bitmap font ----------
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", "..#.."],
  ",": [".....", ".....", ".....", ".....", ".....", "..#..", ".#..."],
  ":": [".....", ".....", "..#..", ".....", ".....", "..#..", "....."],
  ";": [".....", ".....", "..#..", ".....", ".....", "..#..", ".#..."],
  "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#.##.", "#..##"],
  "&": [".###.", "#...#", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", ".###.", ".....", ".###.", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
};
function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const glyph = FONT[ch] ?? FONT[" "];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (glyph[row][col] === "#") fillRect(x + col * scale, y + row * scale, scale, scale, c);
    }
  }
}
function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}
function drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
  for (let i = 0; i < text.length; i++) {
    drawChar(x + i * 6 * scale, y, text[i], scale, c);
  }
}
function drawCentered(cx: number, y: number, text: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}
function wrapText(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur === "" ? w : cur + " " + w;
    if (textWidth(next, scale) <= maxWidth) {
      cur = next;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
function drawWrapped(x: number, y: number, text: string, maxWidth: number, scale: number, c: RGB): number {
  const lines = wrapText(text, maxWidth, scale);
  const step = 7 * scale + 3;
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * step, lines[i], scale, c);
  return lines.length;
}

// ---------- the front page ----------
function drawPage(): void {
  fillRect(0, 0, W, H, INK);
  fillRect(6, 6, W - 12, H - 12, PAPER);

  // Masthead.
  drawCentered(512, 28, "THE WORLD TODAY", 7, INK);
  fillRect(24, 86, 976, 2, INK);
  fillRect(24, 90, 976, 2, INK);

  // Date band.
  fillRect(16, 96, 992, 44, NAVY);
  drawCentered(512, 110, "SUNDAY, 22 NOVEMBER 2026", 3, WHITE);

  // Rule under the date band.
  fillRect(16, 152, 992, 2, INK);

  // ---- Lead story: the capture in Sinaloa ----
  drawText(24, 170, "EL CHAPO ISIDRO", 6, INK);
  drawText(24, 218, "CAPTURED", 6, INK);
  fillRect(24, 268, 534, 4, RED);
  drawWrapped(
    24,
    280,
    "MEXICO SEIZES FBI MOST-WANTED CARTEL BOSS IN SINALOA RAID",
    624,
    3,
    INK,
  );

  // Night raid scene.
  const sx = 24;
  const sy = 348;
  const sw = 624;
  const sh = 196;
  fillRect(sx, sy, sw, sh, NIGHT);
  const stars: [number, number][] = [
    [60, 366], [120, 356], [180, 372], [250, 358], [330, 368], [420, 356],
    [520, 366], [580, 356], [90, 396], [300, 392], [480, 398], [560, 388],
  ];
  for (const [x, y] of stars) fillRect(x, y, 2, 2, WHITE);
  fillCircle(600, 368, 18, MOON);
  fillCircle(594, 362, 4, GRID);
  fillCircle(606, 374, 3, GRID);
  fillPoly(
    [
      [sx, sy + sh],
      [sx + 180, sy + 74],
      [sx + 360, sy + sh],
    ],
    RIDGE,
  );
  fillPoly(
    [
      [sx + 280, sy + sh],
      [sx + 450, sy + 58],
      [sx + sw, sy + sh],
    ],
    RIDGE2,
  );
  // Searchlight beam from the helicopter.
  fillPoly(
    [
      [442, sy + 46],
      [418, sy + 152],
      [472, sy + 152],
    ],
    BEAM,
  );
  // Helicopter.
  fillRect(414, sy + 24, 64, 22, [10, 10, 12]);
  fillRect(478, sy + 30, 46, 8, [10, 10, 12]);
  fillRect(400, sy + 18, 100, 3, [10, 10, 12]);
  vline(524, sy + 22, sy + 38, [10, 10, 12]);
  fillCircle(446, sy + 35, 5, LIGHT);
  // Road.
  fillRect(sx, sy + 152, sw, 44, ROAD);
  for (let x = sx + 12; x < sx + sw; x += 44) fillRect(x, sy + 172, 22, 3, PAPER);
  // Burning truck.
  fillRect(120, sy + 108, 72, 40, [122, 31, 31]);
  fillRect(192, sy + 120, 40, 28, [90, 20, 20]);
  fillCircle(140, sy + 150, 8, [10, 10, 10]);
  fillCircle(210, sy + 150, 8, [10, 10, 10]);
  fillPoly(
    [
      [130, sy + 108],
      [150, sy + 62],
      [170, sy + 108],
    ],
    FLAME1,
  );
  fillPoly(
    [
      [150, sy + 108],
      [168, sy + 72],
      [186, sy + 108],
    ],
    FLAME2,
  );
  fillPoly(
    [
      [140, sy + 108],
      [158, sy + 82],
      [176, sy + 108],
    ],
    FLAME3,
  );
  fillCircle(150, sy + 52, 8, SMOKE);
  fillCircle(160, sy + 36, 10, SMOKE);
  fillCircle(148, sy + 18, 12, SMOKE);

  // ---- Right column: markets ----
  drawText(664, 172, "MARKETS SLIDE", 4, INK);
  fillRect(664, 206, 308, 4, RED);
  fillRect(664, 216, 336, 180, WHITE);
  fillRect(664, 216, 336, 2, INK);
  fillRect(664, 394, 336, 2, INK);
  fillRect(664, 216, 2, 180, INK);
  fillRect(998, 216, 2, 180, INK);
  for (const gy of [246, 276, 306, 336, 366]) hline(666, 998, gy, GRID);
  const pts: [number, number][] = [
    [692, 252], [726, 270], [760, 260], [794, 298], [828, 288],
    [862, 326], [896, 316], [930, 352], [964, 342],
  ];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    line(x0, y0, x1, y1, CHART);
    line(x0 + 1, y0, x1 + 1, y1, CHART);
    line(x0, y0 + 1, x1, y1 + 1, CHART);
  }
  for (const [x, y] of pts) fillCircle(x, y, 4, CHART);
  drawText(664, 408, "S&P 500 -3.7%", 3, INK);
  drawText(664, 436, "NIKKEI -5.1%", 3, INK);
  drawWrapped(664, 466, "AI STOCKS LEAD GLOBAL SELL-OFF", 336, 2, INK);

  fillRect(16, 556, 992, 2, INK);

  // ---- Middle row: COP31 ----
  drawText(24, 570, "COP31 PAST DEADLINE", 3, INK);
  fillRect(24, 598, 321, 4, RED);
  drawWrapped(24, 610, "ANTALYA SUMMIT DEADLOCKED OVER FOSSIL FUELS", 476, 3, INK);
  fillRect(24, 664, 476, 140, SKYDAY);
  fillCircle(160, 734, 50, SEA);
  fillCircle(150, 712, 14, LAND);
  fillCircle(185, 745, 12, LAND);
  fillCircle(160, 752, 10, LAND);
  fillCircle(195, 715, 8, LAND);
  fillCircle(160, 696, 9, WHITE);
  fillCircle(430, 692, 20, SUN);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    const x0 = 430 + Math.round(28 * Math.cos(ang));
    const y0 = 692 + Math.round(28 * Math.sin(ang));
    const x1 = 430 + Math.round(40 * Math.cos(ang));
    const y1 = 692 + Math.round(40 * Math.sin(ang));
    line(x0, y0, x1, y1, SUN);
  }
  fillPoly(
    [
      [24, 804],
      [24, 782],
      [250, 770],
      [500, 784],
      [500, 804],
    ],
    HILL,
  );

  // ---- Middle row: Kryvyi Rih ----
  drawText(524, 570, "MISSILE HITS KRYVYI RIH", 3, INK);
  fillRect(524, 598, 411, 4, RED);
  drawWrapped(524, 610, "2 KILLED, 60 WOUNDED IN ZELENSKY'S HOMETOWN", 476, 3, INK);
  fillRect(524, 664, 476, 140, SKYDAY);
  const towers: [number, number, number, number][] = [
    [540, 724, 58, 80], [606, 706, 48, 98], [662, 734, 66, 70],
    [736, 712, 54, 92], [798, 726, 60, 78], [866, 708, 56, 96], [930, 730, 70, 74],
  ];
  for (const [x, y, w, h] of towers) fillRect(x, y, w, h, BUILD);
  for (const [x, y] of [[556, 740], [576, 760], [620, 720], [640, 750], [752, 730], [812, 742], [880, 724], [946, 748]]) {
    fillRect(x, y, 6, 8, LIGHT);
  }
  fillCircle(695, 720, 9, SMOKE);
  fillCircle(700, 700, 12, SMOKE);
  fillCircle(692, 680, 8, SMOKE);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    line(
      695, 728,
      695 + Math.round(18 * Math.cos(ang)),
      728 + Math.round(18 * Math.sin(ang)),
      FLAME1,
    );
  }
  fillCircle(695, 728, 10, FLAME1);
  fillCircle(695, 728, 6, FLAME2);
  fillRect(524, 800, 476, 4, INK);

  fillRect(16, 812, 992, 2, INK);

  // ---- Also in the news ----
  drawText(24, 828, "ALSO IN THE NEWS", 2, INK);
  const also: string[] = [
    "PERU M6.9 QUAKE SHAKES ANDES - NO CASUALTIES REPORTED",
    "UK AND EU AGREE 100,000-A-YEAR YOUTH MOBILITY DEAL",
    "SINALOA RAID LEAVES 11 DEAD - GUNMEN BURN TRUCKS",
  ];
  for (let i = 0; i < also.length; i++) {
    const y = 856 + i * 26;
    fillRect(24, y + 3, 8, 8, RED);
    drawText(40, y, also[i], 2, INK);
  }

  fillRect(16, 952, 992, 2, INK);
  drawCentered(512, 970, "THE WORLD IN ONE IMAGE - 22 NOVEMBER 2026", 2, INK);
}

function main(): void {
  drawPage();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const png = pngEncode(px);
  writeFileSync(join(outDir, "entry.png"), png);
  console.log(`wrote ${join(outDir, "entry.png")} (${png.length} bytes, ${W}x${H})`);
}

main();
