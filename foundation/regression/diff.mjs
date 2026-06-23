// Real pixel-level image diff using pixelmatch + pngjs
// Usage: node diff.mjs <baseline.png> <current.png> [threshold]
// Exits 0 if diff < threshold%, 1 otherwise
// Outputs: numDiffPixels totalDiffPixels thresholdPct verdict
import fs from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [baselinePath, currentPath, thresholdStr] = process.argv.slice(2);
if (!baselinePath || !currentPath) {
  console.error('usage: node diff.mjs <baseline.png> <current.png> [threshold]');
  process.exit(2);
}
const threshold = parseFloat(thresholdStr || '0.5');  // percent

const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
const current  = PNG.sync.read(fs.readFileSync(currentPath));

if (baseline.width !== current.width || baseline.height !== current.height) {
  console.error(`size mismatch: ${baseline.width}x${baseline.height} vs ${current.width}x${current.height}`);
  process.exit(2);
}

const { width, height } = baseline;
const total = width * height;
const diff = new PNG({ width, height });
const numDiff = pixelmatch(baseline.data, current.data, diff.data, width, height, { threshold: 0.1 });
const pct = (numDiff / total) * 100;

console.log(`width=${width} height=${height} total=${total} numDiff=${numDiff} pct=${pct.toFixed(3)}% threshold=${threshold}%`);

if (pct > threshold) {
  // Write the diff image for inspection
  const outPath = currentPath.replace(/\.png$/, '.diff.png');
  fs.writeFileSync(outPath, PNG.sync.write(diff));
  console.log(`DIFF: ${pct.toFixed(3)}% > ${threshold}% (diff image: ${outPath})`);
  process.exit(1);
}
console.log(`PASS: ${pct.toFixed(3)}% <= ${threshold}%`);
process.exit(0);
