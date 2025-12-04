# M-MSL — Micro Music Score Language: Full Spec, BNF Grammar, JSON IR, Parser Designs, and Music↔Video Sync Pipeline

## Overview

M-MSL (Micro Music Score Language) is a human-readable, machine-parseable DSL for encoding lyrics, performance directions, audio cues (SFX/instrument actions), and beat-level timing. It enables coordinated audio generation, DAW export, and video storyboarding from a single source.

## 1. Spec Document (M-MSL)

### Purpose

M-MSL encodes lyrics, performance directions, audio cues, and beat-level timing in a human-friendly, machine-parseable way so that audio generation, DAW export, and video storyboarding can be coordinated deterministically.

### Goals

- Human-readable and writable
- Deterministic parsing and canonical JSON output
- Beat-first timing model (tempo-based)
- Extensible SFX namespace and parameters
- Support for DAW export, realtime engines, and offline renderers

### Syntax Summary

- `[Section Label]` — section marker (alone on a line). Example: `[Verse 1]`
- `(Instruction text)` — performance/stage direction. Can appear alone or inline before lyric text. Example: `(whisper)`
- `<Cue ...>` — audio cue command. Example: `<SFX footsteps repeat=4 duration=4beats pan=left>`
- `@MetaKey value` — top-level metadata (BPM, BeatsPerBar, Key, Title). Example: `@BPM 120`

Lines not matching markup are lyrics.

### Key Types & Semantics

- **Section**: ordered container for items.
- **Item**: one of performance, lyric, cue.
- **Cue**: structured token with name and params. Common params: duration, repeat, volume/intensity, pan, start, start_beat.

### Beat Notation

Accept s (seconds), beats (or b), bars optionally. Example: `4beats`, `2s`, `1bar`.

### Conventions & Best Practices

- Place `[Section]` on its own line.
- Place `(Instruction)` on its own line or inline immediately above the lyric it modifies.
- Place `<Cue ...>` on its own line where it occurs (or with start= param for off-line scheduling).
- Use key=value parameters inside `< >`. Values may be unquoted or quoted for spaces.
- Use `@BPM`, `@BeatsPerBar`, `@TimeSignature`, `@Title`, `@Key` as top-level lines at the top of the file.

### Versioning

Add `@MMSL_Version 1.0` header for future grammar changes.

## 2. BNF Grammar (Backus–Naur Form)

```bnf
<song>           ::= <header>* <section>+
<header>         ::= "@" <ident> <ws> <header_value> <newline>
<header_value>   ::= <number> | <ident> | <string>
<section>        ::= "[" <section_name> "]" <newline> <section_body>
<section_body>   ::= { <line> }
<line>           ::= <blank> | <performance_line> | <cue_line> | <lyric_line>
<performance_line> ::= "(" <performance_text> ")" <newline>
<cue_line>       ::= "<" <cue_body> ">" <newline>
<lyric_line>     ::= <text> <newline>
<cue_body>       ::= <cue_tokens>
<cue_tokens>     ::= <cue_token> { <ws> <cue_token> }
<cue_token>      ::= <ident> | <keyvalue>
<keyvalue>       ::= <ident> "=" <value>
<value>          ::= <number> | <ident> | <quoted_string>
<section_name>   ::= <string_no_bracket>
<performance_text>::= <string_no_paren>
<ident>          ::= /[A-Za-z0-9_\-:]+/
<number>         ::= /[0-9]+(\.[0-9]+)?(s|ms|beats|b|bar|bars)?/
<quoted_string>  ::= '"' [^"]* '"'
<string_no_bracket>::= /[^\]]+/
<string_no_paren> ::= /[^\)]+/
<text>           ::= /.+/
<ws>             ::= /[ \t]+/
<newline>        ::= "\n"
<blank>          ::= "\n"
```

### Notes

- `beats`, `b`, and `bar(s)` are interpreted during parse into an absolute beat count or duration.
- Strings inside keys should allow quotes for spaces.

## 3. JSON Intermediate Representation (IR) — Canonical Schema

