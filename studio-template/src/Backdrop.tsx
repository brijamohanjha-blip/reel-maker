import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS} from './theme';

/** Deep navy-to-teal gradient with a slowly drifting glow and a soft vignette. */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [38, 46]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `linear-gradient(170deg, ${COLORS.background} 0%, ${COLORS.backgroundDeep} 100%)`}} />
      <AbsoluteFill
        style={{background: `radial-gradient(60% 40% at 50% ${drift}%, rgba(95,211,203,0.10) 0%, rgba(95,211,203,0) 100%)`}}
      />
      <AbsoluteFill style={{background: 'radial-gradient(120% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)'}} />
    </AbsoluteFill>
  );
};
