// Download the chosen stock candidates (Pexels or Pixabay) and convert them into the Reel's clips.
// Usage: node scripts/pick-clips.mjs <slug> <scene>=<candidate>[@left|@right] [...]   e.g. 1=2 2=1 3=4@left
// @left / @right (or a fraction like @0.3, 0 = left edge, 1 = right edge) choose which part of a landscape clip
// survives the 9:16 crop (default: centre).
//
// Reads jobs/<slug>/candidates.json (from find-clips.mjs). For each pick, downloads the smallest file that still
// gives a sharp 1080x1920 frame (portrait ≥1080 wide, or landscape ≥2160 tall, centre-cropped), converts it to
// 1080x1920, 30 fps, H.264, no audio, and saves it as
// public/jobs/<slug>/clips/scene-<scene>.mp4. Photographer credits go to jobs/<slug>/credits.txt.
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const [slug, ...pairs] = process.argv.slice(2);
if (!slug || !pairs.length) {
  console.error('Usage: node scripts/pick-clips.mjs <slug> <scene>=<candidate> ...');
  process.exit(1);
}
const candidates = JSON.parse(readFileSync(`jobs/${slug}/candidates.json`, 'utf8'));
const clipDir = `public/jobs/${slug}/clips`;
mkdirSync(clipDir, {recursive: true});

const creditsFile = `jobs/${slug}/credits.txt`;
let credits = {};
try {
  credits = JSON.parse(readFileSync(`${creditsFile}.json`, 'utf8'));
} catch {}

for (const pair of pairs) {
  const [scenePart, pickPart] = pair.split('=');
  const [nPart, anchor = 'center'] = pickPart.split('@');
  const scene = Number(scenePart);
  const n = Number(nPart);
  const fraction = {left: 0, center: 0.5, right: 1}[anchor] ?? Number(anchor);
  if (!(fraction >= 0 && fraction <= 1)) throw new Error(`Unknown crop anchor "@${anchor}" for scene ${scene}: use @left, @right or 0-1.`);
  const cropX = `(in_w-out_w)*${fraction}`;
  const c = candidates[scene]?.find((x) => x.n === n);
  if (!c) throw new Error(`No candidate #${n} for scene ${scene}. Run find-clips.mjs first or check the numbers.`);
  const sharp = c.files
    .filter((f) => (f.height > f.width ? f.width >= 1080 : f.height >= 2160))
    .sort((a, b) => a.width * a.height - b.width * b.height);
  const file = sharp[0] ?? [...c.files].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const tmp = `${clipDir}/.download-${scene}.mp4`;
  const res = await fetch(file.link);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for scene ${scene}`);
  writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  execFileSync(ffmpeg, [
    '-v', 'error', '-y', '-i', tmp, '-an',
    '-vf', `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:${cropX}:(in_h-out_h)/2,fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart',
    `${clipDir}/scene-${scene}.mp4`,
  ]);
  rmSync(tmp);
  credits[scene] = `Scene ${scene}: video by ${c.author} on ${c.source ?? 'Pexels'}, ${c.url}`;
  console.log(`scene-${scene}.mp4 <- #${n}${anchor === 'center' ? '' : '@' + anchor} (${file.width}x${file.height}, ${Math.round(c.duration)}s) by ${c.author}`);
}

writeFileSync(`${creditsFile}.json`, JSON.stringify(credits, null, 1));
writeFileSync(creditsFile, Object.keys(credits).sort((a, b) => a - b).map((k) => credits[k]).join('\n') + '\n');
console.log(`Credits: ${creditsFile}`);
