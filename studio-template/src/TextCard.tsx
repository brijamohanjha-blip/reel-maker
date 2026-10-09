import {Fragment} from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, SAFE_BOTTOM, SAFE_SIDE, SAFE_TOP} from './theme';

const headlineSize = (text: string, isHook: boolean) => {
  if (isHook) return text.length > 28 ? 104 : 124;
  if (text.length > 48) return 70;
  if (text.length > 28) return 82;
  return 96;
};

/** On-screen text card above the captions. The hook pops in; other cards rise gently. */
export const TextCard: React.FC<{text: string; isHook: boolean; reserveBottom: number}> = ({text, isHook, reserveBottom}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: isHook ? frame + 3 : frame - 4, fps, config: isHook ? {damping: 11, stiffness: 160} : {damping: 200}});
  return (
    <div
      style={{
        position: 'absolute',
        top: SAFE_TOP,
        bottom: SAFE_BOTTOM + 16 + reserveBottom,
        left: SAFE_SIDE,
        right: SAFE_SIDE,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          color: COLORS.text,
          fontSize: headlineSize(text, isHook),
          fontWeight: isHook ? 800 : 700,
          lineHeight: 1.18,
          letterSpacing: isHook ? -1.5 : -0.5,
          textAlign: 'center',
          textShadow: '0 4px 24px rgba(0,0,0,0.45)',
          padding: '24px 0 36px',
          opacity: isHook ? Math.min(1, enter * 1.5) : enter,
          translate: `0px ${(1 - enter) * (isHook ? 120 : 50)}px`,
          scale: isHook ? 0.7 + 0.3 * enter : 1,
        }}
      >
        {/* Words never split mid-word (e.g. at the hyphen in "dheere-dheere"). */}
        {text.split(' ').map((w, i) => (
          <Fragment key={i}>
            {i ? ' ' : ''}
            <span style={{whiteSpace: 'nowrap'}}>{w}</span>
          </Fragment>
        ))}
        <div style={{width: 96, height: 2, background: COLORS.accent, boxShadow: `0 0 12px ${COLORS.accent}`, margin: '30px auto 0'}} />
      </div>
    </div>
  );
};