A compact JSON schema for downstream tools:

```json
{
  "mmsl_version": "1.0",
  "title": "Nightfall",
  "bpm": 120,
  "beatsPerBar": 4,
  "timeSignature": "4/4",
  "key": "Em",
  "sections": [
    {
      "id": "verse-1",
      "label": "Verse 1",
      "items": [
        { "type": "performance", "text": "soft spoken" },
        { "type": "lyric", "text": "We walk the alleys of quiet cities," },
        {
          "type": "cue",
          "name": "footsteps",
          "category": "sfx",
          "params": {
            "repeat": 4,
            "duration_beats": 4,
            "pan": "left",
            "volume": 0.6
          }
        }
      ]
    }
  ]
}
```

### IR Field Notes

- `bpm`: integer (>0). If absent, default to 120.
- `duration_beats`: convert duration strings (4beats, 2s) to beats using BPM. Store beats as primary time unit.
- `params.start_beat`: optional, absolute start beat relative to section or song depending on flags.
- `cue.category`: recommended categories: sfx, instrument, drum, fx.
- `items` preserve original author order.

### JSON Schema (Essential Fragment)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "mmsl_version": { "type": "string" },
    "title": { "type": "string" },
    "bpm": { "type": "integer", "minimum": 1 },
    "beatsPerBar": { "type": "integer", "minimum": 1 },
    "sections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "label": { "type": "string" },
          "items": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["performance", "lyric", "cue"]
                },
                "text": { "type": "string" },
                "name": { "type": "string" },
                "category": { "type": "string" },
                "params": { "type": "object" }
              },
              "required": ["type"]
            }
          }
        },
        "required": ["id", "label", "items"]
      }
    }
  },
  "required": ["mmsl_version", "sections"]
}
```

## 4. Parsing Algorithm Design

### Goals

- Robust line-oriented parser
- Generate canonical IR with durations normalized to beats
- Provide precise diagnostics (line numbers)
- Minimal memory footprint, streamable

### High-Level Steps

1. **Pre-scan headers**: read top-of-file `@` directives (`@BPM`, `@BeatsPerBar`, etc.). Default BPM=120 if none.
2. **Tokenize by line**: read file line-by-line to preserve ordering and line numbers.
3. **State machine**:
   - `state = OUTSIDE_SECTION` initially
   - on section label → create `currentSection`, `state = IN_SECTION`
   - inside section → for each non-empty line:
     - If matches performance `( ... )` → emit performance item
     - Else if matches cue `< ... >` → parse cue body into name + params, convert durations to beats, emit cue item
     - Else if line is lyric → emit lyric item
     - Else ignore blank or comment lines
4. **Cue param parsing**:
   - Tokenize cue body by whitespace, support quoted values
   - First token is canonical `cue.name` unless first token is SFX then second token is name
   - For key=value tokens, parse value types: integer, float, duration (s/ms/beats/bars), boolean, string
   - Convert duration strings into beats using `toBeats(value, bpm, beatsPerBar)`
   - Validate param ranges (volume 0..1, pan -1..1 or 'left'/'center'/'right', repeat >=1)
5. **Post-process**:
   - Compute absolute `start_beat` for any cues using `params.start` if relative
   - Resolve section-level beats if desired by computing section start beat offsets (optional)
   - Return IR and warnings.

### Duration Parsing Utilities

- `toBeats("4beats", bpm)` → 4
- `toBeats("2s", bpm)` → (2 / 60) \* bpm
- `toBeats("1bar", bpm, beatsPerBar)` → beatsPerBar

### Complexity

- **Time**: O(n) where n = number of lines (plus small tokenization cost per cue)
- **Memory**: O(m) where m = number of items emitted; streaming mode possible.

### Diagnostics

Collect parse warnings/errors with line numbers and severity. Suggest fixes for common mistakes (e.g., duration=4s when BPM missing).

## 5. Example Parsers

All three parsers implement the same simple rule set:

- parse headers
- parse sections
- parse `(performance)` lines
- parse `<cue ...>` lines (tokenize params)
- produce canonical JSON with durations normalized to `duration_beats` where possible

### 5.1 TypeScript Parser

```typescript
// File: mmsl-parser.ts
// Usage: node mmsl-parser.js <inputfile>

