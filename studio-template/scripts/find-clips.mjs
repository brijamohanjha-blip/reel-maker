// Find stock candidates (videos and photos) for every shot and make one contact sheet per shot.
// Usage: node scripts/find-clips.mjs <slug> [videos per shot, default 5] [photos per shot, default 3] [--only=2b,4c]
// --only re-searches just those shots (after changing their search terms) and keeps every other shot's candidates.
// Source: Pexels if PEXELS_API_KEY is set (videos only), otherwise Pixabay with PIXABAY_API_KEY (videos + photos).
// Keys come from the environment or a .env file ($REEL_MAKER_ENV, ./.env, or the installed skill's .env).
//
// Shots come from jobs/<slug>/plan.json (see shots.mjs). A shot's length is measured from the voiceover's word
// timings when public/jobs/<slug>/captions.json exists, otherwise estimated from the words.
// Videos must give a sharp 1080x1920 frame (portrait ≥1080 wide, or landscape ≥2160 tall, centre-cropped) and run
// at least as long as the shot. Photos must be portrait. Only preview images are downloaded here. Writes:
//   jobs/<slug>/candidates.json
//   jobs/<slug>/candidates/shot-<id>.png   (columns = candidates; videos show 1-3 frames, photos are marked "photo")
// Then pick with: node scripts/pick-clips.mjs <slug> 1=2 2a=1 2b=4 ...
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import ffmpeg from 'ffmpeg-static';
import {loadEnv} from './env.mjs';
import {loadJob, planShots} from './shots.mjs';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',').filter(Boolean) ?? null;
const [slug, vidArg, photoArg] = args.filter((a) => !a.startsWith('--'));
const perVideo = Number(vidArg ?? 5);
const perPhoto = Number(photoArg ?? 3);
if (!slug) {
  console.error('Usage: node scripts/find-clips.mjs <slug> [videos per shot] [photos per shot]');
  process.exit(1);
}

loadEnv();
const PEXELS = process.env.PEXELS_API_KEY;
const PIXABAY = process.env.PIXABAY_API_KEY;
const source = PEXELS ? 'Pexels' : 'Pixabay';
if (!PEXELS && !PIXABAY) {
  console.error('No stock API key. Get a free key at https://pixabay.com/api/docs/ (or https://www.pexels.com/api/) and put\n  PIXABAY_API_KEY=...   (or PEXELS_API_KEY)\nin the skill\'s .env file.');
  process.exit(1);
}

const {plan, captions} = loadJob(slug);
const {shots, measured} = planShots(plan, captions);
const outDir = `jobs/${slug}/candidates`;
const candidatesFile = `jobs/${slug}/candidates.json`;
const previous = only && existsSync(candidatesFile) ? JSON.parse(readFileSync(candidatesFile, 'utf8')) : {};
if (only) {
  const unknown = only.filter((id) => !shots.some((s) => s.id === id));
  if (unknown.length) throw new Error(`--only: no shot ${unknown.join(', ')} in the plan. Shots: ${shots.map((s) => s.id).join(', ')}`);
} else {
  rmSync(outDir, {recursive: true, force: true});
}
mkdirSync(outDir, {recursive: true});
const FONT = ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'].find(existsSync);

const getJson = async (url, headers = {}) => {
  const res = await fetch(url, {headers});
  if (!res.ok) throw new Error(`${source} request failed: ${res.status} ${await res.text()}`);
  return res.json();
};

