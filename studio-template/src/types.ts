import type {Caption} from '@remotion/captions';

export type ReelScene = {
  /** Seconds from the start of the Reel. */
  start: number;
  end: number;
  /** Optional big on-screen text (normally only the hook). */
  text: string;
  /** Path relative to public/ of the scene's clip (e.g. "jobs/<slug>/clips/scene-1.mp4"). Plays full-screen, muted. */
  video?: string;
};

export type ReelProps = {
  title?: string;
  /** Path relative to public/, e.g. "jobs/<slug>/voiceover.mp3". Played only if the file exists. */
  audio?: string | null;
  /** Path relative to public/ of a background music file, pre-leveled to sit under the voice. */
  music?: string | null;
  /** Path relative to public/ of a word-level Caption[] JSON. Shown TikTok-style along the bottom. */
  captions?: string | null;
  scenes: ReelScene[];
  /** Show the 2 s disclosure end card (default true in the template; build-reel sets it from plan.json). */
  endCard?: boolean;
  /** Overrides the end card's text. */
  endCardText?: string;
  /** Filled in by calculateMetadata from what actually exists in public/. Never set in JSON. */
  resolved?: {audio: string | null; music: string | null; videos: (string | null)[]; captions: Caption[] | null};
};

export const validateReel = (props: ReelProps): void => {
  if (!Array.isArray(props.scenes) || props.scenes.length === 0) {
    throw new Error('Reel JSON needs a non-empty "scenes" list.');
  }
  props.scenes.forEach((s, i) => {
    const where = `Scene ${i + 1}`;
    if (typeof s.start !== 'number' || typeof s.end !== 'number' || s.end <= s.start) {
      throw new Error(`${where}: "end" must be a number greater than "start".`);
    }
    if (i > 0 && s.start < props.scenes[i - 1].end) {
      throw new Error(`${where}: starts before scene ${i} ends. Scenes must be in order and not overlap.`);
    }
    if (typeof s.text !== 'string') {
      throw new Error(`${where}: "text" must be a string ("" for none).`);
    }
  });
};
