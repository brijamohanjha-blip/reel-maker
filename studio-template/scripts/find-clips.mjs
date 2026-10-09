// Find stock-clip candidates for every beat and make one contact sheet per scene.
// Usage: node scripts/find-clips.mjs <slug> [candidates per scene, default 5]
// Source: Pexels if PEXELS_API_KEY is set, otherwise Pixabay with PIXABAY_API_KEY (from the env or a .env file).
//
// Reads jobs/<slug>/plan.json → beats[].clip.search (list of search terms).
// Keeps clips at least as long as the beat (+1 s) that give a sharp 1080x1920 frame: portrait ≥1080 wide, or
// landscape ≥2160 tall (cropped to 9:16). Never reuses a clip. Downloads only preview frames, not videos. Writes:
//   jobs/<slug>/candidates.json
//   jobs/<slug>/candidates/scene-<id>.png   (columns = candidates #1..#N, rows = frames at ~20/50/80%)
// Then pick with: node scripts/pick-clips.mjs <slug> 1=2 2=1 ...
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import ffmpeg from 'ffmpeg-static';

const [slug, perArg] = process.argv.slice(2);
const per = Number(perArg ?? 5);
// Keys come from the environment, else from a .env file: $REEL_MAKER_ENV, ./.env, or the installed skill's .env.
for (const file of [process.env.REEL_MAKER_ENV, '.env', join(homedir(), '.claude/skills/reel-maker/.env')]) {
  if (!file || !existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#\s]*)"?/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const PEXELS = process.env.PEXELS_API_KEY;
const PIXABAY = process.env.PIXABAY_API_KEY;
const source = PEXELS ? 'Pexels' : 'Pixabay';
if (!slug) {
  console.error('Usage: node scripts/find-clips.mjs <slug> [candidates per scene]');
  process.exit(1);
}
if (!PEXELS && !PIXABAY) {
  console.error('No stock API key. Get a free key at https://pixabay.com/api/docs/ (or https://www.pexels.com/api/) and add\n  export PIXABAY_API_KEY="..."   (or PEXELS_API_KEY)\nto ~/.zshrc, then restart.');
  process.exit(1);
}

const WORDS_PER_SECOND = 2.8;
const plan = JSON.parse(readFileSync(`jobs/${slug}/plan.json`, 'utf8'));
const reel = existsSync(`reels/${slug}.json`) ? JSON.parse(readFileSync(`reels/${slug}.json`, 'utf8')) : null;
const outDir = `jobs/${slug}/candidates`;
mkdirSync(outDir, {recursive: true});
const FONT = ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'].find(existsSync);

// Each source is normalised to {id, url, duration, width, height, author, frames: [jpg urls], files: [{link, width, height}]}.
const searchPexels = async (query) => {
  const url = new URL('https://api.pexels.com/videos/search');
  url.search = new URLSearchParams({query, orientation: 'portrait', size: 'medium', per_page: '40'}).toString();
  const res = await fetch(url, {headers: {Authorization: PEXELS}});
  if (!res.ok) throw new Error(`Pexels search "${query}" failed: ${res.status} ${await res.text()}`);
  return ((await res.json()).videos ?? []).map((v) => {
    const pics = v.video_pictures ?? [];
    return {
      id: v.id,
      url: v.url,
      duration: v.duration,
      width: v.width,
      height: v.height,
      author: v.user?.name,
      frames: [0.2, 0.5, 0.8].map((f) => pics[Math.min(pics.length - 1, Math.floor(f * pics.length))]?.picture ?? v.image),
      files: (v.video_files ?? []).map((f) => ({link: f.link, width: f.width, height: f.height})),
    };
  });
};

const searchPixabay = async (query) => {
  const url = new URL('https://pixabay.com/api/videos/');
  url.search = new URLSearchParams({key: PIXABAY, q: query, per_page: '50', safesearch: 'true'}).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay search "${query}" failed: ${res.status} ${await res.text()}`);
  return ((await res.json()).hits ?? []).map((v) => {
    const files = Object.values(v.videos ?? {}).filter((f) => f?.url).map((f) => ({link: f.url, width: f.width, height: f.height, thumb: f.thumbnail}));
    const best = [...files].sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? {};
    return {
      id: v.id,
      url: v.pageURL,
      duration: v.duration,
      width: best.width,
      height: best.height,
      author: v.user,
      frames: [files.find((f) => f.thumb)?.thumb].filter(Boolean),
      files,
    };
  });
};

const search = PEXELS ? searchPexels : searchPixabay;
const sharpEnough = (v) => (v.height > v.width ? v.width >= 1080 : v.height >= 2160);

const download = async (url, file) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
};

const used = new Set();
const result = {};
const warnings = [];

for (const beat of plan.beats) {
  const queries = beat.clip?.search ?? [];
  if (!queries.length) {
    warnings.push(`scene-${beat.id}: no clip.search terms in plan.json`);
    continue;
  }
  // Use the measured scene length once the voiceover is in (reels/<slug>.json), else estimate from the words.
  const measured = reel?.scenes?.[plan.beats.indexOf(beat)];
  const minSeconds = measured
    ? Math.ceil(measured.end - measured.start + 0.5)
    : Math.ceil(beat.script.trim().split(/\s+/).length / WORDS_PER_SECOND + 1);
  const lists = [];
  for (const q of queries) {
    const vids = (await search(q)).filter(
      (v) => sharpEnough(v) && v.duration >= minSeconds && v.frames.length && !used.has(v.id),
    );
    lists.push(vids.map((v) => ({...v, query: q})));
  }
  // Interleave the search terms so each one contributes its best results.
  const picks = [];
  for (let i = 0; picks.length < per && lists.some((l) => l[i]); i++) {
    for (const l of lists) {
      const v = l[i];
      if (v && picks.length < per && !picks.some((p) => p.id === v.id)) picks.push(v);
    }
  }
  if (!picks.length) {
    warnings.push(`scene-${beat.id}: nothing sharp enough and ≥${minSeconds}s on ${source} for ${JSON.stringify(queries)}. Try broader terms.`);
    continue;
  }
  picks.forEach((v) => used.add(v.id));

  const sceneDir = join(outDir, `scene-${beat.id}`);
  mkdirSync(sceneDir, {recursive: true});
  const frames = [];
  for (const [k, v] of picks.entries()) {
    for (const [r, url] of v.frames.entries()) {
      const file = join(sceneDir, `${k + 1}-${r}.jpg`);
      await download(url, file);
      const orient = v.height > v.width ? '' : '  crop';
      frames.push({file, col: k, row: r, label: r === 0 ? `#${k + 1}  ${Math.round(v.duration)}s${orient}` : null});
    }
  }

  // Contact sheet: candidates side by side, three frames each.
  const W = 220;
  const H = 391;
  const inputs = frames.flatMap((f) => ['-i', f.file]);
  const parts = frames.map((f, i) => {
    let chain = `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
    if (f.label && FONT) {
      chain += `,drawbox=x=0:y=0:w=iw:h=44:color=black@0.65:t=fill,drawtext=fontfile='${FONT}':text='${f.label}':x=10:y=10:fontsize=26:fontcolor=white`;
    }
    return `${chain}[f${i}]`;
  });
  const layout = frames.map((f) => `${f.col * W}_${f.row * H}`).join('|');
  const filter = `${parts.join(';')};${frames.map((_, i) => `[f${i}]`).join('')}xstack=inputs=${frames.length}:layout=${layout}:fill=white`;
  execFileSync(ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-frames:v', '1', join(outDir, `scene-${beat.id}.png`)]);

  result[beat.id] = picks.map((v, k) => ({
    n: k + 1,
    source,
    id: v.id,
    url: v.url,
    duration: v.duration,
    width: v.width,
    height: v.height,
    author: v.author,
    query: v.query,
    files: v.files.map(({link, width, height}) => ({link, width, height})),
  }));
}

writeFileSync(`jobs/${slug}/candidates.json`, JSON.stringify(result, null, 1));
console.log(
  JSON.stringify(
    {
      source,
      sheets: Object.keys(result).map((id) => `${outDir}/scene-${id}.png`),
      candidates: Object.fromEntries(Object.entries(result).map(([id, c]) => [id, c.map((x) => `#${x.n} ${Math.round(x.duration)}s "${x.query}"`)])),
      warnings,
    },
    null,
    1,
  ),
);
