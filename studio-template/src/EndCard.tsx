import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {Backdrop} from './Backdrop';
import {COLORS, END_CARD_TEXT, SAFE_BOTTOM, SAFE_SIDE, SAFE_TOP} from './theme';

/** Fixed disclosure card. Appended to every Reel by the template; not configurable from JSON. */
export const EndCard: React.FC<{text?: string}> = ({text}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease)});
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill
        style={{
          padding: `${SAFE_TOP}px ${SAFE_SIDE}px ${SAFE_BOTTOM}px`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{opacity: p, transform: `translateY(${(1 - p) * 24}px)`, textAlign: 'center'}}>
          <div style={{width: 96, height: 2, background: COLORS.accent, boxShadow: `0 0 12px ${COLORS.accent}`, margin: '0 auto 48px'}} />
          <div style={{color: COLORS.text, fontSize: 76, fontWeight: 700, lineHeight: 1.25}}>{text || END_CARD_TEXT}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
