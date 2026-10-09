# Writing clip prompts

## Specs to state for every clip

- Vertical **9:16** (1080x1920 ideal, 720x1280 acceptable), 24-30 fps.
- **Length**: generate at least 0.5 s longer than the beat. Most tools offer 5 s or 10 s, so pick the smallest option that covers the beat. A clip that's too short will loop, which is visible.
- **No** text, subtitles, captions, logos, watermarks, UI or brand packaging. Sound doesn't matter (it's muted).
- Keep the **bottom third** visually calm (no key action there) because captions sit there.
- One continuous shot per clip with slow camera motion (push-in, orbit, dolly, drift). No hard cuts inside a clip.

## Prompt template

```
<SUBJECT doing ACTION>, <SETTING>. <CAMERA MOTION>. <STYLE LINE>. Vertical 9:16, no text, no logos, no people's faces, calm lower third.
```

Pick one **style line** per Reel and reuse it verbatim in every prompt so the clips match, e.g.:

- Clinical/science: "Dark navy and teal palette, cinematic 3D medical visualization, soft volumetric light, shallow depth of field, subtle glow, photoreal macro detail"
- Skincare/lifestyle: "Soft natural window light, warm neutral tones, minimal clean set, 50mm macro, gentle film grain"

Add a **negative line** if the tool supports it: "text, watermark, logo, brand label, human face, before and after, bald scalp, distorted anatomy, extra limbs, cartoon".

## Matching visuals to beats

| Beat type | Good visual |
|---|---|
| Hook (myth/question) | Striking macro of the subject (a single hair strand in light, a serum drop, sunlight through glass), slow rotation |
| Mechanism | Abstract 3D cross-section or particle metaphor. Keep it schematic: AI anatomy is often wrong, so prefer metaphor over literal biology |
| Time / patience | Time-lapse light, a calendar of shadows moving, a sun arc. No numbers rendered |
| Limits / caution | Slower, darker shot, light dimming, out-of-focus clinic background |
| Close (see a doctor) | Clean clinic desk, clipboard, dermatoscope, no people |

## Content rules for prompts

- No faces of real or realistic people; hands are fine if needed. Never an AI person giving a testimonial.
- No bald scalp, no before/after pairs, no product packaging or brand names.
- For hair/skin mechanisms, never show new follicles or hair "regrowing from nothing"; show existing structures only.
- If a beat's literal visual is risky or easily wrong, use an abstract metaphor.

## Shot list format (deliver like this)

```
Style line (use in every prompt): <style line>

Scene 1 — "<beat words>"
Beat ≈ 3.2 s → generate 5 s → save as scene-1.mp4
<full prompt>
```