import * as fs from 'fs';

type Item = {
  type: 'performance' | 'lyric' | 'cue';
  text?: string;
  name?: string;
  category?: string;
  params?: any;
};
type Section = { id: string; label: string; items: Item[] };
type IR = {
  mmsl_version: string;
  title?: string;
  bpm: number;
  beatsPerBar: number;
  sections: Section[];
};

function toBeats(val: string, bpm: number, beatsPerBar: number): number {
  if (typeof val === 'number') return val;
  val = val.trim();
  const m = val.match(/^([\d.]+)(ms|s|beats|b|bar|bars)?$/i);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'ms') return ((n / 1000) * bpm) / 60;
  if (unit === 's' || unit === '') return (n * bpm) / 60;
  if (unit === 'beats' || unit === 'b') return n;
  if (unit === 'bar' || unit === 'bars') return n * beatsPerBar;
  return NaN;
}

function parseCueBody(body: string, bpm: number, beatsPerBar: number) {
  // naive tokenizer: handle quoted strings
  const tokens: string[] = [];
  let cur = '',
    inQuote = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && /\s/.test(ch)) {
      if (cur) {
        tokens.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  if (tokens.length === 0) return null;
  let name = tokens[0];
  const params: any = {};
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    const kv = t.split('=');
    if (kv.length === 2) {
      const k = kv[0].toLowerCase();
      let v: any = kv[1];
      if (/^\d+(\.\d+)?(s|ms|beats|b|bar|bars)?$/i.test(v)) {
        v = toBeats(v, bpm, beatsPerBar);
        // preserve original unit? we store beats
        params[k] = v;
      } else if (/^\d+$/.test(v)) {
        params[k] = parseInt(v, 10);
      } else if (/^(true|false)$/i.test(v)) {
        params[k] = v.toLowerCase() === 'true';
      } else if (/^\d+\.\d+$/.test(v)) {
        params[k] = parseFloat(v);
      } else {
        params[k] = v;
      }
    } else {
      // positional token: maybe "SFX" or category
      // if it's SFX, skip
      if (t.toLowerCase() === 'sfx') {
        continue;
      }
      if (!params['_pos']) params['_pos'] = [];
      params['_pos'].push(t);
    }
  }
  return { name, params, category: 'sfx' };
}

function parseMMSL(text: string): IR {
  const lines = text.split(/\r?\n/);
  const bpmDefault = 120;
  let bpm = bpmDefault;
  let beatsPerBar = 4;
  let title: string | undefined;
  const sections: Section[] = [];
  let curSection: Section | null = null;
  const sectionRe = /^\s*\[([^\]]+)\]\s*$/;
  const perfRe = /^\s*\(([^)]+)\)\s*$/;
  const perfInlineRe = /^\s*\(([^)]+)\)\s*(.+)$/;
  const cueRe = /^\s*<([^>]+)>\s*$/;
  const headerRe = /^\s*@([A-Za-z0-9_]+)\s+(.+)$/;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(headerRe);
    if (h) {
      const key = h[1].toLowerCase();
      const val = h[2].trim();
      if (key === 'bpm') bpm = parseInt(val) || bpm;
      else if (key === 'beatsperbar')
        beatsPerBar = parseInt(val) || beatsPerBar;
      else if (key === 'title') title = val;
      continue;
    }
    const s = line.match(sectionRe);
    if (s) {
      if (curSection) sections.push(curSection);
      const label = s[1].trim();
      curSection = {
        id: label.toLowerCase().replace(/\s+/g, '-'),
        label,
        items: [],
      };
      continue;
    }
    if (!curSection) {
      // skip lines outside any section (or optionally create a default section)
      continue;
    }
    let m;
    if ((m = line.match(perfInlineRe))) {
      curSection.items.push({ type: 'performance', text: m[1].trim() } as Item);
      curSection.items.push({ type: 'lyric', text: m[2].trim() } as Item);
      continue;
    }
    if ((m = line.match(perfRe))) {
      curSection.items.push({ type: 'performance', text: m[1].trim() } as Item);
      continue;
    }
    if ((m = line.match(cueRe))) {
      const cue = parseCueBody(m[1].trim(), bpm, beatsPerBar);
      if (cue)
        curSection.items.push({
          type: 'cue',
          name: cue.name,
          category: cue.category,
          params: cue.params,
        } as Item);
      continue;
    }
    // else lyric
    curSection.items.push({ type: 'lyric', text: line } as Item);
  }
  if (curSection) sections.push(curSection);
  return { mmsl_version: '1.0', title, bpm, beatsPerBar, sections };
}

