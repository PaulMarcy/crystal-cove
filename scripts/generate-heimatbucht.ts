/**
 * Generator for the Heimatbucht placeholder assets (M2):
 *   public/assets/tilesets/heimatbucht.png  — self-made 6-tile placeholder tileset
 *   public/assets/maps/heimatbucht.json     — Tiled-JSON map (3 zones + collision)
 *
 * Deterministic — rerun via `npx tsx scripts/generate-heimatbucht.ts` after
 * layout changes. No third-party assets involved (see ASSETS.md).
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- PNG writer

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode raw RGBA pixels as a PNG file. */
function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba
      .subarray(y * width * 4, (y + 1) * width * 4)
      .forEach((v, i) => (raw[y * (1 + width * 4) + 1 + i] = v));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ Tileset

const TILE = 16;
/** [base, accent] hex colors per tile — palette anchors from docs/04. */
const tiles: Array<[string, string]> = [
  ['#ECD9A3', '#D9C286'], // 0 sand (Strand)
  ['#8FBF6F', '#7FAF5F'], // 1 grass (Wiese)
  ['#6FA357', '#5F934B'], // 2 dark grass (Waldrand ground)
  ['#79BFD1', '#5FA8BE'], // 3 water — collides
  ['#8FBF6F', '#8A8378'], // 4 rock on grass — collides
  ['#6FA357', '#3F6B33'], // 5 tree on dark grass — collides
];

function hex(c: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
}

const tilesetW = tiles.length * TILE;
const px = new Uint8Array(tilesetW * TILE * 4);
tiles.forEach(([baseHex, accentHex], t) => {
  const base = hex(baseHex);
  const accent = hex(accentHex);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      // Rock/tree: filled blob in the middle; others: sparse texture speckles.
      const blob = t >= 4 && Math.hypot(x - 7.5, y - (t === 5 ? 6.5 : 8.5)) < (t === 5 ? 6 : 5);
      const speckle = (x * 7 + y * 13 + t * 5) % 11 === 0;
      const [r, g, b] = blob || speckle ? accent : base;
      const o = ((t * TILE + x) + y * tilesetW) * 4;
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = b;
      px[o + 3] = 255;
    }
  }
});

// ---------------------------------------------------------------------- Map

const W = 40;
const H = 30;
// GIDs are tile index + 1 (Tiled firstgid = 1).
const SAND = 1;
const GRASS = 2;
const DARK = 3;
const WATER = 4;
const ROCK = 5;
const TREE = 6;

const ground: number[] = [];
const rocks = new Set(['10,9', '11,9', '25,13', '26,14', '8,16', '31,7']);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let gid: number;
    if (y <= 2) gid = TREE; // Waldrand tree wall
    else if (y <= 4) gid = (x === 0 || x === W - 1) ? TREE : DARK;
    else if (y <= 19) {
      if (x === 0 || x === W - 1) gid = ROCK; // rocky side frame
      else gid = rocks.has(`${x},${y}`) ? ROCK : GRASS;
    } else if (y <= 24) gid = SAND;
    else gid = WATER;
    ground.push(gid);
  }
}

const collides = (id: number) => ({
  id,
  properties: [{ name: 'collides', type: 'bool', value: true }],
});

const map = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  width: W,
  height: H,
  tilewidth: TILE,
  tileheight: TILE,
  nextlayerid: 3,
  nextobjectid: 4,
  tilesets: [
    {
      firstgid: 1,
      name: 'heimatbucht',
      image: '../tilesets/heimatbucht.png',
      imagewidth: tilesetW,
      imageheight: TILE,
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: tiles.length,
      columns: tiles.length,
      margin: 0,
      spacing: 0,
      tiles: [collides(3), collides(4), collides(5)],
    },
  ],
  layers: [
    {
      id: 1,
      type: 'tilelayer',
      name: 'ground',
      width: W,
      height: H,
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      data: ground,
    },
    {
      id: 2,
      type: 'objectgroup',
      name: 'zones',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      objects: [
        { id: 1, name: 'waldrand', type: 'zone', x: 0, y: 0, width: W * TILE, height: 5 * TILE, rotation: 0, visible: true },
        { id: 2, name: 'wiese', type: 'zone', x: 0, y: 5 * TILE, width: W * TILE, height: 15 * TILE, rotation: 0, visible: true },
        { id: 3, name: 'strand', type: 'zone', x: 0, y: 20 * TILE, width: W * TILE, height: 5 * TILE, rotation: 0, visible: true },
      ],
    },
  ],
};

// -------------------------------------------------------------------- Write

mkdirSync(join(root, 'public/assets/tilesets'), { recursive: true });
mkdirSync(join(root, 'public/assets/maps'), { recursive: true });
writeFileSync(join(root, 'public/assets/tilesets/heimatbucht.png'), encodePng(tilesetW, TILE, px));
writeFileSync(join(root, 'public/assets/maps/heimatbucht.json'), JSON.stringify(map, null, 2) + '\n');
console.log('Heimatbucht assets written to public/assets/.');
