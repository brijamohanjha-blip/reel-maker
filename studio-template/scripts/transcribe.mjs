// Transcribe an audio file to word-level captions with Whisper (WebGPU), per the remotion-captions skill.
// Usage: node scripts/transcribe.mjs public/audio/<name>.mp3 <language> <out.json> [model]
import {registerMediabunnyServer} from '@mediabunny/server';
import {
  WHISPER_WEBGPU_SAMPLE_RATE,
  canUseWhisperWebGpu,
  downloadWhisperModel,
  loadWhisperModel,
  toCaptions,
  transcribe,
} from '@remotion/whisper-webgpu';
import {ALL_FORMATS, Conversion, FilePathSource, Input, NullTarget, Output, WavOutputFormat} from 'mediabunny';
import {writeFile} from 'node:fs/promises';

const [file, language, outFile, model = 'small'] = process.argv.slice(2);
registerMediabunnyServer();

const support = await canUseWhisperWebGpu();
if (!support.supported) throw new Error(support.detailedReason);

const chunks = [];
const input = new Input({formats: ALL_FORMATS, source: new FilePathSource(file)});
const audioTrack = await input.getPrimaryAudioTrack();
if (audioTrack === null) throw new Error('The media does not contain an audio track.');

const conversion = await Conversion.init({
  input,
  output: new Output({format: new WavOutputFormat(), target: new NullTarget()}),
  video: {discard: true},
  audio: (track) => {
    if (track.id !== audioTrack.id) return {discard: true};
    return {
      codec: 'pcm-f32',
      forceTranscode: true,
      numberOfChannels: 1,
      sampleFormat: 'f32',
      sampleRate: WHISPER_WEBGPU_SAMPLE_RATE,
      process: (sample) => {
        const waveform = new Float32Array(sample.allocationSize({format: 'f32', planeIndex: 0}) / Float32Array.BYTES_PER_ELEMENT);
        sample.copyTo(waveform, {format: 'f32', planeIndex: 0});
        chunks.push({startFrame: Math.round(sample.timestamp * WHISPER_WEBGPU_SAMPLE_RATE), waveform});
        return sample;
      },
    };
  },
});
if (!conversion.isValid) throw new Error('The audio track cannot be decoded.');
await conversion.execute();

const length = chunks.reduce((max, c) => Math.max(max, c.startFrame + c.waveform.length), 0);
const channelWaveform = new Float32Array(length);
for (const c of chunks) {
  const dst = Math.max(0, c.startFrame);
  const srcStart = Math.max(0, -c.startFrame);
  const n = Math.min(c.waveform.length - srcStart, channelWaveform.length - dst);
  if (n > 0) channelWaveform.set(c.waveform.subarray(srcStart, srcStart + n), dst);
}

await downloadWhisperModel({model});
const handle = await loadWhisperModel({model});
const transcription = await transcribe({channelWaveform, model, language});
const {captions} = toCaptions({whisperWebGpuOutput: transcription});
await writeFile(outFile, JSON.stringify(captions, null, 2));
await handle[Symbol.asyncDispose]?.();
console.log(`${captions.length} captions -> ${outFile}`);