// CLI runner
if (require.main === module) {
  const argv = process.argv;
  const f = argv[2];
  if (!f) {
    console.error('Usage: node mmsl-parser.js file.mmsl');
    process.exit(2);
  }
  const txt = fs.readFileSync(f, 'utf8');
  const ir = parseMMSL(txt);
  console.log(JSON.stringify(ir, null, 2));
}

export { parseMMSL };
```

### 5.2 Go Parser

```go
// File: mmsl_parser.go
// go run mmsl_parser.go input.mmsl

package main

import (
  "bufio"
  "encoding/json"
  "fmt"
  "os"
  "regexp"
  "strconv"
  "strings"
)

type Item struct {
  Type     string                 `json:"type"`
  Text     string                 `json:"text,omitempty"`
  Name     string                 `json:"name,omitempty"`
  Category string                 `json:"category,omitempty"`
  Params   map[string]interface{} `json:"params,omitempty"`
}

type Section struct {
  Id    string `json:"id"`
  Label string `json:"label"`
  Items []Item `json:"items"`
}

type IR struct {
  MMSLVersion string    `json:"mmsl_version"`
  Title       string    `json:"title,omitempty"`
  BPM         int       `json:"bpm"`
  BeatsPerBar int       `json:"beatsPerBar"`
  Sections    []Section `json:"sections"`
}

func toBeats(val string, bpm int, beatsPerBar int) float64 {
  val = strings.TrimSpace(val)
  re := regexp.MustCompile(`(?i)^([\d.]+)(ms|s|beats|b|bar|bars)?$`)
  m := re.FindStringSubmatch(val)
  if m == nil {
    f, _ := strconv.ParseFloat(val, 64)
    return f
  }
  n, _ := strconv.ParseFloat(m[1], 64)
  unit := strings.ToLower(m[2])
  switch unit {
  case "ms":
    return (n/1000.0) * float64(bpm) / 60.0
  case "s", "":
    return (n) * float64(bpm) / 60.0
  case "beats", "b":
    return n
  case "bar", "bars":
    return n * float64(beatsPerBar)
  }
  return n
}

func parseCue(body string, bpm int, beatsPerBar int) (string, map[string]interface{}) {
  // crude split by space, ignoring quotes for brevity
  parts := strings.Fields(body)
  params := make(map[string]interface{})
  var name string
  if len(parts) > 0 {
    name = parts[0]
  }
  for _, p := range parts[1:] {
    if strings.Contains(p, "=") {
      kv := strings.SplitN(p, "=", 2)
      k := strings.ToLower(kv[0])
      v := kv[1]
      // detect numeric durations
      if matched, _ := regexp.MatchString(`(?i)^[\d.]+(ms|s|beats|b|bar|bars)?$`, v); matched {
        params[k] = toBeats(v, bpm, beatsPerBar)
      } else if i, err := strconv.Atoi(v); err == nil {
        params[k] = i
      } else if f, err := strconv.ParseFloat(v, 64); err == nil {
        params[k] = f
      } else if v == "true" || v == "false" {
        params[k], _ = strconv.ParseBool(v)
      } else {
        params[k] = v
      }
    } else {
      // positional
      if _, ok := params["_pos"]; !ok {
        params["_pos"] = []string{}
      }
      params["_pos"] = append(params["_pos"].([]string), p)
    }
  }
  return name, params
}

