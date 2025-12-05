import { Injectable } from '@nestjs/common';

export interface CueParams {
  [key: string]: string | number | boolean;
}

export interface ParsedItem {
  type: 'performance' | 'lyric' | 'cue';
  text?: string;
  cue_type?: string;
  name?: string;
  params?: CueParams;
}

export interface ParsedSection {
  id: string;
  label: string;
  meta?: string | null;
  items: ParsedItem[];
}

export interface ParsedSong {
  title?: string;
  bpm?: number;
  key?: string;
  sections: ParsedSection[];
}

export interface ValidationError {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

@Injectable()
export class SongDslParserService {
  /**
   * Parse Song Annotation DSL text into structured JSON
   */
  parseSong(text: string): { song: ParsedSong; errors: ValidationError[] } {
    const lines = text.split(/\r?\n/);
    const sections: ParsedSection[] = [];
    const errors: ValidationError[] = [];
    let currentSection: ParsedSection = {
      id: 'intro',
      label: 'Intro',
      items: [],
    };
    let songTitle: string | undefined;
    let songBpm: number | undefined;
    let songKey: string | undefined;

    // Regex patterns
    const sectionRE = /^\s*\[([^\]]+)\]\s*$/i;
    const perfRE = /^\s*\(([^)]+)\)\s*$/i;
    const perfInlineRE = /^\s*\(([^)]+)\)\s*(.+)$/i;
    const cueRE = /^\s*<([^>]+)>\s*$/i;
    const metadataRE = /^\s*(title|bpm|key):\s*(.+)\s*$/i;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw) continue;
      const line = raw.trim();

      if (!line) continue;

      let match;

      // Check for metadata
      if ((match = line.match(metadataRE))) {
        const metaKey = match[1]?.toLowerCase();
        const value = match[2]?.trim();

        if (!metaKey || !value) continue;

        switch (metaKey) {
          case 'title':
            songTitle = value;
            break;
          case 'bpm': {
            const bpmNum = parseInt(value);
            if (isNaN(bpmNum) || bpmNum < 60 || bpmNum > 200) {
              errors.push({
                line: i + 1,
                message: `Invalid BPM: ${value}. Must be between 60-200`,
                severity: 'error',
              });
            } else {
              songBpm = bpmNum;
            }
            break;
          }
          case 'key':
            songKey = value;
            break;
        }
        continue;
      }

      // Check for section
      if ((match = line.match(sectionRE))) {
        if (currentSection.items.length > 0) {
          sections.push(currentSection);
        }

        const label = match[1]?.trim();
        if (!label) continue;

        currentSection = {
          id: label
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
          label,
          items: [],
        };
        continue;
      }

      // Check for inline performance + lyric
      if ((match = line.match(perfInlineRE))) {
        const perfText = match[1]?.trim();
        const lyricText = match[2]?.trim();

        if (perfText) {
          currentSection.items.push({
            type: 'performance',
            text: perfText,
          });
        }
        if (lyricText) {
          currentSection.items.push({
            type: 'lyric',
            text: lyricText,
          });
        }
        continue;
      }

      // Check for performance instruction
      if ((match = line.match(perfRE))) {
        const perfText = match[1]?.trim();
        if (perfText) {
          currentSection.items.push({
            type: 'performance',
            text: perfText,
          });
        }
        continue;
      }

      // Check for audio cue
      if ((match = line.match(cueRE))) {
        const cueBody = match[1]?.trim();
        if (cueBody) {
          const cueResult = this.parseCue(cueBody, i + 1, errors);

          if (cueResult) {
            currentSection.items.push(cueResult);
          }
        }
        continue;
      }

      // Default: lyric line
      currentSection.items.push({
        type: 'lyric',
        text: line,
      });
    }

    // Add final section if it has content
    if (currentSection.items.length > 0) {
      sections.push(currentSection);
    }

    // Validate the parsed structure
    this.validateParsedSong(
      { title: songTitle, bpm: songBpm, key: songKey, sections },
      errors
    );

    return {
      song: { title: songTitle, bpm: songBpm, key: songKey, sections },
      errors,
    };
  }

  /**
   * Parse a cue string into structured format
   */
  private parseCue(
    cueBody: string,
    lineNumber: number,
    errors: ValidationError[]
  ): ParsedItem | null {
    const tokens = cueBody.split(/\s+/);
    if (tokens.length === 0) {
      errors.push({
        line: lineNumber,
        message: 'Empty cue body',
        severity: 'error',
      });
      return null;
    }

    const cueType = tokens[0]?.toLowerCase();
    if (!cueType) {
      errors.push({
        line: lineNumber,
        message: 'Invalid cue format',
        severity: 'error',
      });
      return null;
    }

    const params: CueParams = {};

    // Parse key=value parameters
    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;

      const kv = token.split('=');

      if (kv.length === 2) {
        const key = kv[0]?.toLowerCase();
        const rawValue = kv[1];

        if (!key || !rawValue) continue;

        let value: string | number | boolean = rawValue;

        // Convert numeric values
        if (typeof value === 'string') {
          if (/^\d+(\.\d+)?s?$/.test(value)) {
            // Duration like "6s" or "1.5"
            value = parseFloat(value.replace('s', ''));
          } else if (/^\d+$/.test(value)) {
            // Integer
            value = parseInt(value);
          } else if (/^\d+\.\d+$/.test(value)) {
            // Float
            value = parseFloat(value);
          } else if (value === 'true' || value === 'false') {
            // Boolean
            value = value === 'true';
          }
        }

        params[key] = value;
      } else {
        // Positional parameter
        params[`param${i}`] = token;
      }
    }

    // Validate cue parameters
    this.validateCueParams(params, lineNumber, errors);

    return {
      type: 'cue',
      cue_type: cueType,
      name: tokens[0],
      params,
    };
  }

  /**
   * Validate cue parameters
   */
  private validateCueParams(
    params: CueParams,
    lineNumber: number,
    errors: ValidationError[]
  ): void {
    // Duration validation
    if (params.duration !== undefined) {
      const duration = params.duration;
      if (typeof duration !== 'number' || duration <= 0 || duration > 300) {
        errors.push({
          line: lineNumber,
          message: `Invalid duration: ${duration}. Must be a number between 0-300 seconds`,
          severity: 'error',
        });
      }
    }

    // Repeat validation
    if (params.repeat !== undefined) {
      const repeat = params.repeat;
      if (
        typeof repeat !== 'number' ||
        repeat < 1 ||
        !Number.isInteger(repeat)
      ) {
        errors.push({
          line: lineNumber,
          message: `Invalid repeat: ${repeat}. Must be a positive integer`,
          severity: 'error',
        });
      }
    }

    // Intensity/volume validation
    const intensity = params.intensity || params.volume;
    if (intensity !== undefined) {
      if (typeof intensity !== 'number' || intensity < 0 || intensity > 1) {
        errors.push({
          line: lineNumber,
          message: `Invalid intensity/volume: ${intensity}. Must be between 0.0-1.0`,
          severity: 'error',
        });
      }
    }

    // Pan validation
    if (params.pan !== undefined) {
      const pan = params.pan;
      if (typeof pan === 'string') {
        if (!['left', 'center', 'right'].includes(pan.toLowerCase())) {
          errors.push({
            line: lineNumber,
            message: `Invalid pan: ${pan}. Must be 'left', 'center', or 'right'`,
            severity: 'warning',
          });
        }
      } else if (typeof pan === 'number') {
        if (pan < -1 || pan > 1) {
          errors.push({
            line: lineNumber,
            message: `Invalid pan: ${pan}. Must be between -1.0 and 1.0`,
            severity: 'error',
          });
        }
      }
    }
  }

  /**
   * Validate the overall parsed song structure
   */
  private validateParsedSong(
    song: ParsedSong,
    errors: ValidationError[]
  ): void {
    // Must have at least one section
    if (song.sections.length === 0) {
      errors.push({
        line: 1,
        message: 'Song must contain at least one section',
        severity: 'error',
      });
    }

    // Validate section IDs are unique
    const sectionIds = new Set<string>();
    for (const section of song.sections) {
      if (sectionIds.has(section.id)) {
        errors.push({
          line: 1, // We don't track line numbers for sections
          message: `Duplicate section ID: ${section.id}`,
          severity: 'warning',
        });
      }
      sectionIds.add(section.id);
    }

    // BPM validation
    if (song.bpm !== undefined && (song.bpm < 60 || song.bpm > 200)) {
      errors.push({
        line: 1,
        message: `Invalid BPM: ${song.bpm}. Must be between 60-200`,
        severity: 'error',
      });
    }
  }

  /**
   * Convert parsed song back to DSL format
   */
  songToDsl(song: ParsedSong): string {
    const lines: string[] = [];

    if (song.title) lines.push(`Title: ${song.title}`);
    if (song.bpm) lines.push(`BPM: ${song.bpm}`);
    if (song.key) lines.push(`Key: ${song.key}`);

    if (lines.length > 0) lines.push(''); // Empty line after metadata

    for (const section of song.sections) {
      lines.push(`[${section.label}]`);

      for (const item of section.items) {
        switch (item.type) {
          case 'performance':
            lines.push(`(${item.text})`);
            break;
          case 'lyric':
            lines.push(item.text || '');
            break;
          case 'cue': {
            const params = item.params || {};
            const paramStr = Object.entries(params)
              .map(([k, v]) => `${k}=${v}`)
              .join(' ');
            lines.push(`<${item.name} ${paramStr}>`.trim());
            break;
          }
        }
      }

      lines.push(''); // Empty line between sections
    }

    return lines.join('\n').trim();
  }
}