// Each result is normalised to {kind, id, url, duration, width, height, author, frames: [jpg urls], files: [{link, width, height}]}.
const searchPexelsVideos = async (query) => {
  const url = new URL('https://api.pexels.com/videos/search');
  url.search = new URLSearchParams({query, orientation: 'portrait', size: 'medium', per_page: '40'}).toString();
  return ((await getJson(url, {Authorization: PEXELS})).videos ?? []).map((v) => {
    const pics = v.video_pictures ?? [];
    return {
      kind: 'video',
      id: `v${v.id}`,
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

const searchPixabayVideos = async (query) => {
  const url = new URL('https://pixabay.com/api/videos/');
  url.search = new URLSearchParams({key: PIXABAY, q: query, per_page: '50', safesearch: 'true'}).toString();
  return ((await getJson(url)).hits ?? []).map((v) => {
    const files = Object.values(v.videos ?? {}).filter((f) => f?.url).map((f) => ({link: f.url, width: f.width, height: f.height, thumb: f.thumbnail}));
    const best = [...files].sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? {};
    return {
      kind: 'video',
      id: `v${v.id}`,
      url: v.pageURL,
      duration: v.duration,
      width: best.width,
      height: best.height,
      author: v.user,
      frames: [files.find((f) => f.thumb)?.thumb].filter(Boolean),
      files: files.map(({link, width, height}) => ({link, width, height})),
    };
  });
};

const searchPixabayPhotos = async (query) => {
  const url = new URL('https://pixabay.com/api/');
  url.search = new URLSearchParams({key: PIXABAY, q: query, image_type: 'photo', orientation: 'vertical', per_page: '40', safesearch: 'true'}).toString();
  return ((await getJson(url)).hits ?? []).map((p) => ({
    kind: 'photo',
    id: `p${p.id}`,
    url: p.pageURL,
    duration: null,
    width: p.imageWidth,
    height: p.imageHeight,
    author: p.user,
    frames: [p.webformatURL],
    files: [{link: p.largeImageURL, width: p.imageWidth, height: p.imageHeight}],
  }));
};

const searchVideos = PEXELS ? searchPexelsVideos : searchPixabayVideos;
const searchPhotos = PEXELS ? null : searchPixabayPhotos;
const sharpVideo = (v) => (v.height > v.width ? v.width >= 1080 : v.height >= 2160);

const download = async (url, file) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
};

// Take results from several search terms in turn, so each term contributes its best matches.
const interleave = (lists, max, used) => {
  const out = [];
  for (let i = 0; out.length < max && lists.some((l) => l[i]); i++) {
    for (const l of lists) {
      const v = l[i];
      if (v && out.length < max && !used.has(v.id) && !out.some((o) => o.id === v.id)) out.push(v);
    }
  }
  return out;
};

// Keep other shots' candidates when re-searching a few, and never offer the same clip twice.
const result = only ? Object.fromEntries(Object.entries(previous).filter(([id]) => !only.includes(id))) : {};
const used = new Set(Object.values(result).flat().map((c) => c.id));
const warnings = [];

for (const shot of shots) {
  if (only && !only.includes(shot.id)) continue;
  rmSync(join(outDir, `shot-${shot.id}`), {recursive: true, force: true});
  if (!shot.search.length) {
    warnings.push(`shot ${shot.id}: no search terms in plan.json`);
    continue;
  }
  const minSeconds = Math.max(2, Math.ceil(shot.seconds + 0.3));
  const wantVideo = shot.media !== 'photo';
  const wantPhoto = shot.media !== 'video' && searchPhotos;
  const videoLists = [];
  const photoLists = [];
  for (const q of shot.search) {
    if (wantVideo) videoLists.push((await searchVideos(q)).filter((v) => sharpVideo(v) && v.duration >= minSeconds && v.frames.length).map((v) => ({...v, query: q})));
    if (wantPhoto) photoLists.push((await searchPhotos(q)).filter((p) => p.height > p.width && p.frames.length).map((p) => ({...p, query: q})));
  }
  const picks = [...(wantVideo ? interleave(videoLists, perVideo, used) : []), ...(wantPhoto ? interleave(photoLists, perPhoto, used) : [])];
  if (!picks.length) {
    warnings.push(`shot ${shot.id}: nothing usable (≥${minSeconds}s videos or portrait photos) for ${JSON.stringify(shot.search)}. Try other terms.`);
    continue;
  }
  picks.forEach((v) => used.add(v.id));

  const shotDir = join(outDir, `shot-${shot.id}`);
  mkdirSync(shotDir, {recursive: true});
  const frames = [];
  for (const [k, v] of picks.entries()) {
    for (const [r, url] of v.frames.entries()) {
      const file = join(shotDir, `${k + 1}-${r}.jpg`);
      await download(url, file);
      const tag = v.kind === 'photo' ? 'photo' : `${Math.round(v.duration)}s${v.height > v.width ? '' : ' crop'}`;
      frames.push({file, col: k, row: r, label: r === 0 ? `#${k + 1}  ${tag}` : null});
    }
  }

  const W = 220;
  const H = 391;
  const inputs = frames.flatMap((f) => ['-i', f.file]);
  const parts = frames.map((f, i) => {
    let chain = `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
    if (f.label && FONT) chain += `,drawbox=x=0:y=0:w=iw:h=44:color=black@0.65:t=fill,drawtext=fontfile='${FONT}':text='${f.label}':x=10:y=10:fontsize=26:fontcolor=white`;
    return `${chain}[f${i}]`;
  });
  const layout = frames.map((f) => `${f.col * W}_${f.row * H}`).join('|');
  const filter = `${parts.join(';')};${frames.map((_, i) => `[f${i}]`).join('')}xstack=inputs=${frames.length}:layout=${layout}:fill=white`;
  execFileSync(ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-frames:v', '1', join(outDir, `shot-${shot.id}.png`)]);

  result[shot.id] = picks.map((v, k) => ({n: k + 1, source, ...v, frames: undefined}));
}

const ordered = Object.fromEntries(shots.filter((s) => result[s.id]).map((s) => [s.id, result[s.id]]));
writeFileSync(candidatesFile, JSON.stringify(ordered, null, 1));
console.log(
  JSON.stringify(
    {
      source,
      timing: measured ? 'measured from voiceover' : 'estimated from words',
      shots: shots.filter((s) => !only || only.includes(s.id)).map((s) => ({id: s.id, seconds: s.seconds, candidates: (result[s.id] ?? []).map((x) => `#${x.n} ${x.kind === 'photo' ? 'photo' : Math.round(x.duration) + 's'} "${x.query}"`)})),
      sheets: (only ?? Object.keys(ordered)).filter((id) => result[id]).map((id) => `${outDir}/shot-${id}.png`),
      warnings,
    },
    null,
    1,
  ),
);
