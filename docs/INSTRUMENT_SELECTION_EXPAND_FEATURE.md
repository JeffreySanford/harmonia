# Instrument Selection & "Expand" Feature — Complete Design & Implementation Guide

## Executive Summary

The Instrument Selection & "Expand" Feature provides flexible controls for AI-driven song generation, allowing creators to either:

- **Auto-select** instrument palettes (smart AI defaults for fast iteration)
- **Expand & Pick** exact instruments, synths, or sample banks (deep manual control)
- **Hybrid** approach combining AI suggestions with user customization

This enables both rapid prototyping and professional production workflows.

## Goal

Provide flexible controls so an AI-driven song generator can either auto-select an instrument palette (smart default) or let the user expand and pick exact instruments, synths, or sample banks per song or per section. This lets creators iterate quickly (AI picks sensible defaults) while still enabling deep manual control for producers.

## 1. High-level User Flows

### Flow A — AI Auto-Select (Fast Iteration)

1. User chooses genre/style (e.g., pop, cinematic, lo-fi)
2. AI picks an instrument palette and articulations optimized for that genre
   - Example: pop → electric guitar, acoustic piano, 808 kick, modern synth pad
3. System returns preview audio or suggested instrument list for acceptance
4. User can accept, regenerate, or expand for manual tuning

### Flow B — Expand & Pick (Manual Tuning)

1. User clicks "Expand Instruments" button
2. UI shows grouped instrument categories with suggested defaults and alternatives
   - Example: Guitar → [Acoustic, Electric Clean, Distorted]
3. User toggles instruments on/off, sets priority, or selects presets
   - Example: "bright acoustic", "warm analog pad"
4. User can set per-section overrides
   - Example: Verse → clean guitar; Chorus → distorted lead

### Flow C — Hybrid (AI-Assisted)

1. AI proposes a palette based on genre and song structure
2. User edits it in the expand UI
3. AI updates instrument parameters to match edits and re-synthesizes preview

## 2. Core Concepts & Terminology

### Instrument Palette

A set of instruments chosen to produce the song (e.g., {drums, bass, piano, synth pad, lead guitar}).

### Instrument Instance

A specific instrument in the palette with parameters (preset, articulations, volume, pan).

### Preset

Named synth patch / sample bank + recommended effects (e.g., `pad_warm_analog`).

### Articulation

Playing technique — staccato, legato, slap, tremolo.

### Routing / Track

Target DAW track or stem for each instrument.

### Priority

Relative importance for AI when arranging polyphony or competing parts (High/Med/Low).

### Per-Section Override

Instrument settings applied only to a specific section.

### Fallback

Replacement instrument(s) when requested asset is unavailable.

## 3. UX: Expand Instruments Panel (Wireframe)

### Top Bar

- Genre dropdown
- BPM/Key display
- "Auto-select" toggle
- "AI Suggest Alternatives" button

### Palette Preview

Small chips for selected instruments (click to expand details).

### Instrument Groups (Vertical List)

```text
Rhythm (Drums, Percussion)
Low-end (Bass: electric, synth)
Harmony (Piano, Guitar, Pads)
Leads (Synth lead, Guitar lead)
Orchestral (Strings, Brass)
FX & SFX (Ambience, Foley, Risers)
```

### Each Instrument Row Shows

- [ ] Checkbox (on/off)
- Preset selector (dropdown)
- Intensity slider (0–100)
- Pan +/- and volume controls
- Articulation button (opens menu)
- Priority badge (Low/Med/High)
- Preview play button (short sample)

### Section Overrides

- "Apply this palette globally" toggle
- Per-section timeline view
- Clicking section opens local palette editor

### Bottom Actions

- "Accept & Generate" (use current palette)
- "AI Suggest Alternatives" (re-run AI with randomization)
- "Export Palette" (JSON)
- "Save as Preset"

## 4. DSL / IR Extensions

### Top-Level Header (Author or AI Suggestions)

```dsl
@Instruments [
  {"name":"drums","preset":"acoustic-kit","category":"drum","priority":"high"},
  {"name":"bass","preset":"electric-slap","category":"bass","priority":"high"},
  {"name":"pad","preset":"warm-analog","category":"pad","intensity":0.6}
]
```