func main() {
  if len(os.Args) < 2 {
    fmt.Println("Usage: go run mmsl_parser.go file.mmsl")
    os.Exit(2)
  }
  f, _ := os.Open(os.Args[1])
  defer f.Close()
  scanner := bufio.NewScanner(f)
  bpm := 120
  beatsPerBar := 4
  var title string
  var sections []Section
  var cur *Section
  sectionRe := regexp.MustCompile(`^\s*\[([^\]]+)\]\s*$`)
  perfRe := regexp.MustCompile(`^\s*\(([^)]+)\)\s*$`)
  perfInlineRe := regexp.MustCompile(`^\s*\(([^)]+)\)\s*(.+)$`)
  cueRe := regexp.MustCompile(`^\s*<([^>]+)>\s*$`)
  headerRe := regexp.MustCompile(`^\s*@([A-Za-z0-9_]+)\s+(.+)$`)

  for scanner.Scan() {
    line := strings.TrimSpace(scanner.Text())
    if line == "" { continue }
    if m := headerRe.FindStringSubmatch(line); m != nil {
      key := strings.ToLower(m[1]); val := m[2]
      switch key {
      case "bpm":
        if v, err := strconv.Atoi(val); err == nil { bpm = v }
      case "beatsperbar":
        if v, err := strconv.Atoi(val); err == nil { beatsPerBar = v }
      case "title":
        title = val
      }
      continue
    }
    if m := sectionRe.FindStringSubmatch(line); m != nil {
      if cur != nil { sections = append(sections, *cur) }
      label := strings.TrimSpace(m[1])
      id := strings.ToLower(strings.ReplaceAll(label, " ", "-"))
      cur = &Section{Id: id, Label: label, Items: []Item{}}
      continue
    }
    if cur == nil { continue }
    if m := perfInlineRe.FindStringSubmatch(line); m != nil {
      cur.Items = append(cur.Items, Item{Type: "performance", Text: strings.TrimSpace(m[1])})
      cur.Items = append(cur.Items, Item{Type: "lyric", Text: strings.TrimSpace(m[2])})
      continue
    }
    if m := perfRe.FindStringSubmatch(line); m != nil {
      cur.Items = append(cur.Items, Item{Type: "performance", Text: strings.TrimSpace(m[1])})
      continue
    }
    if m := cueRe.FindStringSubmatch(line); m != nil {
      name, params := parseCue(m[1], bpm, beatsPerBar)
      cur.Items = append(cur.Items, Item{Type: "cue", Name: name, Category: "sfx", Params: params})
      continue
    }
    // else lyric:
    cur.Items = append(cur.Items, Item{Type: "lyric", Text: line})
  }
  if cur != nil { sections = append(sections, *cur) }
  ir := IR{MMSLVersion: "1.0", Title: title, BPM: bpm, BeatsPerBar: beatsPerBar, Sections: sections}
  enc := json.NewEncoder(os.Stdout)
  enc.SetIndent("", "  ")
  enc.Encode(ir)
}
```

### 5.3 Python Parser

```python
# File: mmsl_parser.py
# Usage: python mmsl_parser.py input.mmsl

import re, sys, json

def to_beats(val, bpm=120, beats_per_bar=4):
    val = str(val).strip()
    m = re.match(r'(?i)^([\d.]+)(ms|s|beats|b|bar|bars)?$', val)
    if not m:
        try:
            return float(val)
        except:
            return None
    n = float(m.group(1))
    unit = (m.group(2) or '').lower()
    if unit == 'ms':
        return (n/1000.0) * bpm / 60.0
    if unit == 's' or unit == '':
        return n * bpm / 60.0
    if unit in ('beats','b'):
        return n
    if unit in ('bar','bars'):
        return n * beats_per_bar
    return None

