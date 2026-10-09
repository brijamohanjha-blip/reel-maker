// Tile rendered still frames into one image with the 120px safe margins drawn in red.
// Usage: node scripts/contact-sheet.mjs <frames dir> <out.png>
import {execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import ffmpeg from 'ffmpeg-static';

const [dir, out] = process.argv.slice(2);
const n = readdirSync(dir).filter((f) => /\.(png|jpe?g)$/.test(f)).length;
const cols = Math.min(n, 6);
const rows = Math.ceil(n / cols);
execFileSync(ffmpeg, [
  '-v', 'error', '-y',
  '-pattern_type', 'glob', '-i', join(dir, '*.png'),
  '-vf',
  `drawbox=x=0:y=120:w=iw:h=4:color=red:t=fill,drawbox=x=0:y=ih-124:w=iw:h=4:color=red:t=fill,scale=360:-1,pad=iw+8:ih+8:4:4:white,tile=${cols}x${rows}`,
  '-frames:v', '1', out,
]);
console.log(`${n} frames -> ${out}`);