### Compact Single-Line Format

```dsl
@Instruments drums=acoustic-kit,bass=electric-slap,pad=warm-analog
```

### Per-Section Override

```dsl
[Chorus]
@Instruments guitar=distorted-lead,pad=bright-synth
(full voice)
We are alive...
```

### Inline Cue for Instrument Actions

```dsl
<GFX synth_lead play duration=8beats preset=bright_lead articulation=legato intensity=0.8>
```

### JSON IR Additions

```json
{
  "sections":[
    {
      "id":"chorus",
      "label":"Chorus",
      "instruments":[
        {"name":"guitar","preset":"distorted-lead","params":{"intensity":0.9,"pan":0}},
        {"name":"pad","preset":"bright-synth","params":{"intensity":0.6}}
      ],
      "items":[ ... ]
    }
  ],
  "global_instruments":[
    {"name":"drums","preset":"e-kit-modern","params": {"priority":"high"}}
  ]
}
```

## 5. Parser Changes

### Recognition Rules

- `@Instruments` header (JSON or key=value format)
- Per-section `@Instruments` entries
- Normalize presets & categories to canonical names via vocabulary map

### Validation Rules

- Instrument names present in SFX/Instrument namespace
- Preset exists or fallback flagged
- Parameter ranges: intensity 0–1, volume -60..0 dB, pan -1..1

### Parsing Steps

1. Header line `@Instruments` → parse JSON or tokens → normalize → append to IR `global_instruments`
2. Section line `@Instruments` → parse → add to `section.instruments`
3. Cue lines: allow `preset=` and `instrument=` params

## 6. Instrument Namespace & Presets

### Canonical Instrument Catalog (JSON)

```json
{
  "guitar": {
    "id": "guitar",
    "category": "harmony",
    "default_presets": ["acoustic_clean", "electric_clean", "distorted"],
    "sample_map": { "acoustic_clean": "samples/guitar/acoustic_clean_01.wav" },
    "midi_programs": [24, 25]
  },
  "synth_pad": {
    "id": "synth_pad",
    "category": "pad",
    "default_presets": ["warm_analog", "bright_digital"],
    "synth_def": "serum:patch_warmanalog"
  }
}
```

### Preset Structure Includes

- Sample path(s) or synth patch reference
- Default FX chain (reverb, chorus)
- Recommended articulations
- Suggested velocity ranges & MIDI mappings

## 7. AI Prompting & Decision Logic

### When AI Auto-Selects

**Inputs:**

- Genre, BPM, Key, Time signature
- Mood/instrumentation hints (e.g., "intimate acoustic")
- Song structure (sections length in beats)

**Constraints:**

- Max simultaneous instruments (polyphony budget)
- Priority rules (lead > harmony > FX)
- Asset availability

**Output:**
Ordered instrument palette with presets, articulations, per-section notes.

### Example LLM Prompt

```text
System: You are a music production assistant. Given the song metadata (genre, bpm, sections) choose a 4-7 instrument palette appropriate for the genre. For each instrument, return: name, category, preset, priority (high/med/low), intensity (0-1), and suggested articulations. Favor instrument assets available in the provided catalog. Return JSON only.
```

### AI Considerations

- Probabilistic sampling for creative variation
- Multiple palette options (A/B/C) for user choice
- Transparency with rationale for choices

## 8. Renderer Mapping & DAW Integration

### Mapping Rules

Each instrument instance maps to:

- DAW track name
- MIDI channel or sample player
- Default effect chain
- Stem export options

### Per-Section Overrides

- Automate track mute/unmute
- Swap presets via automation
- Respect local palette settings

### Polyphony & Voice Allocation

- CPU-limited targets: reduce polyphony or swap complex textures
- Lightweight versions: sample-backed alternatives

### Output Formats

- **Stems**: One audio stem per instrument instance
- **MIDI**: Performance with instrument patch/program selected
- **NLE Markers**: Visual cues with instrument events

## 9. Validation & Fallbacks

### Validation Checks

