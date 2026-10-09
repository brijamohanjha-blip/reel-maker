// Build reels/<slug>.json from a job: scenes start on the first spoken word of each beat.
// Usage: node scripts/build-reel.mjs <slug>
//
// Expects:
//   jobs/<slug>/plan.json                      beats: [{id, script, onScreenText?, clip: {prompt, seconds}}]
//   public/jobs/<slug>/voiceover.mp3           the ElevenLabs audio
//   public/jobs/<slug>/captions.json           from align-captions.mjs
//   public/jobs/<slug>/clips/scene-<id>.mp4    optional per beat (falls back to a soft gradient)
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/build-reel.mjs <slug>');
  process.exit(1);
}
const plan = JSON.parse(readFileSync(`jobs/${slug}/plan.json`, 'utf8'));
const pub = `jobs/${slug}`;
const captions = JSON.parse(readFileSync(`public/${pub}/captions.json`, 'utf8'));

const probe = (file) => {
  try {
    execFileSync(ffmpeg, ['-i', file], {stdio: 'pipe'});
  } catch (e) {
    const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/);
    if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  }
  return null;
};
const audioSeconds = probe(`public/${pub}/voiceover.mp3`);

let wordIndex = 0;
const starts = plan.beats.map((beat, i) => {
  const at = i === 0 ? 0 : captions[wordIndex].startMs / 1000;
  wordIndex += beat.script.trim().split(/\s+/).length;
  return at;
});
if (wordIndex !== captions.length) {
  throw new Error(`Beats have ${wordIndex} words but captions have ${captions.length}. Re-run align-captions with script.txt.`);
}
const lastWordEnd = captions[captions.length - 1].endMs / 1000;
const end = Math.max(audioSeconds ?? 0, lastWordEnd) + 0.4;

const warnings = [];
const scenes = plan.beats.map((beat, i) => {
  const start = +starts[i].toFixed(2);
  const sceneEnd = +(i + 1 < starts.length ? starts[i + 1] : end).toFixed(2);
  const clip = `${pub}/clips/scene-${beat.id}.mp4`;
  const scene = {start, end: sceneEnd, text: beat.onScreenText ?? ''};
  if (existsSync(`public/${clip}`)) {
    scene.video = clip;
    const len = probe(`public/${clip}`);
    if (len && len < sceneEnd - start - 0.05) warnings.push(`scene-${beat.id}.mp4 is ${len.toFixed(1)}s but the scene is ${(sceneEnd - start).toFixed(1)}s: it will loop.`);
  } else {
    warnings.push(`scene-${beat.id}.mp4 missing: using the soft gradient fallback.`);
  }
  return scene;
});

const reel = {
  title: plan.title,
  audio: `${pub}/voiceover.mp3`,
  captions: `${pub}/captions.json`,
  ...(plan.endCardText ? {endCardText: plan.endCardText} : {}),
  scenes,
};
writeFileSync(`reels/${slug}.json`, JSON.stringify(reel, null, 2) + '\n');
console.log(JSON.stringify({reel: `reels/${slug}.json`, audioSeconds, totalSeconds: +(end + 2).toFixed(2), scenes: scenes.map((s) => [s.start, s.end]), warnings}, null, 1));
