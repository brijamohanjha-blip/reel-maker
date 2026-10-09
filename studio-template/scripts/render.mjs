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
const music = reel.music ? join('public', reel.music.replace(/^\/+/, '').replace(/^public\//, '')) : null;
const hasMusic = music && existsSync(music);
console.log(hasAudio ? `Adding voiceover: ${audio}` : 'No voiceover file found: rendering without audio.');
if (hasMusic) console.log(`Adding music: ${music}`);

// Voice at full level; music is pre-leveled by make-music.mjs, so mix without normalizing.
const audioArgs = [];
if (hasAudio && hasMusic) {
  audioArgs.push('-i', audio, '-i', music, '-filter_complex', '[1:a][2:a]amix=inputs=2:duration=longest:normalize=0[a]', '-map', '0:v', '-map', '[a]');
} else if (hasAudio || hasMusic) {
  audioArgs.push('-i', hasAudio ? audio : music);
}
if (hasAudio || hasMusic) audioArgs.push('-c:a', 'aac', '-b:a', '192k');

execFileSync(
  ffmpeg,
  [
    '-v', 'error', '-y',
    '-framerate', '30', '-pattern_type', 'glob', '-i', join(framesDir, 'element-*.jpeg'),
    ...audioArgs,
    '-t', String(frameCount / 30),
    '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    outFile,
  ],
  {stdio: 'inherit'},
);
rmSync(framesDir, {recursive: true, force: true});
console.log(`Done: ${outFile}`);
