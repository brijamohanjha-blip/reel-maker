---
name: reel-maker
description: Turn a video idea into a 30-50 second Instagram Reel in three steps. (1) Write the exact voiceover script to paste into ElevenLabs, plus a fact sheet for the user to verify. (2) Give the exact AI video-clip prompts and durations to generate. (3) When the user returns the audio and clips, sync them, add word-by-word captions and render the finished Reel. Use when the user shares a Reel/short-video idea, asks for a Reel script or clip prompts, or hands back voiceover audio and clips to assemble.
---

# Reel Maker

Three phases, each ending with a hand-off to the user. Work out which phase applies from what the user sent:

- **Idea only** → Phase 1, then Phase 2 in the same reply.
- **Wants changes to the script or prompts** → revise, re-save the plan, re-deliver.
- **Audio file and/or clips** → Phase 3.

The engine is the Remotion project at `~/ReelStudio` (see its `CLAUDE.md`). If it's missing, copy `studio-template/` from this skill's directory to `~/ReelStudio` and run `npm install` there. The first transcription then downloads the Whisper model (~500 MB).

Each Reel is a **job** with a short kebab-case slug (e.g. `minoxidil-kaam-ya-hype`).

## Phase 1: script + fact sheet

Read [references/script.md](references/script.md) first.

1. Pick the language from the user's idea. Write the script in the language they'll record in (for Hindi speakers, Hinglish in Roman script records well in ElevenLabs).
2. Plan 5-8 **beats** (hook → tension → 2-4 value beats → payoff → soft close). Each beat is 3-8 s of speech and becomes one clip.
3. Write the voiceover. Target **2.8 words/second** (measured on an ElevenLabs Hinglish voice; if the user reports their voice runs faster or slower, use their rate): 30 s ≈ 80 words, 40 s ≈ 110 words, 50 s ≈ 135 words. Leave 2 s for the end card inside the 30-50 s total.
4. The script is spoken text only. Never mention AI, generation, or the tools in it.
5. Build the fact sheet: every factual claim, numbered, with what exactly to verify and the kind of source that settles it. Never invent citations, studies or statistics. If unsure of a number, say so and suggest wording that doesn't need it.
6. Save the plan in `~/ReelStudio/jobs/<slug>/`:
   - `plan.json`: `{slug, title, language, endCardText?, beats: [{id, script, onScreenText?, clip: {prompt, seconds}}]}`. `onScreenText` is optional, max 6 words, normally only for beat 1 (the hook).
   - `script.txt`: the beats' `script` joined with single spaces. It must match the ElevenLabs text exactly.

**Deliver** (in chat):
- The ElevenLabs script in one copy-paste code block, exactly matching `script.txt`, with no beat labels inside it.
- Word count, estimated duration, and the beat breakdown (beat number → its words).
- The fact sheet as a numbered list. End with: "Verify these before recording. Tell me any changes and I'll update the script and prompts."

## Phase 2: clip prompts

Read [references/clips.md](references/clips.md) first.

For each beat give: scene number, the beat's words, its estimated length (words ÷ 2.8), the **clip length to generate** (round up to the tool's 5 s or 10 s option, at least 0.5 s longer than the beat), the file name `scene-<id>.mp4`, and the full prompt in its own copy-paste block. Use one shared style line in every prompt so the clips match. Save prompts and seconds into `plan.json`.

**Deliver**: the shot list, then this hand-back instruction: "Record the script in ElevenLabs and generate each clip at 9:16. Send me the audio file and the clips named scene-1.mp4, scene-2.mp4, … (or tell me which file is which scene)."

## Phase 3: assemble the Reel

Work in `~/ReelStudio`. Run commands with absolute paths or from that directory.

1. **Collect inputs.** Copy the audio to `public/jobs/<slug>/voiceover.mp3`; if it isn't MP3, convert it with `node_modules/ffmpeg-static/ffmpeg -i <in> -c:a libmp3lame -q:a 2 <out>`. Copy clips to `public/jobs/<slug>/clips/scene-<id>.mp4`; re-encode anything that isn't H.264 MP4 (`-c:v libx264 -pix_fmt yuv420p -an`). Open one frame of every clip (extract with ffmpeg, then Read it): reject or flag faces of real people, visible text, logos, watermarks, brand packaging, before/after or bald-scalp imagery.
2. **Confirm the words.** Ask whether the recording used `script.txt` unchanged. If not, get the final text, update `script.txt` and the beats in `plan.json` so the word counts still add up.
3. **Transcribe** (measured word timings): `node scripts/transcribe.mjs public/jobs/<slug>/voiceover.mp3 <hi|en> jobs/<slug>/whisper.json` (use `hi` for Hindi/Hinglish, `en` for English). If it fails, tell the user. Fall back to splitting time by word count only if they agree, and label the timings as estimated.
4. **Align**: `node scripts/align-captions.mjs jobs/<slug>/whisper.json jobs/<slug>/script.txt public/jobs/<slug>/captions.json`. This keeps the script's exact words and Whisper's timings. If `estimatedWords` is more than ~10% of `words`, the recording probably differs from the script: check before going on.
5. **Build**: `node scripts/build-reel.mjs <slug>`. Each scene starts on its beat's first spoken word. Read the warnings (looping clips, missing clips). Total must be 30-50 s; if not, tell the user.
6. **Preview and check.** Start `npx remotion studio --props=reels/<slug>.json --no-open --port 3130` in the background. Render stills of frame 0, the middle of every scene, and the end card (`npx remotion render Reel out/stills-<slug> --sequence --image-format=png --frames=<list> --props=reels/<slug>.json`). Then run `node scripts/contact-sheet.mjs out/stills-<slug> out/stills-<slug>.png` and open the sheet. Check that captions are readable, no text crosses the red safe-margin lines, the hook text fits, clips suit their lines, and the end card shows. Fix problems in `reels/<slug>.json` or the clips, then re-check.
7. **Render**: `npm run render -- reels/<slug>.json` → `out/<slug>.mp4`. Confirm the duration, 1080x1920, 30 fps and an audio stream (`node_modules/ffmpeg-static/ffmpeg -i out/<slug>.mp4`).

**Deliver**: the MP4 path; whether timings were measured or estimated (and how many words were estimated); any clip that loops or is missing (shown as a soft gradient fallback); anything you're unsure of; and a reminder that the fact sheet must be checked before posting.

## Rules (always)

- End card in the last 2 s of every Reel (the template appends it). Default "AI voice used. Not medical advice."; for non-health topics, set `endCardText` (e.g. "AI voice used.") but never remove the card.
- Health and skin topics: no "cures", "permanent", "guaranteed", dosages or result promises. Hedge ("ho sakta hai", "maana jaata hai", "research suggests"), and close with "see a dermatologist/doctor" where relevant.
- Never write a testimonial or a first-person "I tried this" story for an AI voice, and never prompt for an AI person giving one.
- No faces of real people, brand packaging or logos, before/after visuals, or bald scalps, in prompts or in accepted clips.
- No music unless asked. Don't add features the user didn't ask for.
- Facts: the user verifies them. Flag anything uncertain instead of smoothing it over.
