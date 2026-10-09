import {Video} from '@remotion/media';
import {Fragment} from 'react';
import {AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from './Backdrop';
import {Gradient} from './illustrations';
import {COLORS, SAFE_BOTTOM, SAFE_SIDE, SAFE_TOP} from './theme';
import {ReelScene} from './types';

const TRANSITION_FRAMES = 9;

const headlineSize = (text: string, isHook: boolean) => {
  if (isHook) return text.length > 28 ? 104 : 124;
  if (text.length > 48) return 70;
  if (text.length > 28) return 82;
  return 96;
};

type SceneProps = {
  scene: ReelScene;
  video: string | null;
  isHook: boolean;
  isLast: boolean;
  reserveBottom: number;
};

export const Scene: React.FC<SceneProps> = ({scene, video, isHook, isLast, reserveBottom}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  // Clip scenes cut quickly (short fade in, no fade out) so the edit feels snappy; the last one fades out.
  // The first scene starts fully visible so frame 0 is never blank.
  const inFrames = video ? 5 : TRANSITION_FRAMES;
  const fadeIn = isHook ? 1 : interpolate(frame, [0, inFrames], [0, 1], {extrapolateRight: 'clamp'});
  const fadeOut =
    video && !isLast
      ? 1
      : interpolate(frame, [durationInFrames - TRANSITION_FRAMES, durationInFrames], [1, 0], {extrapolateLeft: 'clamp'});

  // Hook: quick, springy entrance. Other headlines: gentle rise.
  const enter = spring({frame: isHook ? frame + 3 : frame - 4, fps, config: isHook ? {damping: 11, stiffness: 160} : {damping: 200}});

  return (
    <AbsoluteFill style={{opacity: Math.min(fadeIn, fadeOut)}}>
      {video ? (
        <AbsoluteFill>
          <Video
            src={staticFile(video)}
            muted
            loop
            objectFit="cover"
            style={{
              width: '100%',
              height: '100%',
              // Punch in on the cut, then a slow push so the frame always moves.
              scale: interpolate(frame, [0, 0.6 * fps, durationInFrames], [1.08, 1, 1.06], {
                extrapolateRight: 'clamp',
                easing: Easing.inOut(Easing.cubic),
              }),
            }}
          />
          <AbsoluteFill
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0.78) 100%)',
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill>
          <Backdrop />
          {/* Missing clip: a soft drifting fallback so the frame still moves. */}
          <AbsoluteFill style={{padding: `${SAFE_TOP}px ${SAFE_SIDE}px ${SAFE_BOTTOM + reserveBottom}px`}}>
            <Gradient />
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {scene.text ? (
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
          }}
        >
          <div
            style={{
              color: COLORS.text,
              fontSize: headlineSize(scene.text, isHook),
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
            {scene.text.split(' ').map((w, i) => (
              <Fragment key={i}>
                {i ? ' ' : ''}
                <span style={{whiteSpace: 'nowrap'}}>{w}</span>
              </Fragment>
            ))}
            <div style={{width: 96, height: 2, background: COLORS.accent, boxShadow: `0 0 12px ${COLORS.accent}`, margin: '30px auto 0'}} />
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
