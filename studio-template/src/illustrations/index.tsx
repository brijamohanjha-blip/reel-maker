import {useCurrentFrame} from 'remotion';
import {COLORS} from '../theme';
import {Defs, line, svgProps, useReveal} from './primitives';

/** Fallback visual for a scene whose clip is missing: soft drifting glow with thin rings. */
export const Gradient: React.FC = () => {
  const frame = useCurrentFrame();
  const id = 'grad';
  const drift = Math.sin(frame / 60) * 24;
  const appear = useReveal(0, 0.6);
  return (
    <svg {...svgProps}>
      <Defs id={id} />
      <circle cx={330 + drift} cy="360" r="200" fill={COLORS.accent} opacity="0.18" filter={`url(#${id}-soft)`} />
      <circle cx={480 - drift} cy="460" r="180" fill={COLORS.warm} opacity="0.14" filter={`url(#${id}-soft)`} />
      {[110, 170, 230, 290].map((r, i) => (
        <circle key={r} cx="400" cy="410" r={r * (0.92 + 0.08 * appear)} {...line(id)} opacity={(0.5 - i * 0.1) * appear} />
      ))}
    </svg>
  );
};
