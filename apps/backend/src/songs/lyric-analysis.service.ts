import { Injectable } from '@nestjs/common';

export interface LyricDiversityMetrics {
  uniqueWords: number;
  totalWords: number;
  diversityScore: number; // 0-1, higher is better
  repetitivePhrases: string[]; // Phrases that appear multiple times
  averageLineLength: number;
  lineCount: number;
}

export interface AttentionSpanAnalysis {
  recommendedDuration: number; // seconds
  engagementScore: number; // 0-1, higher is better
  complexityLevel: 'simple' | 'moderate' | 'complex';
  attentionSpanFit: boolean;
}

export interface LyricQualityAnalysis {
  diversity: LyricDiversityMetrics;
  attentionSpan: AttentionSpanAnalysis;
  overallScore: number; // 0-1, higher is better
  suggestions: string[];
}

@Injectable()
export class LyricAnalysisService {
  /**
   * Analyze lyrics for diversity, repetition, and engagement metrics
   */
  analyzeLyrics(
    lyrics: string,
    targetDurationSeconds: number
  ): LyricQualityAnalysis {
    const lines = lyrics.split('\n').filter((line) => line.trim().length > 0);
    const words = lyrics
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    // Diversity analysis
    const uniqueWords = new Set(words);
    const diversityScore = uniqueWords.size / words.length;

    // Find repetitive phrases (2-4 words)
    const repetitivePhrases = this.findRepetitivePhrases(lyrics);

    // Attention span modeling
    const attentionSpan = this.analyzeAttentionSpan(
      lines.length,
      targetDurationSeconds,
      diversityScore
    );

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      diversityScore,
      attentionSpan,
      repetitivePhrases
    );

    // Generate suggestions
    const suggestions = this.generateSuggestions(
      diversityScore,
      attentionSpan,
      repetitivePhrases
    );

