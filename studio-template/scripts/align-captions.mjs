// Align an approved script to Whisper word timings, keeping the script's exact words.
// Usage: node scripts/align-captions.mjs <whisper.json> <script.txt> <out captions.json>
//
// Whisper output for Hinglish comes back in Devanagari with misheard, split, merged or repeated words.
// Each word is reduced to a phonetic consonant key (Devanagari is transliterated first), then a
// dynamic-programming alignment matches script words to Whisper tokens, allowing 1:1, 1:2 (merge),
// 2:1 (split) and skips. Script words with no match get times interpolated from their neighbours.
import {readFileSync, writeFileSync} from 'node:fs';

const [whisperPath, scriptPath, outPath] = process.argv.slice(2);
if (!outPath) {
  console.error('Usage: node scripts/align-captions.mjs <whisper.json> <script.txt> <out.json>');
  process.exit(1);
}

const CONS = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh',
  ष: 'sh', स: 's', ह: 'h', ळ: 'l',
};
const NUKTA = {क: 'q', ख: 'kh', ग: 'g', ज: 'z', ड: 'r', ढ: 'rh', फ: 'f', य: 'y'};
const VOWELS = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o',
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o',
  'ं': 'n', 'ँ': 'n', 'ः': 'h',
};
const PRECOMPOSED_NUKTA = {क़: 'q', ख़: 'kh', ग़: 'g', ज़: 'z', ड़: 'r', ढ़: 'rh', फ़: 'f', य़: 'y'};

const transliterate = (word) => {
  let out = '';
  const chars = [...word.normalize('NFC')];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (PRECOMPOSED_NUKTA[c]) out += PRECOMPOSED_NUKTA[c];
    else if (CONS[c]) out += chars[i + 1] === '़' ? NUKTA[c] ?? CONS[c] : CONS[c];
    else if (VOWELS[c]) out += VOWELS[c];
    else if (c === '़' || c === '्') continue;
    else out += c;
  }
  return out;
};

const collapse = (k) => k.replace(/(.)\1+/g, '$1');

// Consonant skeleton with similar sounds folded together, so "ब्लड" ≈ "blood" and "डर्मटोलगिस" ≈ "dermatologist".
const key = (word) => {
  let w = transliterate(word).toLowerCase().replace(/[^a-z]/g, '');
  w = w
    .replace(/chh|ch/g, 'c')
    .replace(/sh/g, 's')
    .replace(/ph/g, 'f')
    .replace(/([kgtdbjc])h/g, '$1')
    .replace(/x/g, 'ks')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/q/g, 'k')
    .replace(/c/g, 'k');
  let skeleton = w.replace(/[aeiou]/g, '');
  if (skeleton.length > 1) skeleton = skeleton.replace(/h$/, ''); // "yeh" ≈ "ये"
  return collapse(skeleton) || w.slice(0, 1) || '_';
};

const lev = (a, b) => {
  const d = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const cost = (a, b) => lev(a, b) / Math.max(a.length, b.length, 1);

// --- inputs ---
const raw = JSON.parse(readFileSync(whisperPath, 'utf8'));
// Drop tokens that jump back in time: Whisper sometimes repeats a sentence it already transcribed.
const tokens = [];
for (const t of raw) {
  const text = t.text.trim();
  if (!text) continue;
  const last = tokens[tokens.length - 1];
  if (last && t.startMs < last.endMs - 50) continue;
  tokens.push({text, startMs: t.startMs, endMs: t.endMs, k: key(text)});
}
const words = readFileSync(scriptPath, 'utf8').trim().split(/\s+/);
const wk = words.map(key);

// --- DP alignment ---
const SKIP_WORD = 0.75;
const SKIP_TOKEN = 0.6;
const n = words.length;
const m = tokens.length;
const D = Array.from({length: n + 1}, () => Array(m + 1).fill(Infinity));
const B = Array.from({length: n + 1}, () => Array(m + 1).fill(null));
D[0][0] = 0;
for (let i = 0; i <= n; i++) {
  for (let j = 0; j <= m; j++) {
    const here = D[i][j];
    if (here === Infinity) continue;
    const relax = (ni, nj, c, op) => {
      if (ni <= n && nj <= m && here + c < D[ni][nj]) {
        D[ni][nj] = here + c;
        B[ni][nj] = {i, j, op};
      }
    };
    if (i < n && j < m) relax(i + 1, j + 1, cost(wk[i], tokens[j].k), '1:1');
    if (i < n && j + 1 < m) relax(i + 1, j + 2, cost(wk[i], collapse(tokens[j].k + tokens[j + 1].k)) + 0.1, '1:2');
    if (i + 1 < n && j < m) relax(i + 2, j + 1, cost(collapse(wk[i] + wk[i + 1]), tokens[j].k) + 0.1, '2:1');
    if (i < n) relax(i + 1, j, SKIP_WORD, 'skip-word');
    if (j < m) relax(i, j + 1, SKIP_TOKEN, 'skip-token');
  }
}

const times = Array(n).fill(null);
let estimated = 0;
for (let i = n, j = m; i > 0 || j > 0; ) {
  const b = B[i][j];
  if (b.op === '1:1') times[b.i] = [tokens[b.j].startMs, tokens[b.j].endMs];
  if (b.op === '1:2') times[b.i] = [tokens[b.j].startMs, tokens[b.j + 1].endMs];
  if (b.op === '2:1') {
    const t = tokens[b.j];
    const share = wk[b.i].length / (wk[b.i].length + wk[b.i + 1].length);
    const mid = t.startMs + (t.endMs - t.startMs) * share;
    times[b.i] = [t.startMs, mid];
    times[b.i + 1] = [mid, t.endMs];
    estimated += 2;
  }
  i = b.i;
  j = b.j;
}

// Interpolate unmatched words between their matched neighbours.
for (let i = 0; i < n; i++) {
  if (times[i]) continue;
  let k = i;
  while (k < n && !times[k]) k++;
  const from = i > 0 ? times[i - 1][1] : 0;
  const to = k < n ? times[k][0] : (tokens[tokens.length - 1]?.endMs ?? from + 500 * (k - i));
  const step = (to - from) / (k - i);
  for (let x = i; x < k; x++) times[x] = [from + step * (x - i), from + step * (x - i + 1)];
  estimated += k - i;
}

const captions = words.map((w, i) => ({
  text: (i ? ' ' : '') + w,
  startMs: Math.round(times[i][0]),
  endMs: Math.round(times[i][1]),
  timestampMs: Math.round((times[i][0] + times[i][1]) / 2),
  confidence: null,
}));
writeFileSync(outPath, JSON.stringify(captions, null, 1));
console.log(
  JSON.stringify({
    words: n,
    whisperTokens: raw.length,
    usedTokens: m,
    estimatedWords: estimated,
    durationMs: captions[n - 1].endMs,
    out: outPath,
  }),
);
