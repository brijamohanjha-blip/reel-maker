// Shared shot planning for find-clips, pick-clips and build-reel.
//
// A beat is one spoken idea. It can be split into several shots so the picture changes on the word it illustrates:
//   beats[].shots: [{search: [...], media?: "video"|"photo"|"any"}, {cue: "nami", search: [...]}, ...]
// The first shot starts with the beat; every later shot needs a `cue`: words from the beat's script where it starts.
// A beat without `shots` is one shot using beat.clip.search.
// Shot ids: "3" for a single-shot beat, "3a", "3b", ... when a beat has several. Files: clips/scene-<id>.mp4 | .jpg
import {existsSync, readFileSync} from 'node:fs';

export const WORDS_PER_SECOND = 2.8;
const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export const loadJob = (slug) => {
  const plan = JSON.parse(readFileSync(`jobs/${slug}/plan.json`, 'utf8'));
  const capPath = `public/jobs/${slug}/captions.json`;
  const captions = existsSync(capPath) ? JSON.parse(readFileSync(capPath, 'utf8')) : null;
  return {plan, captions};
};

/**
 * Returns shots in order with start/end seconds: measured from word-level captions when available,
 * otherwise estimated at WORDS_PER_SECOND. `end` is where the last shot stops.
 */
export const planShots = (plan, captions, end) => {
  const shots = [];
  let offset = 0;
  for (const beat of plan.beats) {
    const words = beat.script.trim().split(/\s+/);
    const tokens = words.map(norm);
    const list = beat.shots?.length ? beat.shots : [{search: beat.clip?.search ?? [], media: beat.clip?.media}];
    list.forEach((shot, k) => {
      let idx = 0;
      if (k > 0 || shot.cue) {
        if (!shot.cue) throw new Error(`Beat ${beat.id}, shot ${k + 1}: needs a "cue" (words from the script where it starts).`);
        const cue = shot.cue.trim().split(/\s+/).map(norm);
        idx = tokens.findIndex((_, i) => cue.every((c, j) => tokens[i + j] === c));
        if (idx < 0) throw new Error(`Beat ${beat.id}, shot ${k + 1}: cue "${shot.cue}" is not in the beat's script.`);
      }
      shots.push({
        id: list.length === 1 ? String(beat.id) : `${beat.id}${'abcdefghij'[k]}`,
        beatId: beat.id,
        firstOfBeat: k === 0,
        wordIndex: offset + idx,
        search: shot.search ?? [],
        media: shot.media ?? 'any',
      });
    });
    offset += words.length;
  }
  if (captions && captions.length !== offset) {
    throw new Error(`Beats have ${offset} words but captions have ${captions.length}. Re-run align-captions with script.txt.`);
  }
  const at = (wi) => (captions ? captions[wi].startMs / 1000 : wi / WORDS_PER_SECOND);
  const lastWordEnd = captions ? captions[captions.length - 1].endMs / 1000 : offset / WORDS_PER_SECOND;
  const stop = end ?? lastWordEnd + 1.2;
  shots.forEach((s, i) => (s.start = i === 0 ? 0 : at(s.wordIndex)));
  shots.forEach((s, i) => {
    s.end = i + 1 < shots.length ? shots[i + 1].start : stop;
    if (s.end <= s.start) throw new Error(`Shot ${s.id} has no length: its cue must come after the previous shot's cue.`);
    s.seconds = +(s.end - s.start).toFixed(2);
  });
  return {shots, words: offset, lastWordEnd, measured: Boolean(captions)};
};
