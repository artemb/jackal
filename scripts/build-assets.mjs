import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir } from "node:fs/promises";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "src/assets/source");
const tileDir = path.join(root, "src/assets/tiles");
const pieceDir = path.join(root, "src/assets/pieces");
const reviewDir = path.join(root, "asset-review/assets/production");
const tileSize = 512;
const outputSize = 256;

const atlases = {
  a: path.join(sourceDir, "tiles-a.png"),
  b: path.join(sourceDir, "tiles-b.png"),
  c: path.join(sourceDir, "tiles-c.png"),
};

async function writeTile(atlas, column, row, name, clearLowerArea = false) {
  const region = {
    left: column * tileSize,
    top: row * tileSize,
    width: tileSize,
    height: tileSize,
  };

  let image;
  if (clearLowerArea) {
    const fullTile = await sharp(atlas).extract(region).png().toBuffer();
    const clearStrip = await sharp(atlas)
      .extract({
        left: region.left + 20,
        top: region.top + 348,
        width: 472,
        height: 16,
      })
      .resize(472, 129, { fit: "fill" })
      .png()
      .toBuffer();

    // Stretch a clean strip from this same panel over the token samples while
    // preserving its original side and bottom borders.
    const cleanedTile = await sharp(fullTile)
      .composite([{ input: clearStrip, left: 20, top: 364 }])
      .png()
      .toBuffer();
    image = sharp(cleanedTile);
  } else {
    image = sharp(atlas).extract(region);
  }

  await image
    .resize(outputSize, outputSize, { kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 88, effort: 6 })
    .toFile(path.join(tileDir, `${name}.webp`));
}

const tileJobs = [
  [atlases.a, 0, 0, "jungle", true],
  [atlases.a, 1, 0, "desert", true],
  [atlases.a, 2, 0, "island", true],
  [atlases.a, 0, 1, "mountain", true],
  [atlases.a, 1, 1, "croc", true],
  [atlases.a, 2, 1, "rum", true],
  [atlases.b, 0, 0, "ice"],
  [atlases.b, 1, 0, "trap"],
  [atlases.b, 2, 0, "chute"],
  [atlases.b, 0, 1, "horse"],
  [atlases.b, 1, 1, "cannibal"],
  [atlases.b, 2, 1, "fort"],
  [atlases.c, 0, 0, "native"],
  [atlases.c, 1, 0, "cannon"],
  [atlases.c, 2, 0, "plane"],
  [atlases.c, 0, 1, "back"],
  [atlases.c, 2, 1, "empty"],
];

await Promise.all(tileJobs.map((job) => writeTile(...job)));

await sharp(atlases.c)
  .extract({ left: 562, top: 547, width: 412, height: 412 })
  .resize(128, 128, { kernel: sharp.kernel.lanczos3 })
  .webp({ quality: 90, effort: 6 })
  .toFile(path.join(tileDir, "coin.webp"));

const shipAtlas = path.join(sourceDir, "ships.png");
const shipSize = 627;
const ships = [
  [0, 0, "red"],
  [1, 0, "blue"],
  [0, 1, "green"],
  [1, 1, "yellow"],
];

await Promise.all(
  ships.map(([column, row, name]) =>
    sharp(shipAtlas)
      .extract({
        left: column * shipSize,
        top: row * shipSize,
        width: shipSize,
        height: shipSize,
      })
      .resize(outputSize, outputSize, { kernel: sharp.kernel.lanczos3 })
      .webp({ quality: 88, effort: 6 })
      .toFile(path.join(pieceDir, `ship-${name}.webp`)),
  ),
);

await mkdir(reviewDir, { recursive: true });
await Promise.all([
  cp(tileDir, path.join(reviewDir, "tiles"), { recursive: true, force: true }),
  cp(pieceDir, path.join(reviewDir, "pieces"), { recursive: true, force: true }),
]);

console.log(`Built ${tileJobs.length + ships.length + 1} game assets.`);
