import {loadFont as loadNotoSans} from '@remotion/google-fonts/NotoSans';
import {loadFont as loadNotoDevanagari} from '@remotion/google-fonts/NotoSansDevanagari';

const {fontFamily: latin} = loadNotoSans('normal', {weights: ['400', '500', '600', '700', '800'], subsets: ['latin', 'latin-ext']});
const {fontFamily: devanagari} = loadNotoDevanagari('normal', {weights: ['400', '500', '600', '700', '800'], subsets: ['devanagari']});

// Latin glyphs come from Noto Sans; Devanagari glyphs fall through to Noto Sans Devanagari.
export const FONT_FAMILY = `${latin}, ${devanagari}, sans-serif`;

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

// Instagram's buttons and caption cover the top and bottom of a Reel: no text inside these margins.
export const SAFE_TOP = 120;
export const SAFE_BOTTOM = 120;
export const SAFE_SIDE = 72;

export const END_CARD_SECONDS = 2;
export const END_CARD_TEXT = 'AI voice used. Not medical advice.';

// Clinical infographic palette: deep navy/teal, white, one teal accent, one warm highlight.
export const COLORS = {
  background: '#08161F',
  backgroundDeep: '#0D2C33',
  accent: '#5FD3CB',
  warm: '#EDB07C',
  text: '#F3F7F8',
  textMuted: 'rgba(243,247,248,0.62)',
  panel: 'rgba(5,16,24,0.58)',
  panelBorder: 'rgba(255,255,255,0.10)',
};
