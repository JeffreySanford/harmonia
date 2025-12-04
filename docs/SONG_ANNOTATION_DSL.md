# Song Annotation DSL — Full Design, Grammar, Parser, Schema, and Integration Guide

## Executive Summary

Treat a lyric file as a multi-layered audio blueprint with three explicit annotation layers:

- **[Section]** — structural markers (macroform)
- **(Performance)** — vocal/stage directions (delivery metadata)
- **\<Audio Cue\>** — SFX/instrument/action commands (engine triggers)

This removes ambiguity, is machine-parseable, and supports complex audio generation.

## Syntax & Intent

### Square brackets [ ... ] = Song Structure Sections

Example: `[Verse 1]`, `[Chorus]`.

### Parentheses ( ... ) = Performance / Stage Directions

Example: `(whisper)`, `(spoken, no music)`.

### Angle brackets \< ... \> = Audio Cue Commands (SFX)

Example: `\<SFX cowbell repeat=6\>`, `\<Guitar solo duration=12s\>`.

### Formatting conventions

- Keep structural labels alone on their line.
- Keep (Performance) inline above or beside the lyrics line it refers to.
- Keep audio cues on their own lines where possible.
- Case-insensitive for markers (parser should normalize case).

## Formal Grammar (EBNF-like)

```ebnf
song          ::= { section_block }
section_block ::= section_label NEWLINE { optional_instruction | lyric_line | audio_cue }
section_label ::= "[" SECTION_NAME [ " " SECTION_META ] "]"
optional_instruction ::= "(" INSTRUCTION_TEXT ")"
audio_cue     ::= "&lt;" CUE_BODY "&gt;"
lyric_line    ::= TEXT
SECTION_NAME  ::= /[A-Za-z0-9_\- ]+/
SECTION_META  ::= /[A-Za-z0-9_, \-]+/
INSTRUCTION_TEXT ::= /[^)]{1,256}/
CUE_BODY      ::= /[^&gt;]{1,512}/
TEXT          ::= /.+/
NEWLINE       ::= "\n"
```

### Notes

- Comments can be allowed with `// comment` or `# comment` at line start if you want.
- Maximum lengths are suggestions — adapt to your app needs.

## Tokenizer / Regex Suggestions

Use a line-oriented tokenizer. For most languages, these regexes will work.

### Identify section label

```regex
/^\s*\[([^\]]+)\]\s*$/i
```

### Identify performance instruction

```regex
/^\s*\(([^)]+)\)\s*$/i
```

### or inline performance (above a lyric line)

```regex
/^\s*\(([^)]+)\)\s*(.+)$/i
```

### Identify audio cue

```regex
/^\s*&lt;([^&gt;]+)&gt;\s*$/i
```

### Identify lyric

```regex
/^\s*([^&lt;\(\[][^].*?)\s*$/i
```

(lyric line: any line not starting with one of the markup delimiters)

### Capture parameters inside a cue (split by whitespace, find key=value or tokens)

Tokenize by spaces — tokens that contain `=` are key/val; others can be positional.

Example cue parse:
Input: `&lt;SFX synth_solo duration=6s repeat=1 pan=right intensity=0.8&gt;`

- `cue.type = sfx` or `synth_solo` (normalize)
- `params.duration = 6s` → convert to ms or seconds as app requires
- `params.repeat = 1` → integer
- `params.pan = right`
- `params.intensity = 0.8` → float

## JSON Schema (output for renderer & AI)

A canonical parsed structure you can pass downstream:

```json
{
  "title": "Optional Track Title",
  "bpm": 120,
  "key": "Cmaj",
  "sections": [
    {
      "id": "verse-1",
      "label": "Verse 1",
      "meta": null,
      "items": [
        { "type": "performance", "text": "soft spoken" },
        { "type": "lyric", "text": "I walk into the night..." },
        {
          "type": "cue",
          "cue_type": "sfx",
          "name": "footsteps",
          "params": { "repeat": 4, "duration": "2s", "pan": "center" }
        }
      ]
    }
  ]
}
```

### Schema guidelines

- `sections[]` ordered to preserve song sequence.
- `items[]` is an ordered array containing performance, lyric, cue objects.
- `cue` objects should include `cue_type` (enum), `name` (string), `params` (map).
- Provide optional top-level metadata: `bpm`, `key`, `time_signature`, `mood`, `genre`.

