// Feature: hexagon-civic-literacy, Property 12: No Verbatim Repetition in Follow-Ups
// Validates: Requirements 7.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { HexagonPipeline } from '../HexagonPipeline.js';
import type { Turn, FinalResponse } from '../../types/index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract all n-grams (sequences of n consecutive words) from a string.
 */
function getNgrams(text: string, n: number): Set<string> {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const ngrams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/**
 * Check whether `text` contains any verbatim sequence of ≥10 consecutive words
 * from `previousResponse`.
 */
function hasVerbatimRepetition(previousResponse: string, followUpResponse: string): boolean {
  const WINDOW = 10;
  const prevWords = previousResponse.toLowerCase().split(/\s+/).filter(Boolean);
  if (prevWords.length < WINDOW) return false;

  const followUpLower = followUpResponse.toLowerCase();
  for (let i = 0; i <= prevWords.length - WINDOW; i++) {
    const ngram = prevWords.slice(i, i + WINDOW).join(' ');
    if (followUpLower.includes(ngram)) return true;
  }
  return false;
}

/**
 * Extract the assistant response text from a FinalResponse.
 */
function extractResponseText(response: FinalResponse): string {
  return response.scaffolded.analysis.sections
    .map((s) => `${s.title}: ${s.content}`)
    .join('\n\n');
}

// ─── Sample debate text (≥100 words) ─────────────────────────────────────────

const DEBATE_EXCERPT =
  'Senator Johnson argued that the proposed infrastructure bill would create thousands of jobs ' +
  'in rural communities that have been left behind by the modern economy. He cited statistics ' +
  'showing unemployment rates in these regions are twice the national average. Representative ' +
  'Martinez countered that the bill allocates insufficient funding for urban transit systems, ' +
  'which serve a larger share of the working population. She emphasized that public transportation ' +
  'reduces carbon emissions and supports low-income workers who cannot afford private vehicles. ' +
  'Both speakers agreed that infrastructure investment is necessary but disagreed sharply on ' +
  'how the funds should be distributed across urban and rural areas of the country.';

// ─── Property 12: No Verbatim Repetition in Follow-Ups ───────────────────────

describe('Property 12: No Verbatim Repetition in Follow-Ups', () => {
  /**
   * **Validates: Requirements 7.4**
   *
   * When a follow-up question is asked, the pipeline injects a context note
   * that changes the sourceText, ensuring the second response differs from
   * the first. No verbatim sequence of ≥10 consecutive words from the first
   * response should appear in the follow-up response.
   */
  it('follow-up response contains no verbatim sequence of ≥10 words from the prior response', async () => {
    const firstQuestions = [
      'What does HR-1234 do?',
      'Show me campaign finance data for candidate-001',
      'Is this article about tax relief biased?',
    ] as const;

    const followUpQuestions = [
      'Can you tell me more about the affected parties?',
      'What analytical frameworks apply here?',
      'What should I look for when evaluating this?',
    ] as const;

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...firstQuestions),
        fc.constantFrom(...followUpQuestions),
        async (firstQuestion, followUpQuestion) => {
          const pipeline = new HexagonPipeline();
          const history: Turn[] = [];

          // First call — empty history
          const firstResult = await pipeline.process(firstQuestion, history);
          if ('scopeBoundaryMessage' in firstResult) return; // skip guardrail-blocked responses

          const firstResponseText = extractResponseText(firstResult);

          // Build history with the first exchange
          const updatedHistory: Turn[] = [
            { role: 'user', content: firstQuestion },
            { role: 'assistant', content: firstResponseText },
          ];

          // Second call — with history (pipeline injects follow-up context note)
          const followUpResult = await pipeline.process(followUpQuestion, updatedHistory);
          if ('scopeBoundaryMessage' in followUpResult) return; // skip guardrail-blocked responses

          const followUpResponseText = extractResponseText(followUpResult);

          // Assert no verbatim repetition of ≥10 consecutive words
          expect(hasVerbatimRepetition(firstResponseText, followUpResponseText)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Integration Tests ────────────────────────────────────────────────────────

describe('HexagonPipeline integration tests', () => {
  it('end-to-end legislation flow returns a FinalResponse', async () => {
    const pipeline = new HexagonPipeline();
    const result = await pipeline.process('What does HR-1234 do?', []);
    // Should return FinalResponse (not throw), with perspectivesVerified boolean
    expect(result).toBeDefined();
    if (!('scopeBoundaryMessage' in result)) {
      expect(typeof (result as FinalResponse).perspectivesVerified).toBe('boolean');
    }
  });

  it('end-to-end funding flow returns a FinalResponse', async () => {
    const pipeline = new HexagonPipeline();
    const result = await pipeline.process('Show me campaign finance data for candidate-001', []);
    expect(result).toBeDefined();
    if (!('scopeBoundaryMessage' in result)) {
      expect(typeof (result as FinalResponse).perspectivesVerified).toBe('boolean');
    }
  });

  it('end-to-end debate flow returns a FinalResponse', async () => {
    const pipeline = new HexagonPipeline();
    const result = await pipeline.process(
      'Analyze this debate transcript: ' + DEBATE_EXCERPT,
      [],
    );
    expect(result).toBeDefined();
    if (!('scopeBoundaryMessage' in result)) {
      expect(typeof (result as FinalResponse).perspectivesVerified).toBe('boolean');
    }
  });

  it('end-to-end framing flow returns a FinalResponse', async () => {
    const pipeline = new HexagonPipeline();
    const result = await pipeline.process('Is this article about tax relief biased?', []);
    expect(result).toBeDefined();
    if (!('scopeBoundaryMessage' in result)) {
      expect(typeof (result as FinalResponse).perspectivesVerified).toBe('boolean');
    }
  });

  it('conversation history threading — second call succeeds after first', async () => {
    const pipeline = new HexagonPipeline();
    const history: Turn[] = [];

    // First call
    const firstResult = await pipeline.process('What does HR-1234 do?', history);
    expect(firstResult).toBeDefined();

    if ('scopeBoundaryMessage' in firstResult) return;

    const firstResponseText = extractResponseText(firstResult);

    // Build history from first exchange
    const updatedHistory: Turn[] = [
      { role: 'user', content: 'What does HR-1234 do?' },
      { role: 'assistant', content: firstResponseText },
    ];

    // Second call with history
    const secondResult = await pipeline.process(
      'Can you tell me more about the affected parties?',
      updatedHistory,
    );
    expect(secondResult).toBeDefined();
    if (!('scopeBoundaryMessage' in secondResult)) {
      expect(typeof (secondResult as FinalResponse).perspectivesVerified).toBe('boolean');
    }
  });
});