def parse_cue(body, bpm, beats_per_bar):
    # naive split, supports quoted strings if necessary
    tokens = re.findall(r'\"[^\"]+\"|\S+', body)
    tokens = [t.strip('"') for t in tokens]
    if not tokens: return None, {}
    name = tokens[0]
    params = {}
    for t in tokens[1:]:
        if '=' in t:
            k,v = t.split('=',1)
            k = k.lower()
            if re.match(r'^[\d.]+(ms|s|beats|b|bar|bars)?$', v, re.I):
                params[k] = to_beats(v, bpm, beats_per_bar)
            else:
                if v.isdigit():
                    params[k] = int(v)
                else:
                    try:
                        params[k] = float(v)
                    except:
                        if v.lower() in ('true','false'):
                            params[k] = v.lower() == 'true'
                        else:
                            params[k] = v
        else:
            params.setdefault('_pos', []).append(t)
    return name, params

def parse_mmsl(text):
    lines = text.splitlines()
    bpm = 120
    beats_per_bar = 4
    title = None
    sections = []
    cur = None
    section_re = re.compile(r'^\s*\[([^\]]+)\]\s*$')
    perf_re = re.compile(r'^\s*\(([^)]+)\)\s*$')
    perf_inline_re = re.compile(r'^\s*\(([^)]+)\)\s*(.+)$')
    cue_re = re.compile(r'^\s*<([^>]+)>\s*$')
    header_re = re.compile(r'^\s*@([A-Za-z0-9_]+)\s+(.+)$')
    for raw in lines:
        line = raw.strip()
        if not line: continue
        h = header_re.match(line)
        if h:
            key = h.group(1).lower(); val=h.group(2).strip()
            if key == 'bpm': bpm = int(val) if val.isdigit() else bpm
            elif key == 'beatsperbar': beats_per_bar = int(val) if val.isdigit() else beats_per_bar
            elif key == 'title': title = val
            continue
        s = section_re.match(line)
        if s:
            if cur: sections.append(cur)
            label = s.group(1).strip()
            cur = {'id': label.lower().replace(' ', '-'), 'label': label, 'items': []}
            continue
        if cur is None:
            continue
        m = perf_inline_re.match(line)
        if m:
            cur['items'].append({'type':'performance','text': m.group(1).strip()})
            cur['items'].append({'type':'lyric','text': m.group(2).strip()})
            continue
        if perf_re.match(line):
            t = perf_re.match(line).group(1).strip()
            cur['items'].append({'type':'performance','text':t})
            continue
        if cue_re.match(line):
            cue_body = cue_re.match(line).group(1).strip()
            name, params = parse_cue(cue_body, bpm, beats_per_bar)
            cur['items'].append({'type':'cue','name':name,'category':'sfx','params':params})
            continue
        cur['items'].append({'type':'lyric','text':line})
    if cur: sections.append(cur)
    return {'mmsl_version':'1.0','title':title,'bpm':bpm,'beatsPerBar':beats_per_bar,'sections':sections}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python mmsl_parser.py file.mmsl")
        sys.exit(2)
    with open(sys.argv[1],'r',encoding='utf8') as fh:
        text = fh.read()
    ir = parse_mmsl(text)
    print(json.dumps(ir, indent=2))
