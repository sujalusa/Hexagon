// Feature: hexagon-civic-literacy, Property 6: Debate Structured Output
// Feature: hexagon-civic-literacy, Property 7: Short Input Rejection
// Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DebateAnalyzerModule } from '../DebateAnalyzerModule.js';
import type { RoutedRequest } from '../../types/index.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// Words composed only of letters (no punctuation that could confuse word count)
const wordArb = fc.string({ minLength: 3, maxLength: 10 }).filter((s) => /^[a-zA-Z]+$/.test(s));

// ≥100 words → valid debate input
const longTextArb = fc
  .array(wordArb, { minLength: 100, maxLength: 150 })
  .map((words) => words.join(' '));

// <100 words → too short
const shortTextArb = fc
  .array(wordArb, { minLength: 0, maxLength: 99 })
  .map((words) => words.join(' '));

const longRequestArb: fc.Arbitrary<RoutedRequest> = longTextArb.map(
  (sourceText): RoutedRequest => ({
    moduleId: 'debate',
    sourceText,
    conversationHistory: [],
  }),
);

const shortRequestArb: fc.Arbitrary<RoutedRequest> = shortTextArb.map(
  (sourceText): RoutedRequest => ({
    moduleId: 'debate',
    sourceText,
    conversationHistory: [],
  }),
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 6: Debate Structured Output', () => {
  const module = new DebateAnalyzerModule();

  /**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   *
   * For any input ≥100 words, the analysis output must:
   * 1. Have an "Argument Structure" section
   * 2. Have a "Rhetorical Techniques" section
   * 3. Have ≥1 factualClaim with `verifiable` and `evidenceProvided` set (not undefined)
   * 4. Have perspectives.length >= 2
   */
  it('produces required structured output for inputs with ≥100 words', async () => {
    await fc.assert(
      fc.asyncProperty(longRequestArb, async (request) => {
        const result = await module.analyze(request);

        // 1. "Argument Structure" section exists
        const argSection = result.sections.find((s) => s.title === 'Argument Structure');
        expect(argSection).toBeDefined();
        expect(argSection!.content.length).toBeGreaterThan(0);

        // 2. "Rhetorical Techniques" section exists
        const rhetSection = result.sections.find((s) => s.title === 'Rhetorical Techniques');
        expect(rhetSection).toBeDefined();
        expect(rhetSection!.content.length).toBeGreaterThan(0);

        // 3. ≥1 factualClaim with verifiable and evidenceProvided set (not undefined)
        expect(result.factualClaims.length).toBeGreaterThanOrEqual(1);
        const claimWithFields = result.factualClaims.find(
          (fc) => fc.verifiable !== undefined && fc.evidenceProvided !== undefined,
        );
        expect(claimWithFields).toBeDefined();

        // 4. perspectives.length >= 2
        expect(result.perspectives.length).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 7: Short Input Rejection', () => {
  const module = new DebateAnalyzerModule();

  /**
   * **Validates: Requirements 4.6**
   *
   * For any input with word count < 100, the module must return a notification
   * response (not a full analysis output). This is indicated by either:
   * - dataGaps being defined with at least one entry, OR
   * - sections containing a section titled "Input Too Short"
   */
  it('returns a notification response for inputs with <100 words', async () => {
    await fc.assert(
      fc.asyncProperty(shortRequestArb, async (request) => {
        const result = await module.analyze(request);

        const hasDataGaps = result.dataGaps !== undefined && result.dataGaps.length >= 1;
        const hasNotificationSection = result.sections.some((s) => s.title === 'Input Too Short');

        expect(hasDataGaps || hasNotificationSection).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
