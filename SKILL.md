---
name: reel-maker
description: Turn a video idea into a 30-50 second Instagram Reel in three steps. (1) Write the exact voiceover script to paste into ElevenLabs, plus a fact sheet for the user to verify. (2) Find matching stock clips on Pixabay or Pexels automatically (or give AI video-clip prompts). (3) When the user returns the audio and clips, sync them, add word-by-word captions and render the finished Reel. Use when the user shares a Reel/short-video idea, asks for a Reel script or clip prompts, or hands back voiceover audio and clips to assemble.
---

# Reel Maker

Three phases, each ending with a hand-off to the user. Work out which phase applies from what the user sent:

- **Idea only** → Phase 1, then Phase 2 in the same reply (with a stock API key, search for clips straight away).
- **Wants changes to the script or prompts** → revise, re-save the plan, re-deliver.
- **Audio file and/or clips** → Phase 3.

The engine is the Remotion project at `~/ReelStudio` (see its `CLAUDE.md`). If it's missing, copy `studio-template/` from this skill's directory to `~/ReelStudio` and run `npm install` there. The first transcription then downloads the Whisper model (~500 MB).

Each Reel is a **job** with a short kebab-case slug (e.g. `minoxidil-kaam-ya-hype`).

## Phase 1: script + fact sheet

Read [references/script.md](references/script.md) first and follow its steps in order. The goal is a script people send to a friend, not a list of tips.