## SFX / Cue Namespace Recommendation

Define a curated namespace so models / engines share vocabulary. Start with small core and expand.

### Example hierarchy

```tree
SFX
 ├─ percussive
 │   ├─ kick
 │   ├─ snare
 │   ├─ cowbell
 │   └─ tambourine
 ├─ ambient
 │   ├─ wind
 │   ├─ rain
 │   └─ thunder
 ├─ instrument_action
 │   ├─ guitar_solo
 │   ├─ synth_solo
 │   ├─ piano_arpeggio
 │   └─ strings_swell
 ├─ crowd
 │   ├─ cheering
 │   └─ booing
 └─ cinematic
     ├─ orchestral_hit
     ├─ rising_swell
     └─ impact
```

### Suggested canonical names (initial set)

- kick, snare, hi_hat, cowbell
- synth_solo, guitar_solo, bass_slide
- orchestral_swell, strings_section, brass_hit
- wind, rain, thunder, ocean
- crowd_cheer, crowd_applause, footsteps
- sfx_explosion, sfx_door_slam, sfx_heartbeat

### Parameter recommendations

- `duration` (in seconds or ms)
- `repeat` (integer)
- `volume` or `intensity` (0.0–1.0)
- `pan` (left/center/right or -1.0..1.0)
- `pitch` (semitones or Hz)
- `fade_in` / `fade_out` (seconds)
- `layer` or `track` (where to route in DAW)

Make this namespace an enumerated list in the schema so renderers and AI prompts can reference valid names.

## Parser Example (TypeScript — simple, production-ready can be extended)

```typescript
// Simple parser that converts text to JSON structure
type CueParams = { [k: string]: string | number | boolean };
type Item = {
  type: 'performance' | 'lyric' | 'cue';
  text?: string;
  cue_type?: string;
  name?: string;
  params?: CueParams;
};

function parseSong(text: string) {
  const lines = text.split(/\r?\n/);
  const sections: any[] = [];
  let currentSection: any = { id: 'intro', label: 'Intro', items: [] };

  const sectionRE = /^\s*\[([^\]]+)\]\s*$/i;
  const perfRE = /^\s*\(([^)]+)\)\s*$/i;
  const perfInlineRE = /^\s*\(([^)]+)\)\s*(.+)$/i;
  const cueRE = /^\s*&lt;([^&gt;]+)&gt;\s*$/i;

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = line.match(sectionRE))) {
      // start new section
      if (currentSection.items.length) sections.push(currentSection);
      const label = m[1].trim();
      currentSection = {
        id: label.toLowerCase().replace(/\s+/g, '-'),
        label,
        items: [],
      };
      continue;
    }
    if ((m = line.match(perfInlineRE))) {
      currentSection.items.push({ type: 'performance', text: m[1].trim() });
      currentSection.items.push({ type: 'lyric', text: m[2].trim() });
      continue;
    }
    if ((m = line.match(perfRE))) {
      currentSection.items.push({ type: 'performance', text: m[1].trim() });
      continue;
    }
    if ((m = line.match(cueRE))) {
      const cueBody = m[1].trim();
      // split tokens
      const tokens = cueBody.split(/\s+/);
      // heuristics: if first token is SFX or instrument name
      let cue_type = tokens[0].toLowerCase();
      const params: CueParams = {};
      // parse key=val tokens
      for (let i = 1; i < tokens.length; i++) {
        const t = tokens[i];
        const kv = t.split('=');
        if (kv.length === 2) {
          const k = kv[0].toLowerCase();
          let v: string | number = kv[1];
          if (/^\d+(\.\d+)?s$/.test(v)) {
            v = parseFloat(v.replace('s', ''));
          } else if (/^\d+$/.test(v)) {
            v = parseInt(v);
          } else if (/^\d+\.\d+$/.test(v)) {
            v = parseFloat(v);
          }
          params[k] = v;
        } else {
          // positional tokens like "cowbell" "repeat=6"
          // add to name if not a keyval
          params[`token${i}`] = t;
        }
      }
      // derive name
      const name = tokens[0];
      currentSection.items.push({
        type: 'cue',
        cue_type: cue_type,
        name,
        params,
      });
      continue;
    }
    // fallback: lyric
    currentSection.items.push({ type: 'lyric', text: line });
  }
  if (currentSection.items.length) sections.push(currentSection);
  return { sections };
}
```

