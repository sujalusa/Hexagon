// Feature: hexagon-civic-literacy, Property 9: Framing Analysis Structured Output
// Feature: hexagon-civic-literacy, Property 10: Framing Consistency Across Political Orientations
// Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { BiasFramingIndicatorModule } from '../BiasFramingIndicatorModule.js';
import type { RoutedRequest } from '../../types/index.js';

// ─── Loaded phrase sets ───────────────────────────────────────────────────────

const LEFT_LEANING_PHRASES = ['climate crisis', 'undocumented immigrant', 'pro-choice'];
const RIGHT_LEANING_PHRASES = ['climate change', 'illegal alien', 'pro-life'];

// Phrases that are definitely in the loaded-phrase dictionary
const KNOWN_LOADED_PHRASES = [
  'tax relief',
  'fake news',
  'pro-life',
  'climate crisis',
  'illegal alien',
  'undocumented immigrant',
  'mainstream media',
  'tax burden',
  'pro-choice',
  'climate change',
];

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// A request whose sourceText contains at least one known loaded phrase
const loadedPhraseRequestArb: fc.Arbitrary<RoutedRequest> = fc
  .record({
    phrase: fc.constantFrom(...KNOWN_LOADED_PHRASES),
    prefix: fc.string({ minLength: 0, maxLength: 40 }).filter((s) => !/[<>]/.test(s)),
    suffix: fc.string({ minLength: 0, maxLength: 40 }).filter((s) => !/[<>]/.test(s)),
  })
  .map(({ phrase, prefix, suffix }): RoutedRequest => ({
    moduleId: 'framing',
    sourceText: `${prefix} ${phrase} ${suffix}`.trim(),
    conversationHistory: [],
  }));

// A pair of requests: one left-leaning phrase, one right-leaning equivalent,
// both with the same surrounding context (no structural patterns added)
const matchedPairArb: fc.Arbitrary<[RoutedRequest, RoutedRequest]> = fc
  .record({
    index: fc.integer({ min: 0, max: LEFT_LEANING_PHRASES.length - 1 }),
    context: fc.string({ minLength: 5, maxLength: 30 }).filter((s) => /^[a-zA-Z ]+$/.test(s)),
  })
  .map(({ index, context }): [RoutedRequest, RoutedRequest] => {
    const leftPhrase = LEFT_LEANING_PHRASES[index];
    const rightPhrase = RIGHT_LEANING_PHRASES[index];
    const makeRequest = (phrase: string): RoutedRequest => ({
      moduleId: 'framing',
      sourceText: `${context} ${phrase} ${context}`.trim(),
      conversationHistory: [],
    });
    return [makeRequest(leftPhrase), makeRequest(rightPhrase)];
  });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 9: Framing Analysis Structured Output', () => {
  const module = new BiasFramingIndicatorModule();

  /**
   * **Validates: Requirements 6.1, 6.2, 6.3**
   *
   * For any source text containing a known loaded phrase, the analysis must:
   * 1. Include a "Loaded Language Analysis" section with non-empty content
   * 2. Have at least one factualClaim
   * 3. Have at least two perspectives
   */
  it('produces required structured output for texts with known loaded phrases', async () => {
    await fc.assert(
      fc.asyncProperty(loadedPhraseRequestArb, async (request) => {
        const result = await module.analyze(request);

        // 1. "Loaded Language Analysis" section exists with non-empty content
        const loadedSection = result.sections.find((s) => s.title === 'Loaded Language Analysis');
        expect(loadedSection).toBeDefined();
        expect(loadedSection!.content.length).toBeGreaterThan(0);

        // 2. At least one factual claim
        expect(result.factualClaims.length).toBeGreaterThanOrEqual(1);

        // 3. At least two perspectives
        expect(result.perspectives.length).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 10: Framing Consistency Across Political Orientations', () => {
  const module = new BiasFramingIndicatorModule();

  /**
   * **Validates: Requirements 6.4**
   *
   * For matched pairs of texts with equivalent structural context but different
   * political orientations (left-leaning vs right-leaning loaded phrase),
   * the number of loaded phrases detected must be within ±1 of each other.
   */
  it('detects loaded phrases consistently regardless of political orientation', async () => {
    await fc.assert(
      fc.asyncProperty(matchedPairArb, async ([leftRequest, rightRequest]) => {
        const [leftResult, rightResult] = await Promise.all([
          module.analyze(leftRequest),
          module.analyze(rightRequest),
        ]);

        const leftCount = leftResult.factualClaims.length;
        const rightCount = rightResult.factualClaims.length;

        // Counts must be within ±1 of each other
        expect(Math.abs(leftCount - rightCount)).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Unit test: no-framing-patterns response', () => {
  const module = new BiasFramingIndicatorModule();

  /**
   * **Validates: Requirements 6.6**
   *
   * Neutral text with no loaded phrases or structural patterns must return
   * a response where:
   * - A section exists whose content contains `framingPatternsDetected: false`
   * - That same content also contains `criteriaApplied`
   */
  it('returns framingPatternsDetected: false with criteriaApplied for neutral text', async () => {
    const request: RoutedRequest = {
      moduleId: 'framing',
      sourceText: 'The committee met on Tuesday to discuss the proposed budget.',
      conversationHistory: [],
    };

    const result = await module.analyze(request);

    // Find a section whose content encodes framingPatternsDetected: false
    const noPatternSection = result.sections.find(
      (s) => s.content.includes('"framingPatternsDetected":false') ||
             s.content.includes('"framingPatternsDetected": false'),
    );
    expect(noPatternSection).toBeDefined();

    // That same section must also reference criteriaApplied
    expect(noPatternSection!.content).toContain('criteriaApplied');
  });
});
