/** Build application icons from the editable OfferMe SVG master. */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const mark = await loadImage(readFileSync(join(root, 'brand/mark.svg')));
const symbol = await loadImage(readFileSync(join(root, 'brand/symbol.svg')));
function png(image, size) {
  const canvas = createCanvas(size, size);
  canvas.getContext('2d').drawImage(image, 0, 0, size, size);
  return canvas.toBuffer('image/png');
}
mkdirSync(join(root, 'src/public/brand'), { recursive: true });
copyFileSync(join(root, 'brand/mark.svg'), join(root, 'src/public/brand/mark.svg'));
writeFileSync(join(root, 'build/icon.png'), png(mark, 1024));
for (const [name, size, source] of [['tray',32,mark],['tray@2x',64,mark],['trayTemplate',22,symbol],['trayTemplate@2x',44,symbol]]) {
  writeFileSync(join(root, `resources/tray/${name}.png`), png(source, size));
}
const image = png(mark, 256);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1,2); ico.writeUInt16LE(1,4); ico.writeUInt16LE(1,10); ico.writeUInt16LE(32,12);
ico.writeUInt32LE(image.length,14); ico.writeUInt32LE(22,18);
writeFileSync(join(root,'build/icon.ico'), Buffer.concat([ico,image]));
// PNG-backed ICNS entries avoid external icon conversion tools.
const chunks = [[128, 'ic07'], [256, 'ic08'], [512, 'ic09'], [1024, 'ic10']].map(([size, type]) => {
  const data = png(mark, size);
  const header = Buffer.alloc(8); header.write(type); header.writeUInt32BE(data.length + 8, 4);
  return Buffer.concat([header, data]);
});
const header = Buffer.alloc(8); header.write('icns'); header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
writeFileSync(join(root, 'build/icon.icns'), Buffer.concat([header, ...chunks]));
await import('./build-brand-preview.mjs');
console.log('Built OfferMe SVG, transparent PNG, brand sheet, ICO, tray and macOS ICNS assets.');
