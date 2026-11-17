// Downloads the sample images and prints a thumbhash (base64) for each.
// Usage: node scripts/thumbhash.mjs   (from the example/ folder)
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';

const IDS = [10, 15, 20, 28, 29, 37, 42, 48, 57, 64, 65, 76, 82, 91, 96, 100];

const out = {};
for (const id of IDS) {
  const res = await fetch(`https://picsum.photos/id/${id}/1080/1920`);
  if (!res.ok) {
    console.error(`id ${id}: HTTP ${res.status}`);
    continue;
  }
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(100, 100, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hash = rgbaToThumbHash(info.width, info.height, data);
  out[id] = Buffer.from(hash).toString('base64');
}
console.log(JSON.stringify(out, null, 2));
