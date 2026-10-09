// Compose a soft, original ambient bed (no samples, no copyright) and level it under the voice.
// Usage: node scripts/make-music.mjs <slug> [dB below voice, default 18]
//
// Writes public/jobs/<slug>/music.mp3, as long as the whole Reel (with or without the end card),
// with a 1.5 s fade-in and 2.5 s fade-out. Slow Cmaj7-Am7-Fmaj7-G chords with a quiet arpeggio.
import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync, rmSync, writeFileSync} from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const [slug, belowArg] = process.argv.slice(2);
if (!slug) {
  console.error('Usage: node scripts/make-music.mjs <slug> [dB below voice]');
  process.exit(1);
}
const below = Number(belowArg ?? 18);
const dir = `public/jobs/${slug}`;

const probe = (args) => {
  try {
    execFileSync(ffmpeg, args, {stdio: 'pipe'});
    return '';
  } catch (e) {
    return String(e.stderr);
  }
};
const duration = (file) => {
  const m = probe(['-i', file]).match(/Duration: (\d+):(\d+):([\d.]+)/);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
};
// volumedetect reports on stderr, so read it with spawnSync.
const meanDb = (file) => {
  const {stderr} = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], {encoding: 'utf8'});
  const db = parseFloat(stderr.match(/mean_volume: (-?[\d.]+) dB/)?.[1]);
  if (Number.isNaN(db)) throw new Error(`Could not measure the volume of ${file}`);
  return db;
};

const SR = 44100;
// Match build-reel.mjs: voice + 0.4 s + 2 s end card, or voice + 1.2 s when the end card is off.
const plan = JSON.parse(readFileSync(`jobs/${slug}/plan.json`, 'utf8'));
const seconds = duration(`${dir}/voiceover.mp3`) + (plan.endCard === true ? 0.4 + 2 : 1.2);
const n = Math.ceil(seconds * SR);
const L = new Float32Array(n);
const R = new Float32Array(n);

const midi = (m) => 440 * 2 ** ((m - 69) / 12);
// Cmaj7, Am7, Fmaj7, G(add9): 4 s each, voiced low and warm.
const chords = [
  [48, 55, 59, 64],
  [45, 52, 55, 60],
  [41, 48, 52, 57],
  [43, 50, 55, 62],
];
const CHORD_S = 4;

// Pad: detuned sines per note, slow attack and release, gentle tremolo.
for (let c = 0; c * CHORD_S < seconds; c++) {
  const notes = chords[c % chords.length];
  const start = Math.floor(c * CHORD_S * SR);
  const len = Math.floor((CHORD_S + 1.5) * SR);
  for (const note of notes) {
    const f = midi(note);
    for (const [detune, pan] of [[-0.12, 0.35], [0.12, 0.65]]) {
      const ff = f * 2 ** (detune / 12);
      for (let i = 0; i < len && start + i < n; i++) {
        const t = i / SR;
        const env = Math.min(1, t / 1.2) * Math.min(1, (CHORD_S + 1.5 - t) / 1.5);
        const v = Math.sin(2 * Math.PI * ff * t) * 0.6 + Math.sin(2 * Math.PI * ff * 2 * t) * 0.08;
        const s = v * env * (0.9 + 0.1 * Math.sin(2 * Math.PI * 0.2 * t)) * 0.05;
        L[start + i] += s * (1 - pan);
        R[start + i] += s * pan;
      }
    }
  }
  // Arpeggio: soft bell-like notes an octave up, every 0.5 s.
  const arp = [notes[1] + 12, notes[2] + 12, notes[3] + 12, notes[2] + 12, notes[3] + 12, notes[1] + 24, notes[3] + 12, notes[2] + 12];
  arp.forEach((note, k) => {
    const f = midi(note);
    const s0 = start + Math.floor(k * 0.5 * SR);
    const pan = 0.3 + 0.4 * ((k % 3) / 2);
    for (let i = 0; i < 2.2 * SR && s0 + i < n; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 2.4);
      const v = (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 3 * t) * Math.exp(-t * 6)) * env * 0.045;
      L[s0 + i] += v * (1 - pan);
      R[s0 + i] += v * pan;
    }
  });
}

// Fades.
for (let i = 0; i < n; i++) {
  const t = i / SR;
  const g = Math.min(1, t / 1.5) * Math.min(1, (seconds - t) / 2.5);
  L[i] *= g;
  R[i] *= g;
}

// Simple stereo echo for space.
const delay = Math.floor(0.33 * SR);
for (let i = delay; i < n; i++) {
  L[i] += R[i - delay] * 0.25;
  R[i] += L[i - delay] * 0.25;
}

let peak = 0;
for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const pcm = Buffer.alloc(44 + n * 4);
pcm.write('RIFF', 0);
pcm.writeUInt32LE(36 + n * 4, 4);
pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28);
pcm.writeUInt16LE(4, 32);
pcm.writeUInt16LE(16, 34);
pcm.write('data', 36);
pcm.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  pcm.writeInt16LE(Math.round((L[i] / peak) * 0.8 * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round((R[i] / peak) * 0.8 * 32767), 46 + i * 4);
}
const wav = `${dir}/music.raw.wav`;
writeFileSync(wav, pcm);

const voiceDb = meanDb(`${dir}/voiceover.mp3`);
const musicDb = meanDb(wav);
const gain = voiceDb - below - musicDb;
execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', wav, '-af', `volume=${gain.toFixed(2)}dB`, '-c:a', 'libmp3lame', '-q:a', '2', `${dir}/music.mp3`]);
rmSync(wav);
console.log(JSON.stringify({out: `${dir}/music.mp3`, seconds: +seconds.toFixed(2), voiceMeanDb: voiceDb, musicMeanDb: +(musicDb + gain).toFixed(1), belowVoiceDb: below}));
