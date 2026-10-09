import {Video} from '@remotion/media';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from './Backdrop';
import {Gradient} from './illustrations';
import {TextCard} from './TextCard';
import {SAFE_BOTTOM, SAFE_SIDE, SAFE_TOP} from './theme';
import {ReelScene} from './types';

const TRANSITION_FRAMES = 9;

// Darkens the top a little and the bottom a lot so text and captions stay readable on any footage.
const OVERLAY = 'linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0.78) 100%)';

type SceneProps = {
  scene: ReelScene;
  video: string | null;
  image: string | null;
  isHook: boolean;
  isLast: boolean;
  reserveBottom: number;
};

export const Scene: React.FC<SceneProps> = ({scene, video, image, isHook, isLast, reserveBottom}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const media = video ?? image;

  // Footage hard-cuts between shots (the punch-in carries the energy); only the gradient fallback fades in.
  // The last shot fades out to close the Reel.
  const fadeIn = media || isHook ? 1 : interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {extrapolateRight: 'clamp'});
  const fadeOut =
    media && !isLast ? 1 : interpolate(frame, [durationInFrames - TRANSITION_FRAMES, durationInFrames], [1, 0], {extrapolateLeft: 'clamp'});

  // Punch in on the cut, then a slow push so the frame always moves.
  const scale = interpolate(frame, [0, Math.min(0.6 * fps, durationInFrames / 2), durationInFrames], [1.08, 1, 1.06], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{opacity: Math.min(fadeIn, fadeOut)}}>
      {video ? (
        <AbsoluteFill>
          <Video src={staticFile(video)} muted loop objectFit="cover" style={{width: '100%', height: '100%', scale}} />
          <AbsoluteFill style={{background: OVERLAY}} />
        </AbsoluteFill>
      ) : image ? (
        <AbsoluteFill>
          {/* Photos get the same punch-in plus a slight drift so a still never looks frozen. */}
          <Img
            src={staticFile(image)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              scale: scale + 0.04,
              translate: `0px ${interpolate(frame, [0, durationInFrames], [12, -12])}px`,
            }}
          />
          <AbsoluteFill style={{background: OVERLAY}} />
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

      {scene.text ? <TextCard text={scene.text} isHook={isHook} reserveBottom={reserveBottom} /> : null}
    </AbsoluteFill>
  );
};
