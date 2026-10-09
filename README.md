# reel-maker

A [Claude Code](https://claude.com/claude-code) skill that turns a video idea into a 30–50 second vertical Reel (Instagram Reels, YouTube Shorts, TikTok).

You bring the idea, record the voiceover, and generate the clips with whichever AI video tool you like. Claude writes the script and the clip prompts, then cuts everything together with word-by-word captions.

## How it works

1. **Idea → script.** Tell Claude your idea. You get:
   - the exact voiceover script to paste into ElevenLabs (or any TTS), sized to 30–50 s;
   - a beat-by-beat breakdown;
   - a numbered **fact sheet** with every claim, what to verify and which kind of source settles it. You check the facts before recording.
2. **Script → clips.** By default Claude searches **Pixabay** (or **Pexels**) for free stock footage: for every beat it finds clips long enough for the line that give a sharp 1080×1920 frame (portrait Full HD, or 4K landscape cropped to 9:16), shows you a contact sheet per scene with its recommended pick, and downloads the ones you approve (with photographer credits). Prefer AI video? Ask for prompts instead: one per beat, with the length to generate and a shared style line.
3. **Audio + clips → finished Reel.** Hand back the audio and the clips. Claude:
   - transcribes the audio locally with Whisper, then aligns it to your exact script (handling misheard, merged, split and repeated words) so the captions use your spelling with real timings;
   - starts each clip on the first spoken word of its beat, with a punch-in on every cut and a slow push so the frame keeps moving;
   - adds TikTok-style captions with the spoken word highlighted, inside a 120px safe margin so Instagram's buttons don't cover them;
   - fades out about a second after the last word (an optional 2-second disclosure end card can be switched on);
   - checks stills against the safe margins, then renders a 1080×1920, 30 fps MP4.

Built for Hinglish (Hindi in Roman script) health and skincare explainers, but it works for any language Whisper supports and any topic.

## Install

Requirements: [Claude Code](https://claude.com/claude-code), Node.js 18+, macOS or Linux, about 3 GB of disk space (packages plus the Whisper model).

```bash
git clone https://github.com/brijamohanjha-blip/reel-maker.git ~/.claude/skills/reel-maker
```

For automatic clip search, get a free API key and add it to your shell (never commit it):

- **Pixabay**: sign up at [pixabay.com](https://pixabay.com), then copy your key from [pixabay.com/api/docs](https://pixabay.com/api/docs/).
- **Pexels**: [pexels.com/api](https://www.pexels.com/api/) (new keys are sometimes paused).

```bash
cp .env.example .env    # then put your key in .env (it's git-ignored)
```

Without a key, Claude gives you search terms to use on the websites yourself.

That's it. Start Claude Code anywhere and type `/reel-maker <your idea>`, or just describe a Reel idea. On first use the skill copies `studio-template/` to `~/ReelStudio` and runs `npm install`. The first transcription downloads the Whisper model (about 500 MB).

Optional: the Remotion agent skills help Claude when editing the template. Install them inside `~/ReelStudio` with `npx remotion skills add`.

## What's inside

```
SKILL.md                 the 3-phase workflow Claude follows
references/script.md     hooks, structure, hedged health language, ElevenLabs formatting, fact-sheet format
references/clips.md      clip specs, prompt template, style lines, content rules
studio-template/         Remotion project that assembles the Reel
  scripts/transcribe.mjs     Whisper (WebGPU) word timings
  scripts/align-captions.mjs aligns the transcript to the exact script
  scripts/build-reel.mjs     builds the reel timeline from the plan and captions
  scripts/render.mjs         renders frames and encodes with ffmpeg-static (works on macOS < 15)
  scripts/find-clips.mjs     searches Pixabay/Pexels per beat, makes candidate contact sheets
  scripts/pick-clips.mjs     downloads and converts the chosen clips, writes credits
  scripts/make-music.mjs     optional original ambient music bed, leveled under the voice
  scripts/contact-sheet.mjs  stills with safe margins drawn, for checking
```

Each Reel is a job in `~/ReelStudio`:

```
jobs/<slug>/plan.json            beats, on-screen text, clip prompts and lengths
jobs/<slug>/script.txt           exact text to record
public/jobs/<slug>/voiceover.mp3
public/jobs/<slug>/clips/scene-<n>.mp4
reels/<slug>.json                generated timeline (editable)
out/<slug>.mp4                   the finished Reel
```

## Built-in rules

These are enforced by the skill and the template:

- The disclosure "AI voice used. Not medical advice." goes in the post caption by default; set `"endCard": true` in a job's plan to also show it as a 2 s end card in the video.
- Health claims are hedged. No "cures", "permanent", dosages or result promises.
- No AI person giving a testimonial. No faces of real people, brand packaging, before/after visuals or bald scalps in prompts or accepted clips.
- No invented studies or statistics. You verify the fact sheet before posting.
- No music unless you ask.

When posting AI-generated clips, also use the platform's AI-content label.

## Licenses

This repository is MIT-licensed (see [LICENSE](LICENSE)).

It depends on [Remotion](https://www.remotion.dev), which has its own license. Remotion is free for individuals and small teams; larger companies need a company license. Check [remotion.dev/license](https://www.remotion.dev/license) before commercial use. AI video tools and TTS services have their own terms for commercial use of their output.