```

## 6. Music ↔ Video Synchronization Pipeline Proposal

### Objective

Enable deterministic mapping from a M-MSL file to a video storyboard timeline so visuals can be time-aligned with musical beats, SFX, and lyrical events.

### Main Components

- **Authoring Layer**: Editor showing `[Section]`, `(Performance)`, `<Cue>` markers with live BPM/Time preview and beat grid
- **Parser & Normalizer**: Convert M-MSL → JSON IR (beats-normalized)
- **Timing Engine**: Convert beat-based timestamps into absolute time (seconds) using BPM, tempo maps, and time signature
- **Event Scheduler**: Emit event list for audio engine and storyboard engine. Each event: `{ type, time_seconds, time_beats, payload }`
- **Audio Renderer**: Map cue names → sample file / synth patch / MIDI. Render stems or schedule real-time triggers
- **Video Storyboarder**: Accept event list, place visual cues on timeline (edit points). Allow visual presets: camera_cut, zoom_in, overlay_on, color_grade, shot_type, VFX
- **DAW / NLE Bridge**: Export MIDI, automation, markers (Ableton Set, Logic Marker, Reaper project, or simple XML/CSV). Export visual markers as EDL/AAF/markers or generate sidecar JSON for NLE (Premiere, Resolve)
- **Preview & Playback**: App previews audio+video in sync, with frame-accurate cue triggers
- **Live Performance Mode** (optional): Real-time scheduler listens to tempo and triggers events live

### Beat → Time Mapping

For constant tempo: `seconds = (beat / BPM) * 60`

For tempo maps (tempo changes): Maintain ordered tempo segments: `{start_beat, bpm}`. Compute cumulative seconds via integrating piecewise segments.

### Data Exchange Format

**IR → Event List**:

```json
[
  { "time_beats": 8, "time_seconds": 4.0, "type":"cue", "name":"guitar_solo", "params":{...} },
  { "time_beats": 12, "time_seconds": 6.0, "type":"visual", "action":"camera_cut", "params":{"angle":"close"} }
]
```

### Example Workflow

1. Author writes M-MSL (with `@BPM 128`) and `<Cue beat=16 ...>` markers
2. Parser produces IR (durations normalized to beats)
3. Timing Engine converts each cue to `time_seconds`
4. Event Scheduler outputs JSON event list
5. Storyboard UI imports events and auto-creates timeline panels: `time_seconds=7.5` → place camera cut marker, `time_seconds=8.0` → place lyric subtitle
6. Audio Renderer produces stems and final mix
7. Export combined timeline to NLE with audio stems and visual markers for polishing

### File Formats & Exports

- **Primary**: JSON IR + event list (canonical exchange format)
- **Audio**: WAV stems, MIDI files
- **Video**: EDL/AAF/XML or NLE marker import format + sidecar JSON mapping
- **DAW**: MIDI + markers or native session export via templates
- **Live**: OSC / WebSocket events for live controllers

### Drift & Sync Considerations

Use sample-accurate scheduling for audio (DAW). Use frame-accurate scheduling for video (NLE). Align using common time base (seconds with 1/48000s or 1/1000s precision). For variable framerate (VFR) video, convert timeline to CFR for final render.

### Example: Beat-Driven Storyboard Snippet

**Author DSL**:

```mmsl
@BPM 120
@BeatsPerBar 4

[Chorus]
(full)
We are the fire!
<SFX guitar_solo duration=8beats>
<SFX crowd_cheer start_beat=16 repeat=2>
```

**Pipeline Result**:

- `guitar_solo` → start at section-chosen beat (compute absolute beat) → `time_seconds = (start_beat / 120) * 60`
- **Storyboard entries**: At `time_seconds`: add `camera_pullback` and `lights_flicker` markers

## 7. Validation, Testing & CI

- **Schema Checks**: Use AJV/JSON Schema for IR validation
- **Unit Tests**: Success cases, malformed cues, quoted values, edge durations
- **E2E Tests**: DSL → IR → Event list → rendered audio stub → verify event times match expected seconds within epsilon
- **Lint Rules**: Unknown SFX names warn; invalid durations error; missing BPM warn

## 8. Roadmap (Recommended Next Steps)

1. Finalize canonical SFX namespace + sample mapping JSON
2. Implement full tokenizer (handles quotes, escapes)
3. Implement tempo maps and section-level `start_beat` offsets
4. Add DAW/NLE export format adapters (CSV markers, XML)
5. Build an authoring UI with live beat ruler and preview
6. Add AI prompt templates that map `<Cue>` tokens to synth presets or sample IDs

## 9. Quick Reference & Cheat Sheet

### Markers

- `[Section]` — new section (line alone)
- `(Instruction)` — performance / delivery (line or inline)
- `<Cue name key=val>` — audio/production trigger
- `@BPM 120` — header, top of file

### Duration Units

- `s`, `ms`, `beats`/`b`, `bar`/`bars`

### Conversion

- `seconds = (beats / BPM) * 60`

### Storage

Store everything in IR as `duration_beats` and `start_beat` where possible
