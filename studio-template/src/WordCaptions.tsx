import {Caption, createTikTokStyleCaptions} from '@remotion/captions';
import {Fragment, useMemo} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, SAFE_BOTTOM, SAFE_SIDE} from './theme';

export const WORD_CAPTIONS_HEIGHT = 230;
const COMBINE_WITHIN_MS = 1100;

/** TikTok-style captions: a few words at a time, the word being spoken highlighted. */
export const WordCaptions: React.FC<{captions: Caption[]}> = ({captions}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const {pages} = useMemo(() => createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds: COMBINE_WITHIN_MS}), [captions]);

  const page = pages.find((p, i) => ms >= p.startMs && ms < (pages[i + 1]?.startMs ?? p.startMs + p.durationMs));
  if (!page) return null;
  const pageIn = interpolate(ms - page.startMs, [0, 150], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: SAFE_SIDE,
          right: SAFE_SIDE,
          bottom: SAFE_BOTTOM + 16,
          height: WORD_CAPTIONS_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          opacity: pageIn,
          translate: `0px ${(1 - pageIn) * 16}px`,
        }}
      >
        <div style={{fontSize: 68, fontWeight: 800, lineHeight: 1.22, color: COLORS.text, textShadow: '0 4px 20px rgba(0,0,0,0.55)'}}>
          {page.tokens.map((t, i) => {
            const active = ms >= t.fromMs && ms < t.toMs;
            const word = t.text.trimStart();
            return (
              <Fragment key={i}>
                {t.text.length > word.length ? ' ' : ''}
                <span
                  style={{
                    display: 'inline-block',
                    color: active ? COLORS.warm : COLORS.text,
                    scale: active ? 1.08 : 1,
                    transformOrigin: '50% 80%',
                  }}
                >
                  {word}
                </span>
              </Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