- Instrument names/presets against catalog
- Polyphony/CPU limits
- Parameter ranges (intensity 0–1, volume -60..0 dB, pan -1..1)

### Fallback Policy

- Missing asset → Use category fallback preset
- Flag warning in IR and UI
- Propose alternatives (sample-backed versions)

## 10. Presets, Genres & Saved Palettes

### Genre Presets

- Pop, rock, lo-fi, cinematic, EDM
- Pre-configured instrument palettes

### Saved Palettes

- User-created custom palettes
- Team/company-approved sounds
- Shareable palette templates

### Variation Controls

- "Make brighter/darker"
- "Analogize"
- "Acousticify"

## 11. Examples

### Example 1 — AI-Suggested Palette (Compact)

```dsl
@Instruments drums=e-kit-modern,bass=elec_finger,piano=acoustic_bright,pad=warm_analog,lead=synth_bright
```

### Example 2 — Per-Section Override

```dsl
[Verse 1]
@Instruments pad=ambient_textures,guitar=acoustic_clean
(soft)
I walk the alley...

[Chorus]
@Instruments lead=distorted_guitar,pad=wide_analog
(full)
We raise our hands...
```

### Example JSON IR Snippet

```json
{
  "global_instruments": [
    {
      "name": "drums",
      "preset": "e-kit-modern",
      "params": { "priority": "high" }
    },
    {
      "name": "bass",
      "preset": "elec_finger",
      "params": { "priority": "high" }
    }
  ],
  "sections": [
    {
      "id": "verse-1",
      "instruments": [
        {
          "name": "guitar",
          "preset": "acoustic_clean",
          "params": { "intensity": 0.4 }
        }
      ]
    },
    {
      "id": "chorus",
      "instruments": [
        {
          "name": "lead",
          "preset": "distorted_guitar",
          "params": { "intensity": 0.9 }
        }
      ]
    }
  ]
}
```

## 12. Analytics & Telemetry

### Tracking Metrics

- AI-suggested palettes: acceptance vs. modification rates
- Preset error rates (missing assets) for catalog improvement
- Render time vs. instrument complexity for CPU budget tuning

## 13. Implementation Roadmap

### Phase 1: Foundation

1. Create Instrument Catalog JSON (canonical names, categories, presets)
2. Extend Parser & IR (@Instruments header & per-section parsing)
3. Update JSON schema for instruments[]

### Phase 2: Core UX

1. Build Expand UI (grouped controls, preview, per-section overrides)
2. Implement AI picker (LLM prompt + catalog constraints)
3. Add save/export functionality

### Phase 3: Integration

1. Map to renderer (presets → synth patches/samples)
2. Implement fallback policy
3. Render & Export (stems, MIDI, DAW/NLE markers)

### Phase 4: Polish

1. Testing & Validation (missing assets, polyphony limits)
2. Analytics integration
3. Documentation & user education

## 14. Edge Cases & Considerations

### Licensing

- Track sample/preset licenses in catalog
- Warn users about non-free assets

### Localization

- Instrument names/presets might be localized
- Use canonical IDs internally

### Live Mode

- Reduced-latency synths for live performance
- Packetized commands (OSC)

### User Education

- Tooltips for articulation/preset effects
- Help users understand AI choices

## 15. Technical Architecture

### Data Flow

```text
User Input → AI Palette Selection → Expand UI → Parser → IR → Renderer → Audio Output
     ↓              ↓                      ↓         ↓       ↓         ↓
   Genre        LLM Prompt            Manual     @Instruments  JSON     Stems
   BPM          Constraints           Tuning     Validation   Schema   MIDI
   Key          Catalog               Preview    Fallbacks   Export   NLE
```

### API Endpoints

- `POST /api/songs/suggest-instruments` - AI palette suggestions
- `POST /api/songs/validate-instruments` - Palette validation
- `GET /api/instruments/catalog` - Instrument catalog
- `POST /api/instruments/presets` - Save/load presets

### Database Schema

- `instrument_catalog` - Canonical instrument definitions
- `user_palettes` - Saved user palettes
- `song_instruments` - Per-song instrument assignments

This feature bridges the gap between AI automation and professional music production, enabling both rapid iteration and precise control over the creative process.
