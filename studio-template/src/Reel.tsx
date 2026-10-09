import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, staticFile, useVideoConfig} from 'remotion';
import {EndCard} from './EndCard';
import {Scene} from './Scene';
import {WordCaptions, WORD_CAPTIONS_HEIGHT} from './WordCaptions';
import {COLORS, END_CARD_SECONDS, FONT_FAMILY} from './theme';
import {ReelProps} from './types';

export const Reel: React.FC<ReelProps> = ({scenes, resolved, endCard, endCardText}) => {
  const {fps} = useVideoConfig();
  const lastEnd = scenes[scenes.length - 1].end;
  const wordCaptions = resolved?.captions ?? null;
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.background, fontFamily: FONT_FAMILY}}>
      {resolved?.audio ? <Audio src={staticFile(resolved.audio)} /> : null}
      {resolved?.music ? <Audio src={staticFile(resolved.music)} /> : null}
      {scenes.map((scene, i) => (
        <Sequence
          key={i}
          from={Math.round(scene.start * fps)}
          durationInFrames={Math.round((scene.end - scene.start) * fps)}
          premountFor={fps}
          name={`Scene ${i + 1}`}
        >
          <Scene
            scene={scene}
            video={resolved?.videos?.[i] ?? null}
            isLast={i === scenes.length - 1}
            isHook={i === 0}
            reserveBottom={wordCaptions ? WORD_CAPTIONS_HEIGHT : 0}
          />
        </Sequence>
      ))}
      {wordCaptions ? (
        <Sequence durationInFrames={Math.round(lastEnd * fps)} name="Word captions">
          <WordCaptions captions={wordCaptions} />
        </Sequence>
      ) : null}
      {endCard === false ? null : (
        <Sequence from={Math.round(lastEnd * fps)} durationInFrames={END_CARD_SECONDS * fps} premountFor={fps} name="End card">
          <EndCard text={endCardText} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