### Notes

- This is deliberately simple for clarity and extensibility.
- Improve parsing for quoted params, escaping, nested cues, and inline mixing as needed.
- Add rigorous unit tests for edge cases (multi-line cues, malformed inputs).

## Validation Rules

To ensure robust outputs, validate parsed structure:

- **Section existence**: Disallow empty song (must have at least one section).
- **Cue validation**:
  - `cue.name` must exist.
  - `params.duration` if present must be numeric.
  - `repeat` must be integer >= 1.
  - `intensity` must be between 0 and 1.
  - `pan` must be left, right, center or numeric between -1 and 1.
- **Performance instruction length**: limit to 256 chars default.
- **No overlapping cues**: if a cue is declared with `start_time` and `duration`, check that same track/layer doesn't exceed concurrency constraints unless layering allowed.
- **Tempo / Key checks** (if declared): valid numeric bpm, valid key tokens (C, Gm, D#min).
- **Reserved word checks**: warn if unknown SFX name (not in namespace); either auto-fallback or reject.
- **Security**: sanitize all text (avoid command injection if cues can call external scripts).
- **Return detailed errors** with line numbers so authors can fix DSL quickly.

## Integration Patterns (where this fits in a pipeline)

### 9.1 Text → AI Model → Music Engine

Feed the parsed JSON to an AI model that maps cues to instrument definitions and synthesizer parameters.

Example flow:

1. Parse DSL → JSON.
2. Tokenize and canonicalize `cue.name` → pick sample or synth preset.
3. Use performance metadata to set singing voice style or TTS voice parameters.
4. Render audio stems per section concurrently.
5. Mix stems according to `cue.params` (pan/volume).

### 9.2 DAW Integration (Ableton / Logic / Reaper)

Export a session file or MIDI + automation:

- Map cue → MIDI program changes, sample triggers, or audio clips on specific tracks.
- Map performance → vocal track automation (reverb, EQ presets).
- Use section markers to create arrangement markers in DAW timeline.

### 9.3 Real-time Generative Engine (Live performance)

Use cues as events in an event queue: triggers call synth module/sample player with params (duration, pan, intensity).

Time resolution: seconds or beats. Support `start` param in seconds or beats (beat/time mapping via BPM).

### 9.4 TTS / Vocal Synthesis

- `performance` maps to TTS voice prosody settings (pitch shift, breathiness, speed).
- Use `(whisper)` → reduce amplitude, add noise, shift formants.
- `(spoken)` → set pitch contours to monotone or speech-like patterns.

### 9.5 Hybrid Pipeline Example (AI-assist)

User writes DSL with placeholders: `\<SFX synth_solo duration=6s intensity=0.8\>`.

AI suggests sample banks or generates synth patch code to satisfy `synth_solo`.

Renderer picks either pre-recorded audio or uses a neural synth to make the sound.

## Templates (ready-to-use structures)

### Pop (standard)

```dsl
[Intro]
(soft synth pad)
\<SFX pad_swell duration=4s\>

[Verse 1]
(breathy)
Lyrics...
(lead vocal)
Lyrics...

[Pre-Chorus]
(build)
\<SFX drum_fill repeat=2\>

[Chorus]
(full)
Lyrics...
\<SFX orchestral_swell duration=3s\>
\<SFX crowd_cheer intensity=0.6\>
```

### EDM (club)

```dsl
[Intro]
(ambient build)
\<SFX white_noise duration=8s\>

[Build]
(build-up)
\<SFX riser duration=8s intensity=1\>

[Drop]
(full energy)
\<SFX kick repeat=32\>
\<SFX bass_drop duration=5s\>
\<DropEffect stutter=4\>
```

### Cinematic / Score

```dsl
[Scene 1]
(narration, whisper)
Lyrics or narration...
\<SFX footsteps repeat=3 pan=left\>
\<SFX wind duration=10s intensity=0.3\>

[Climax]
(strings swell)
\<SFX strings_swell duration=6s intensity=1\>
\<SFX impact volume=0.9\>
```

### Spoken Word / Radio Play

```dsl
[Intro]
(spoken, a cappella)
Speaker line...
\<SFX radio_static duration=2s\>

[Scene]
(spoken, echo)
Dialogue...
\<SFX door_slam\>
```

## Prompting Patterns for AI (how to ask an LLM)

When you pass the DSL to an LLM to expand or fill parts, use explicit instructions anchored to the DSL:

**Example:**

System: You are a music generation assistant. Parse the DSL below and replace any `&lt;SFX ...&gt;` placeholders with recommended sample filenames or synth patch parameters. Output JSON with fields: sections[], cues[], suggestedAssets[].

User:

```dsl
[Verse 1]
(whisper)
I walk alone...
\<SFX footsteps repeat=4\>
```

Task: For each cue, suggest asset: either a sample id or synth preset. If unknown, return "generate_synth_patch" with suggested oscillator types, filter settings, and envelope.

Use examples in the prompt to teach mapping of DSL cue names → sample assets.

## Extending the DSL (advanced capabilities)

- **Time-based control**: allow `start=` and `beat=` attributes, e.g. `\<SFX pad start=1.5s duration=4s\>` or `\<SFX kick start=1.2 beat=3.1\>` mapped to BPM.
- **Conditional cues**: `\<SFX crowd if=chorus\>` for adaptive generation.
- **Macros / Snippets**: allow `[CHORUS_01]` referencing external snippet files.
- **Parameter interpolation**: `&lt;SFX synth_solo duration=6s intensity=0-&gt;1&gt;` for fades/rises.
- **Track routing**: `&lt;SFX synth track=lead reverb=hall&gt;` to help DAW mapping.
- **Presets & Profiles**: store voice profiles: `@voice { name: 'lead-male', gender: male, style: 'raspy' }`.

## Edge Cases & Best Practices

- **Ambiguous tokens**: prefer key=value over free text; allow fallback synonyms (e.g., pan=R → pan=right).
- **Human readability**: keep cues readable for non-technical collaborators — use short, meaningful names.
- **Escaping**: support escaping if lyrics include `[` or `\<` characters — e.g., `\[literal` or `\<literal`.
- **Versioning**: include DSL version: `1.0` in header to support parser changes.
- **Testing**: create unit tests with malformed input, nested cues, and inline cues.

## Example Full File (combined)

```dsl
Title: Nightfall
BPM: 92
Key: Em

[Intro]
(soft synth pad)
\<SFX pad_swell duration=4s intensity=0.5\>

[Verse 1]
(whisper, spoken)
We walk the alleys of quiet cities,
(lead vocal)
We whisper names the night forgets.
\<SFX footsteps repeat=6 pan=left\>
\<SFX rain duration=8s intensity=0.3\>

[Pre-Chorus]
(build)
(lead vocal, breathy)
Hold on to the last light...
\<SFX riser duration=5s\>

[Chorus]
(full voice, strings enter)
We are fire — we are the unsung.
\<SFX strings_swell duration=4s\>
\<SFX drum_fill repeat=2\>

[Outro]
(soft fade)
(whisper)
Goodnight...
\<SFX wind fade_out=3s\>
```

Parsed JSON of this is passed to your renderer, which maps `strings_swell` → orchestral patch, `footsteps` → sample set, and `(whisper)` → TTS voice config.

## Roadmap & Next Steps (implementation plan)

1. **Create canonical namespace**: Make JSON file enumerating SFX names + suggested assets.
2. **Implement parser**: Use the TS parser above as basis — add robust param parsing, escaping, and tests.
3. **Define renderer contracts**: Decide how cues map to synths, samples, MIDI, or external VSTs.
4. **Build prompt templates**: For your AI models to expand cues into actual sound assets or synth parameters.
5. **Integrate with DAW**: Export to MIDI + automation or spawn audio stems programmatically.
6. **Add validation & CI checks**: Lint DSL files in repo, fail builds if invalid cues detected.
7. **Create authoring UI**: A simple editor that highlights `[Section]`, `(Performance)`, `&lt;Cue&gt;` and can preview mapped samples.

## Quick Reference (cheat sheet)

### Markers

- `[Section]` — structure
- `(Instruction)` — performance / delivery
- `\<Cue ...\>` — SFX / instrument / action

### Cue param names

- `duration`, `repeat`, `volume`/`intensity`, `pan`, `start`, `pitch`, `fade_in`, `fade_out`, `track`

### Example cue

`\<SFX synth_solo duration=6s repeat=1 pan=right intensity=0.8\>`
