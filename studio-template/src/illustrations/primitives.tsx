import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS} from '../theme';

// Shared clinical line-art primitives: 1.5px glowing strokes, translucent fills, small labels, eased motion.

export const svgProps = {
  viewBox: '0 0 800 800',
  width: '100%',
  height: '100%',
  preserveAspectRatio: 'xMidYMid meet',
} as const;

export const STROKE = 1.5;
export const EASE = Easing.inOut(Easing.cubic);

/** 0→1 over ~0.5 s, starting at `delay` seconds. */
export const useReveal = (delay: number, seconds = 0.5) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return interpolate(frame, [delay * fps, (delay + seconds) * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
};

export const Defs: React.FC<{id: string}> = ({id}) => (
  <defs>
    <filter id={`${id}-glow`} filterUnits="userSpaceOnUse" x="-100" y="-100" width="1000" height="1000">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id={`${id}-soft`} filterUnits="userSpaceOnUse" x="-100" y="-100" width="1000" height="1000">
      <feGaussianBlur stdDeviation="28" />
    </filter>
  </defs>
);

export const line = (id: string, color: string = COLORS.accent) => ({
  stroke: color,
  strokeWidth: STROKE,
  fill: 'none',
  vectorEffect: 'non-scaling-stroke' as const,
  filter: `url(#${id}-glow)`,
  strokeLinecap: 'round' as const,
});
