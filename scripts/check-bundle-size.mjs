import { gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve('.output/chrome-mv3');
const limits = [
  ['content-scripts/youtube.js', 150 * 1024],
  ['youtube-page.css', 35 * 1024],
  ['content-scripts/youtube.css', 35 * 1024],
];
let failed = false;
for (const [relativePath, limit] of limits) {
  const filePath = path.join(root, relativePath);
  const source = await readFile(filePath);
  const rawSize = (await stat(filePath)).size;
  const compressedSize = gzipSync(source).byteLength;
  console.log(`${relativePath}: ${(rawSize / 1024).toFixed(1)} KB raw, ${(compressedSize / 1024).toFixed(1)} KB gzip (limit ${(limit / 1024).toFixed(0)} KB)`);
  if (compressedSize > limit) failed = true;
}
if (failed) {
  console.error('Bundle-size budget exceeded.');
  process.exit(1);
}