    return {
      diversity: {
        uniqueWords: uniqueWords.size,
        totalWords: words.length,
        diversityScore,
        repetitivePhrases,
        averageLineLength: words.length / lines.length,
        lineCount: lines.length,
      },
      attentionSpan,
      overallScore,
      suggestions,
    };
  }

  /**
   * Generate improved lyrics prompt with diversity constraints
   */
  generateConstrainedLyricsPrompt(
    narrative: string,
    durationSeconds: number,
    existingLyrics?: string
  ): string {
    const basePrompt = `Create lyrics for a ${durationSeconds}-second song based on this narrative: "${narrative}"

LYRICS REQUIREMENTS:
- Length: ${this.getOptimalLineCount(durationSeconds)} lines maximum
- Diversity: Use varied vocabulary, avoid repeating words unnecessarily
- Engagement: Keep lines concise and impactful for attention span
- Structure: Natural flow without filler phrases
- Quality: Meaningful content that fits the ${durationSeconds}s duration

${
  existingLyrics
    ? `IMPROVE these existing lyrics by fixing repetition and length issues: "${existingLyrics}"`
    : ''
}

Return only the lyrics as plain text, no explanations.`;

    return basePrompt;
  }

  /**
   * Validate lyrics against diversity and attention span constraints
   */
  validateLyricsConstraints(
    lyrics: string,
    targetDurationSeconds: number
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const analysis = this.analyzeLyrics(lyrics, targetDurationSeconds);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check diversity
    if (analysis.diversity.diversityScore < 0.4) {
      errors.push('Lyrics have too much repetition. Diversity score too low.');
    } else if (analysis.diversity.diversityScore < 0.6) {
      warnings.push('Lyrics could benefit from more varied vocabulary.');
    }

    // Check attention span fit
    if (!analysis.attentionSpan.attentionSpanFit) {
      errors.push(
        `Lyrics length doesn't fit ${targetDurationSeconds}s duration. Recommended: ${analysis.attentionSpan.recommendedDuration}s.`
      );
    }

    // Check repetitive phrases
    if (analysis.diversity.repetitivePhrases.length > 2) {
      warnings.push(
        'Multiple repetitive phrases detected. Consider varying the language.'
      );
    }

    // Check line count appropriateness
    const optimalLines = this.getOptimalLineCount(targetDurationSeconds);
    if (analysis.diversity.lineCount > optimalLines * 1.5) {
      errors.push(
        `Too many lines (${analysis.diversity.lineCount}). Maximum recommended: ${optimalLines}.`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private findRepetitivePhrases(text: string): string[] {
    const phrases: { [key: string]: number } = {};
    const words = text.toLowerCase().split(/\s+/);

    // Check 2-4 word phrases
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        phrases[phrase] = (phrases[phrase] || 0) + 1;
      }
    }

    // Return phrases that appear more than once
    return Object.entries(phrases)
      .filter(([_, count]) => count > 1)
      .map(([phrase, _]) => phrase)
      .slice(0, 5); // Limit to top 5 most repetitive
  }

  private analyzeAttentionSpan(
    lineCount: number,
    targetDurationSeconds: number,
    diversityScore: number
  ): AttentionSpanAnalysis {
    // Estimate reading time (roughly 2-3 seconds per line for singing)
    const estimatedDuration = lineCount * 2.5;

    // Calculate engagement score based on diversity and length fit
    const durationFit = Math.max(
      0,
      1 -
        Math.abs(estimatedDuration - targetDurationSeconds) /
          targetDurationSeconds
    );
    const engagementScore = diversityScore * 0.7 + durationFit * 0.3;

    // Determine complexity level
    let complexityLevel: 'simple' | 'moderate' | 'complex';
    if (lineCount <= 4) complexityLevel = 'simple';
    else if (lineCount <= 8) complexityLevel = 'moderate';
    else complexityLevel = 'complex';

    // Check if it fits attention span (allow 20% variance)
    const attentionSpanFit =
      Math.abs(estimatedDuration - targetDurationSeconds) /
        targetDurationSeconds <=
      0.2;

    return {
      recommendedDuration: Math.round(estimatedDuration),
      engagementScore,
      complexityLevel,
      attentionSpanFit,
    };
  }

  private calculateOverallScore(
    diversityScore: number,
    attentionSpan: AttentionSpanAnalysis,
    repetitivePhrases: string[]
  ): number {
    const diversityWeight = 0.4;
    const attentionWeight = 0.4;
    const repetitionPenalty = Math.max(0, 1 - repetitivePhrases.length * 0.1);

    return (
      diversityScore * diversityWeight +
      attentionSpan.engagementScore * attentionWeight +
      repetitionPenalty * 0.2
    );
  }

  private generateSuggestions(
    diversityScore: number,
    attentionSpan: AttentionSpanAnalysis,
    repetitivePhrases: string[]
  ): string[] {
    const suggestions: string[] = [];

    if (diversityScore < 0.6) {
      suggestions.push('Use more varied vocabulary to increase engagement.');
    }

    if (!attentionSpan.attentionSpanFit) {
      suggestions.push(
        `Adjust length for ${attentionSpan.recommendedDuration}s duration instead of current estimate.`
      );
    }

    if (repetitivePhrases.length > 0) {
      suggestions.push(
        `Avoid overusing phrases like: ${repetitivePhrases
          .slice(0, 3)
          .join(', ')}`
      );
    }

    if (attentionSpan.complexityLevel === 'complex') {
      suggestions.push(
        'Consider simplifying the structure for better attention retention.'
      );
    }

    return suggestions;
  }

  /**
   * Get optimal line count based on attention span modeling
   */
  getOptimalLineCount(durationSeconds: number): number {
    // Rough guideline: 2-3 lines per 30 seconds
    const linesPer30Seconds = 2.5;
    return Math.max(
      3,
      Math.min(12, Math.round((durationSeconds / 30) * linesPer30Seconds))
    );
  }

  /**
   * Get diversity guidelines for LLM prompts
   */
  getDiversityGuidelines(): string {
    return 'Avoid repetitive filler words (like "oh", "yeah", "baby"). Use varied vocabulary, sentence structures, and rhythmic patterns. Maintain engagement through content progression and emotional variety.';
  }
}
