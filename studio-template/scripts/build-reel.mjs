// Build reels/<slug>.json from a job: every shot starts on its cue word, every beat's on-screen text spans the beat.
// Usage: node scripts/build-reel.mjs <slug>
//
// Expects:
//   jobs/<slug>/plan.json                         beats (see shots.mjs for shots and cues)
//   public/jobs/<slug>/voiceover.mp3              the ElevenLabs audio
//   public/jobs/<slug>/captions.json              from align-captions.mjs
//   public/jobs/<slug>/clips/scene-<shot>.mp4|jpg optional per shot (falls back to a soft gradient)
//   public/jobs/<slug>/music.mp3                  optional, from make-music.mjs (only if the user asked for music)
import {execFileSync} from 'node:child_process';
import {existsSync, writeFileSync} from 'node:fs';
import ffmpeg from 'ffmpeg-static';
import {loadJob, planShots} from './shots.mjs';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/build-reel.mjs <slug>');
  process.exit(1);
}
const {plan, captions} = loadJob(slug);
if (!captions) throw new Error(`public/jobs/${slug}/captions.json is missing: run transcribe and align-captions first.`);
const pub = `jobs/${slug}`;

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

// With an end card the last shot holds 0.4 s after the voice; without one it holds 1.2 s and fades out.
const endCard = plan.endCard === true;
const lastWordEnd = captions[captions.length - 1].endMs / 1000;
const end = Math.max(audioSeconds ?? 0, lastWordEnd) + (endCard ? 0.4 : 1.2);
const {shots} = planShots(plan, captions, end);

const r2 = (x) => +x.toFixed(2);
const warnings = [];
const scenes = shots.map((s) => {
  const scene = {start: r2(s.start), end: r2(s.end), text: ''};
  const mp4 = `${pub}/clips/scene-${s.id}.mp4`;
  const jpg = `${pub}/clips/scene-${s.id}.jpg`;
  if (existsSync(`public/${mp4}`)) {
    scene.video = mp4;
    const len = probe(`public/${mp4}`);
    if (len && len < s.end - s.start - 0.05) warnings.push(`scene-${s.id}.mp4 is ${len.toFixed(1)}s but the shot is ${(s.end - s.start).toFixed(1)}s: it will loop.`);
  } else if (existsSync(`public/${jpg}`)) {
    scene.image = jpg;
  } else {
    warnings.push(`scene-${s.id} missing (no .mp4 or .jpg): using the soft gradient fallback.`);
  }
  return scene;
});

// On-screen text lives per beat, across all of that beat's shots. `onScreenCue` (words from the beat) delays it
// until those words are spoken, so a card never appears before its idea is mentioned.
const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const texts = [];
let wordOffset = 0;
plan.beats.forEach((beat) => {
  const tokens = beat.script.trim().split(/\s+/).map(norm);
  const own = shots.filter((s) => s.beatId === beat.id);
  if (beat.onScreenText) {
    let start = own[0].start;
    if (beat.onScreenCue) {
      const cue = beat.onScreenCue.trim().split(/\s+/).map(norm);
      const idx = tokens.findIndex((_, i) => cue.every((c, j) => tokens[i + j] === c));
      if (idx < 0) throw new Error(`Beat ${beat.id}: onScreenCue "${beat.onScreenCue}" is not in the beat's script.`);
      if (wordOffset + idx > 0) start = captions[wordOffset + idx].startMs / 1000;
    }
    texts.push({start: r2(start), end: r2(own[own.length - 1].end), text: beat.onScreenText});
  }
  wordOffset += tokens.length;
});

const reel = {
  title: plan.title,
  audio: `${pub}/voiceover.mp3`,
  captions: `${pub}/captions.json`,
  ...(existsSync(`public/${pub}/music.mp3`) ? {music: `${pub}/music.mp3`} : {}),
  endCard,
  ...(endCard && plan.endCardText ? {endCardText: plan.endCardText} : {}),
  scenes,
  texts,
};
writeFileSync(`reels/${slug}.json`, JSON.stringify(reel, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      reel: `reels/${slug}.json`,
      audioSeconds,
      totalSeconds: r2(end + (endCard ? 2 : 0)),
      shots: shots.map((s, i) => `${s.id} ${scenes[i].start}-${scenes[i].end}s ${scenes[i].video ? 'video' : scenes[i].image ? 'photo' : 'MISSING'}`),
      warnings,
    },
    null,
    1,
  ),
);
