// Download chosen stock candidates (videos or photos) and convert them into the Reel's shots.
// Usage: node scripts/pick-clips.mjs <slug> <shot>=<candidate>[@left|@right|@0-1] [...]   e.g. 1=2 2a=1 2b=4@0.3
// @left / @right (or a fraction, 0 = left edge, 1 = right edge) choose which part survives the 9:16 crop (default: centre).
//
// Reads jobs/<slug>/candidates.json (from find-clips.mjs). Videos: downloads the smallest file that still gives a sharp
// 1080x1920 frame, converts to 1080x1920, 30 fps, H.264, no audio → public/jobs/<slug>/clips/scene-<shot>.mp4.
// Photos: downloads the largest available size, crops to 1080x1920 → public/jobs/<slug>/clips/scene-<shot>.jpg.
// Creator credits go to jobs/<slug>/credits.txt.
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const [slug, ...pairs] = process.argv.slice(2);
if (!slug || !pairs.length) {
  console.error('Usage: node scripts/pick-clips.mjs <slug> <shot>=<candidate>[@anchor] ...');
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
  const [shot, pickPart = ''] = pair.split('=');
  const [nPart, anchor = 'center'] = pickPart.split('@');
  const n = Number(nPart);
  const fraction = {left: 0, center: 0.5, right: 1}[anchor] ?? Number(anchor);
  if (!(fraction >= 0 && fraction <= 1)) throw new Error(`Unknown crop anchor "@${anchor}" for shot ${shot}: use @left, @right or 0-1.`);
  const c = candidates[shot]?.find((x) => x.n === n);
  if (!c) throw new Error(`No candidate #${n} for shot ${shot}. Run find-clips.mjs first or check the numbers.`);
  const crop = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(in_w-out_w)*${fraction}:(in_h-out_h)/2`;

  let file;
  if (c.kind === 'photo') {
    file = [...c.files].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  } else {
    const sharp = c.files.filter((f) => (f.height > f.width ? f.width >= 1080 : f.height >= 2160)).sort((a, b) => a.width * a.height - b.width * b.height);
    file = sharp[0] ?? [...c.files].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  }
  const tmp = `${clipDir}/.download-${shot}`;
  const res = await fetch(file.link);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for shot ${shot}`);
  writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));

  // One file per shot: remove the other format if a previous pick used it.
  rmSync(`${clipDir}/scene-${shot}.mp4`, {force: true});
  rmSync(`${clipDir}/scene-${shot}.jpg`, {force: true});
  if (c.kind === 'photo') {
    execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', tmp, '-vf', crop, '-q:v', '2', `${clipDir}/scene-${shot}.jpg`]);
  } else {
    execFileSync(ffmpeg, [
      '-v', 'error', '-y', '-i', tmp, '-an',
      '-vf', `${crop},fps=30,format=yuv420p`,
      '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart',
      `${clipDir}/scene-${shot}.mp4`,
    ]);
  }
  rmSync(tmp);
  credits[shot] = `Shot ${shot}: ${c.kind} by ${c.author} on ${c.source ?? 'Pexels'}, ${c.url}`;
  const what = c.kind === 'photo' ? 'photo' : `${Math.round(c.duration)}s`;
  console.log(`scene-${shot}.${c.kind === 'photo' ? 'jpg' : 'mp4'} <- #${n}${anchor === 'center' ? '' : '@' + anchor} (${file.width}x${file.height}, ${what}) by ${c.author}`);
}

const order = (a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b);
writeFileSync(`${creditsFile}.json`, JSON.stringify(credits, null, 1));
writeFileSync(creditsFile, Object.keys(credits).sort(order).map((k) => credits[k]).join('\n') + '\n');
console.log(`Credits: ${creditsFile}`);
