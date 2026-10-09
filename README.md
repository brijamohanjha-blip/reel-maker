# reel-maker

A [Claude Code](https://claude.com/claude-code) skill that turns a video idea into a 30–50 second vertical Reel (Instagram Reels, YouTube Shorts, TikTok).

You bring the idea, record the voiceover, and generate the clips with whichever AI video tool you like. Claude writes the script and the clip prompts, then cuts everything together with word-by-word captions.

## How it works

1. **Idea → script.** Tell Claude your idea. You get:
   - the exact voiceover script to paste into ElevenLabs (or any TTS), sized to 30–50 s;
   - a beat-by-beat breakdown;
   - a numbered **fact sheet** with every claim, what to verify and which kind of source settles it. You check the facts before recording.
2. **Script → clip prompts.** One clip per beat, each with its full prompt, the length to generate (5 s or 10 s) and a file name (`scene-1.mp4`, …). A shared style line keeps the clips consistent.
3. **Audio + clips → finished Reel.** Hand back the audio and the clips. Claude:
   - transcribes the audio locally with Whisper, then aligns it to your exact script (handling misheard, merged, split and repeated words) so the captions use your spelling with real timings;
   - starts each clip on the first spoken word of its beat, with a punch-in on every cut and a slow push so the frame keeps moving;
   - adds TikTok-style captions with the spoken word highlighted, inside a 120px safe margin so Instagram's buttons don't cover them;
   - appends a 2-second disclosure end card;
   - checks stills against the safe margins, then renders a 1080×1920, 30 fps MP4.

Built for Hinglish (Hindi in Roman script) health and skincare explainers, but it works for any language Whisper supports and any topic.

## Install

Requirements: [Claude Code](https://claude.com/claude-code), Node.js 18+, macOS or Linux, about 3 GB of disk space (packages plus the Whisper model).

```bash
git clone https://github.com/brijamohanjha-blip/reel-maker.git ~/.claude/skills/reel-maker
```

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

- Every Reel ends with a 2 s end card. The default is "AI voice used. Not medical advice." You can change the wording per Reel (`endCardText`), but not remove the card.
- Health claims are hedged. No "cures", "permanent", dosages or result promises.
- No AI person giving a testimonial. No faces of real people, brand packaging, before/after visuals or bald scalps in prompts or accepted clips.
- No invented studies or statistics. You verify the fact sheet before posting.
- No music unless you ask.

When posting AI-generated clips, also use the platform's AI-content label.

## Licenses

This repository is MIT-licensed (see [LICENSE](LICENSE)).

It depends on [Remotion](https://www.remotion.dev), which has its own license. Remotion is free for individuals and small teams; larger companies need a company license. Check [remotion.dev/license](https://www.remotion.dev/license) before commercial use. AI video tools and TTS services have their own terms for commercial use of their output.
