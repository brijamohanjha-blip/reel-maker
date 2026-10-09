import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, staticFile, useVideoConfig} from 'remotion';
import {EndCard} from './EndCard';
import {Scene} from './Scene';
import {TextCard} from './TextCard';
import {WordCaptions, WORD_CAPTIONS_HEIGHT} from './WordCaptions';
import {COLORS, END_CARD_SECONDS, FONT_FAMILY} from './theme';
import {ReelProps} from './types';

export const Reel: React.FC<ReelProps> = ({scenes, texts, resolved, endCard, endCardText}) => {
  const {fps} = useVideoConfig();
  const lastEnd = scenes[scenes.length - 1].end;
  const wordCaptions = resolved?.captions ?? null;
  const reserveBottom = wordCaptions ? WORD_CAPTIONS_HEIGHT : 0;
  // Round start and end to frames (not start and length) so back-to-back shots never leave a 1-frame gap.
  const frames = (start: number, end: number) => ({from: Math.round(start * fps), durationInFrames: Math.round(end * fps) - Math.round(start * fps)});
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.background, fontFamily: FONT_FAMILY}}>
      {resolved?.audio ? <Audio src={staticFile(resolved.audio)} /> : null}
      {resolved?.music ? <Audio src={staticFile(resolved.music)} /> : null}
      {scenes.map((scene, i) => (
        <Sequence key={i} {...frames(scene.start, scene.end)} premountFor={fps} name={`Shot ${i + 1}`}>
          <Scene
            scene={scene}
            video={resolved?.videos?.[i] ?? null}
            image={resolved?.images?.[i] ?? null}
            isLast={i === scenes.length - 1}
            isHook={i === 0}
            reserveBottom={reserveBottom}
          />
        </Sequence>
      ))}
      {(texts ?? []).map((t, i) => (
        <Sequence key={`t${i}`} {...frames(t.start, t.end)} name={`Text: ${t.text}`}>
          <TextCard text={t.text} isHook={i === 0 && t.start === 0} reserveBottom={reserveBottom} />
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