1. Pick the language from the user's idea. Write the script in the language they'll record in (for Hindi speakers, Hinglish in Roman script records well in ElevenLabs).
2. Fill the brief silently (keyword phrase, named viewer, send target, lens, payoff, one surprise). Ask the user only if something essential is impossible to infer.
3. Choose a non-obvious **lens**, then write **three hook systems** from different archetypes (first frame + spoken line + on-screen text, each doing a different job). Recommend one.
4. Build the body as a **value-tease ladder** of 5-8 beats joined by "lekin / isliye", with a rehook before 10 s, a named list if there is one, and concrete instances instead of categories. Each beat is 3-8 s of speech; in Phase 2 it is split into 1-3 s shots that each show what is being said.
5. Write the ending first: a repeatable last line that loops into the hook, plus a named-persona send-prompt. Health topics keep the dermatologist/doctor line before it.
6. Target **2.8 words/second** (measured on an ElevenLabs Hinglish voice; if the user reports their voice runs faster or slower, use their rate): 30 s ≈ 80 words, 40 s ≈ 110 words, 50 s ≈ 135 words. The Reel ends about 1 s after the last word (or 2 s more if the user wants the end card).
7. The script is spoken text only. Never mention AI, generation, or the tools in it.
8. **Audit** with the 8-point rubric in references/script.md (score 0-16). Rewrite until it scores 13+.
9. Build the fact sheet: every factual claim, numbered, with what exactly to verify and the kind of source that settles it. Never invent citations, studies or statistics. If unsure of a number, say so and suggest wording that doesn't need it.
10. Save the plan in `~/ReelStudio/jobs/<slug>/`:
   - `plan.json`: `{slug, title, language, endCard?, endCardText?, beats: [{id, script, onScreenText?, onScreenCue?, shots?: [{cue?, search, media?}], clip?: {search?, prompt?, seconds}}]}`. `endCard` defaults to false (disclosure goes in the caption). `onScreenText` is max 6 words: always on beat 1 (the hook's text layer), and on later beats only for a named list's items or the payoff. Add `onScreenCue` (words from the beat) when the card should appear only once those words are spoken, so it never shows before its idea.
   - `script.txt`: the beats' `script` joined with single spaces. It must match the ElevenLabs text exactly.

**Deliver** (in chat):
- The three hook options (one line each per layer) with the recommended one marked.
- The ElevenLabs script in one copy-paste code block, exactly matching `script.txt`, with no beat labels inside it.
- Word count, estimated duration, the beat breakdown (beat number → its words → on-screen text), and the audit score with one line on the weakest point.
- The fact sheet as a numbered list.
- The suggested post caption (keyword first line, send-prompt, 3-5 hashtags, disclosure line).
- End with: "Verify these before recording. Tell me any changes and I'll update the script and clips."

## Phase 2: clips

Read [references/clips.md](references/clips.md) first. Two sources; **free stock footage is the default** unless the user asks for AI-generated clips.

Each beat needs a clip at least as long as the beat (words ÷ 2.8, plus 1 s). Save everything into `plan.json`.

### Stock clips and photos from Pixabay or Pexels (default)

**The picture must show what the voice is saying at that moment.** When the voice says "skin", the viewer sees skin; "face wash", foam; "dermatologist", a doctor. Mood shots (leaves, sky) only cover words that are about the weather or season. Read the clip rules in references/clips.md.

1. Split each beat into **shots** of roughly 1-3 s, one per concrete noun or action in the line: `beats[].shots: [{search: [...]}, {cue: "<words where it starts>", search: [...], media?: "video"|"photo"|"any"}]`. The first shot starts with the beat; every later shot needs a `cue` copied from the beat's script. Long lines get 2-4 shots; a 2-3 s line can stay one shot. Write 2-3 literal search terms per shot ("dry skin close up", not "dryness").
2. If `PIXABAY_API_KEY` or `PEXELS_API_KEY` is available (in the environment or in this skill's `.env` file; Pexels is used when both are), find candidates yourself: `REEL_MAKER_ENV=<this skill's directory>/.env node scripts/find-clips.mjs <slug> 4 3` (in `~/ReelStudio`; 4 videos + 3 photos per shot; photos come from Pixabay only). Shot lengths are measured from the voiceover once `captions.json` exists, otherwise estimated. Videos are kept only if long enough and sharp at 1080x1920 (portrait ≥1080 wide, or 4K landscape, centre-cropped, marked "crop"); photos only if portrait.
3. Open every sheet (`jobs/<slug>/candidates/shot-<id>.png`). For each shot pick the candidate that most literally matches its words. Reject visible text, logos, watermarks, brand packaging, before/after or bald-scalp imagery, and (unless the user allows them) faces. If nothing fits, change that shot's terms and re-search only it: `... find-clips.mjs <slug> 4 3 --only=2b,4c`. After two failed rounds, reuse a fitting clip from another job or accept the closest abstract match, and say so.
4. Download and convert the picks: `node scripts/pick-clips.mjs <slug> 1a=2 1b=1 2=4@0.3 ...` → `public/jobs/<slug>/clips/scene-<shot>.mp4` (video) or `.jpg` (photo, shown with a slow push and drift), plus credits in `jobs/<slug>/credits.txt`. For a landscape clip, `@left`, `@right` or a fraction chooses what survives the 9:16 crop; check one frame afterwards.
5. If neither key is set, give the user a shot list (shot → words it covers → search terms → minimum length) for pixabay.com or pexels.com, and tell them how to enable automatic search: get a free key (Pixabay: sign up, then copy it from https://pixabay.com/api/docs/; Pexels: https://www.pexels.com/api/, though new Pexels keys may be paused), copy `.env.example` in this skill's directory to `.env` and put the key there (or add `export PIXABAY_API_KEY="..."` to `~/.zshrc` and restart Claude Code). Never ask them to paste the key into the chat, and never write it anywhere except the git-ignored `.env` (the skill may be public). Never print the key or commit `.env`.

### AI-generated clips (if the user asks)

For each beat give: scene number, the beat's words, its estimated length (words ÷ 2.8), the **clip length to generate** (round up to the tool's 5 s or 10 s option, at least 0.5 s longer than the beat), the file name `scene-<id>.mp4`, and the full prompt in its own copy-paste block. Use one shared style line in every prompt so the clips match.

**Deliver**: the picks (or shot list), then this hand-back instruction: "Record the script in ElevenLabs and send me the audio file" (plus, for AI clips, "and the clips named scene-1.mp4, scene-2.mp4, …").

## Phase 3: assemble the Reel

Work in `~/ReelStudio`. Run commands with absolute paths or from that directory.

1. **Collect inputs.** Shots already picked with `pick-clips.mjs` are in place (if they were picked before the voiceover existed, re-run find-clips with real timings only for shots that now warn as too short); skip to the audio. Copy the audio to `public/jobs/<slug>/voiceover.mp3`; if it isn't MP3, convert it with `node_modules/ffmpeg-static/ffmpeg -i <in> -c:a libmp3lame -q:a 2 <out>`. Copy clips to `public/jobs/<slug>/clips/scene-<id>.mp4`; re-encode anything that isn't H.264 MP4 (`-c:v libx264 -pix_fmt yuv420p -an`). Open one frame of every clip (extract with ffmpeg, then Read it): reject or flag faces of real people, visible text, logos, watermarks, brand packaging, before/after or bald-scalp imagery.
2. **Confirm the words.** Ask whether the recording used `script.txt` unchanged. If not, get the final text, update `script.txt` and the beats in `plan.json` so the word counts still add up.
3. **Transcribe** (measured word timings): `node scripts/transcribe.mjs public/jobs/<slug>/voiceover.mp3 <hi|en> jobs/<slug>/whisper.json` (use `hi` for Hindi/Hinglish, `en` for English). If it fails, tell the user. Fall back to splitting time by word count only if they agree, and label the timings as estimated.
4. **Align**: `node scripts/align-captions.mjs jobs/<slug>/whisper.json jobs/<slug>/script.txt public/jobs/<slug>/captions.json`. This keeps the script's exact words and Whisper's timings. If `estimatedWords` is more than ~10% of `words`, the recording probably differs from the script: check before going on.
5. **Music (only if the user asked)**: `node scripts/make-music.mjs <slug> [dB below voice, default 18]` composes an original ambient bed (no copyright) sized to the whole Reel and levels it under the voice. If the user supplies their own track, convert it to `public/jobs/<slug>/music.mp3` and level it the same way. Run this before building.
6. **Build**: `node scripts/build-reel.mjs <slug>`. Each shot starts on its cue word; each beat's on-screen text stays up across its shots. Read the warnings (looping clips, missing clips). Total must be 30-50 s; if not, tell the user.
7. **Preview and check.** Start `npx remotion studio --props=reels/<slug>.json --no-open --port 3130` in the background. Render stills of frame 0, the middle of every shot, and the end card (`npx remotion render Reel out/stills-<slug> --sequence --image-format=png --frames=<list> --props=reels/<slug>.json`). Then run `node scripts/contact-sheet.mjs out/stills-<slug> out/stills-<slug>.png` and open the sheet. Check that captions are readable, no text crosses the red safe-margin lines, the hook text fits, clips suit their lines, the last scene fades out cleanly (or the end card shows, if on). Fix problems in `reels/<slug>.json` or the clips, then re-check.
8. **Render**: `npm run render -- reels/<slug>.json` → `out/<slug>.mp4`. Confirm the duration, 1080x1920, 30 fps and an audio stream (`node_modules/ffmpeg-static/ffmpeg -i out/<slug>.mp4`).

**Deliver**: the MP4 path; a suggested Instagram caption that ends with the disclosure line; whether timings were measured or estimated (and how many words were estimated); any clip that loops or is missing (shown as a soft gradient fallback); anything you're unsure of; and a reminder that the fact sheet must be checked before posting.

## Rules (always)

- Disclosure: by default there is **no end card**; the user puts "AI voice used. Not medical advice." (or "AI voice used." for non-health topics) in the Instagram caption. Always include that line in the suggested post caption you deliver. Add the 2 s end card only if the user asks: `"endCard": true` (and optional `endCardText`) in `plan.json`.
- Health and skin topics: no "cures", "permanent", "guaranteed", dosages or result promises. Hedge ("ho sakta hai", "maana jaata hai", "research suggests"), and close with "see a dermatologist/doctor" where relevant.
- Never write a testimonial or a first-person "I tried this" story for an AI voice, and never prompt for an AI person giving one.
- No faces of real people, brand packaging or logos, before/after visuals, or bald scalps, in prompts or in accepted clips.
- No music unless asked. Don't add features the user didn't ask for.
- Facts: the user verifies them. Flag anything uncertain instead of smoothing it over.
