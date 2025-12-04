import { Injectable } from '@nestjs/common';

export interface MMSLHeader {
  bpm?: number;
  beatsPerBar?: number;
  timeSignature?: string;
  title?: string;
  key?: string;
  mmslVersion?: string;
  instruments?: string[];
}

export interface MMSLCue {
  name: string;
  params: Record<string, string | number>;
}

export interface MMSLItem {
  type: 'performance' | 'lyric' | 'cue';
  content: string;
  cue?: MMSLCue;
}

export interface MMSLSection {
  name: string;
  headers: MMSLHeader;
  items: MMSLItem[];
}

export interface MMSLSong {
  headers: MMSLHeader;
  sections: MMSLSection[];
}

@Injectable()
export class MmslParserService {
  /**
   * Parse M-MSL text into structured JSON IR
   */
  parse(mmslText: string): MMSLSong {
    const lines = mmslText.split('\n').map((line) => line.trimEnd());
    const headers: MMSLHeader = {};
    const sections: MMSLSection[] = [];

    let currentSection: MMSLSection | null = null;
    let i = 0;

    // Parse headers
    while (i < lines.length) {
      const line = lines[i];
      if (!line) {
        i++;
        continue;
      }
      if (line.startsWith('@')) {
        this.parseHeader(line, headers);
        i++;
      } else if (line.startsWith('[')) {
        break; // Start of sections
      } else if (line.trim() === '') {
        i++; // Skip empty lines
      } else {
        break; // Non-header content
      }
    }

    // Set defaults
    if (!headers.bpm) headers.bpm = 120;
    if (!headers.beatsPerBar) headers.beatsPerBar = 4;

    // Parse sections
    while (i < lines.length) {
      const line = lines[i];
      if (!line) {
        i++;
        continue;
      }

      if (line.startsWith('[') && line.endsWith(']')) {
        // New section
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          name: line.slice(1, -1).trim(),
          headers: {},
          items: [],
        };
        i++;
        // Parse section headers
        while (i < lines.length) {
          const headerLine = lines[i];
          if (!headerLine || !headerLine.startsWith('@')) {
            break; // End of headers
          }
          this.parseHeader(headerLine, currentSection.headers);
          i++;
        }
        i--; // Back up to process the current line
      } else if (currentSection && line.trim() !== '') {
        const item = this.parseLine(line);
        if (item) {
          currentSection.items.push(item);
        }
      }
      i++;
    }

    // Add final section
    if (currentSection) {
      sections.push(currentSection);
    }

    return { headers, sections };
  }

  private parseHeader(line: string, headers: MMSLHeader): void {
    const match = line.match(/^@(\w+)\s+(.+)$/);
    if (!match) return;

    const [, key, value] = match;
    if (!key || !value) return;

    const lowerKey = key.toLowerCase();

    switch (lowerKey) {
      case 'bpm':
        headers.bpm = parseInt(value, 10);
        break;
      case 'beatsperbar':
        headers.beatsPerBar = parseInt(value, 10);
        break;
      case 'timesignature':
        headers.timeSignature = value;
        break;
      case 'title':
        headers.title = value;
        break;
      case 'key':
        headers.key = value;
        break;
      case 'instruments':
        headers.instruments = value.split(',').map((s) => s.trim());
        break;
    }
  }

  private parseLine(line: string): MMSLItem | null {
    if (line.startsWith('(') && line.endsWith(')')) {
      // Performance direction
      return {
        type: 'performance',
        content: line.slice(1, -1).trim(),
      };
    } else if (line.startsWith('<') && line.endsWith('>')) {
      // Audio cue
      const cue = this.parseCue(line.slice(1, -1));
      return {
        type: 'cue',
        content: line,
        cue,
      };
    } else if (line.trim() !== '') {
      // Lyric line
      return {
        type: 'lyric',
        content: line,
      };
    }
    return null;
  }

  private parseCue(cueBody: string): MMSLCue {
    const tokens = cueBody.trim().split(/\s+/);
    const name = tokens[0];
    if (!name) throw new Error('Invalid cue: missing name');

    const params: Record<string, string | number> = {};

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;

      const eqIndex = token.indexOf('=');
      if (eqIndex > 0) {
        const key = token.slice(0, eqIndex);
        let value: string | number = token.slice(eqIndex + 1);

        // Try to parse as number
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          value = numValue;
        }

        params[key] = value;
      }
    }

    return { name, params };
  }

  /**
   * Convert duration strings to beats
   */
  durationToBeats(duration: string, bpm: number, beatsPerBar: number): number {
    const match = duration.match(/^(\d+(?:\.\d+)?)(s|ms|beats?|b|bars?)?$/);
    if (!match) return 0;

    const [, numStr, unit] = match;
    if (!numStr) return 0;

    const num = parseFloat(numStr);

    switch (unit) {
      case 's':
        return (num * bpm) / 60; // seconds to beats
      case 'ms':
        return (num * bpm) / 60000; // milliseconds to beats
      case 'bar':
      case 'bars':
        return num * beatsPerBar; // bars to beats
      case 'beat':
      case 'beats':
      case 'b':
      default:
        return num; // already in beats
    }
  }

  /**
   * Convert beats to seconds
   */
  beatsToSeconds(beats: number, bpm: number): number {
    return (beats / bpm) * 60;
  }

  /**
   * Validate M-MSL syntax
   */
  validate(mmslText: string): { valid: boolean; errors: string[] } {
    try {
      this.parse(mmslText);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [
          error instanceof Error ? error.message : 'Unknown parsing error',
        ],
      };
    }
  }
}
