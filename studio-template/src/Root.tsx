import type {Caption} from '@remotion/captions';
import {CalculateMetadataFunction, Composition, getStaticFiles, staticFile} from 'remotion';
import sample from '../reels/example.json';
import {Reel} from './Reel';
import {END_CARD_SECONDS, FPS, HEIGHT, WIDTH} from './theme';
import {ReelProps, validateReel} from './types';

const existsInPublic = (path: string | null | undefined): string | null => {
  if (!path) return null;
  const clean = path.replace(/^\/+/, '').replace(/^public\//, '');
  return getStaticFiles().some((f) => f.name === clean) ? clean : null;
};

const calculateMetadata: CalculateMetadataFunction<ReelProps> = async ({props}) => {
  validateReel(props);
  const lastEnd = props.scenes[props.scenes.length - 1].end;
  const captionsPath = existsInPublic(props.captions);
  const captions: Caption[] | null = captionsPath ? await (await fetch(staticFile(captionsPath))).json() : null;
  if (props.captions && !captions) {
    throw new Error(`Captions file "${props.captions}" not found in public/.`);
  }
  return {
    // The end card is always appended after the last scene, so no Reel can ship without it.
    durationInFrames: Math.round((lastEnd + END_CARD_SECONDS) * FPS),
    props: {
      ...props,
      resolved: {
        audio: existsInPublic(props.audio),
        videos: props.scenes.map((s) => existsInPublic(s.video)),
        captions,
      },
    },
  };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={30 * FPS}
    defaultProps={sample as ReelProps}
    calculateMetadata={calculateMetadata}
  />
);
