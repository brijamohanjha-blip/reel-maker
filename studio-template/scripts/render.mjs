// Render a Reel: node scripts/render.mjs reels/<name>.json  ->  out/<name>.mp4
//
// Remotion's bundled ffmpeg needs macOS 15+, so on older macOS `remotion render` fails while encoding.
// This script lets Remotion render an image sequence, then encodes it (and the voiceover, if present)
// with ffmpeg-static, which runs on older macOS too.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {basename, join} from 'node:path';
import ffmpeg from 'ffmpeg-static';

const reelPath = process.argv[2];
if (!reelPath) {
  console.error('Usage: node scripts/render.mjs reels/<name>.json');
  process.exit(1);
}
const name = basename(reelPath, '.json');
const reel = JSON.parse(readFileSync(reelPath, 'utf8'));
const framesDir = join('out', `frames_${name}`);
const outFile = join('out', `${name}.mp4`);

rmSync(framesDir, {recursive: true, force: true});
mkdirSync(framesDir, {recursive: true});

execFileSync(
  'npx',
  ['remotion', 'render', 'Reel', framesDir, '--sequence', '--image-format=jpeg', '--jpeg-quality=92', `--props=${reelPath}`],
  {stdio: 'inherit'},
);

const frameCount = readdirSync(framesDir).filter((f) => f.endsWith('.jpeg')).length;
const audio = reel.audio ? join('public', reel.audio.replace(/^\/+/, '').replace(/^public\//, '')) : null;
const hasAudio = audio && existsSync(audio);
console.log(hasAudio ? `Adding voiceover: ${audio}` : 'No voiceover file found: rendering without audio.');

execFileSync(
  ffmpeg,
  [
    '-v', 'error', '-y',
    '-framerate', '30', '-pattern_type', 'glob', '-i', join(framesDir, 'element-*.jpeg'),
    ...(hasAudio ? ['-i', audio, '-c:a', 'aac', '-b:a', '192k'] : []),
    '-t', String(frameCount / 30),
    '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    outFile,
  ],
  {stdio: 'inherit'},
);
rmSync(framesDir, {recursive: true, force: true});
console.log(`Done: ${outFile}`);
