// Feature: hexagon-civic-literacy, Property 11: Scaffolded Output Structure
// Validates: Requirements 7.1, 7.3

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ScaffoldedUnderstandingLayer } from '../ScaffoldedUnderstandingLayer.js';
import type { RawAnalysis, AnalysisSection } from '../../types/index.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const sectionArb: fc.Arbitrary<AnalysisSection> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.string({ minLength: 1, maxLength: 200 }),
  contentType: fc.constantFrom(
    'fact',
    'inference',
    'opinion',
    'framework',
    'prompt',
  ) as fc.Arbitrary<'fact' | 'inference' | 'opinion' | 'framework' | 'prompt'>,
});

const rawAnalysisArb: fc.Arbitrary<RawAnalysis> = fc.record({
  moduleId: fc.oneof(
    fc.constantFrom('legislation', 'funding', 'debate', 'trackrecord', 'framing'),
    fc.string({ minLength: 1, maxLength: 30 }),
  ),
  sections: fc.array(sectionArb, { minLength: 0, maxLength: 5 }),
  frameworksApplied: fc.array(fc.string({ minLength: 1, maxLength: 40 }), {
    minLength: 0,
    maxLength: 4,
  }),
  factualClaims: fc.constant([]),
  perspectives: fc.constant([]),
  dataGaps: fc.constant(undefined),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 11: Scaffolded Output Structure', () => {
  const layer = new ScaffoldedUnderstandingLayer();

  /**
   * **Validates: Requirements 7.1, 7.3**
   *
   * For any module output, `ScaffoldedResponse` must have:
   * - a non-empty `frameworkLabel`
   * - at least one entry in `closingQuestions`
   * - each `closingQuestions` entry is non-empty
   */
  it('frameworkLabel is non-empty and closingQuestions has at least one non-empty entry', () => {
    fc.assert(
      fc.property(rawAnalysisArb, (analysis) => {
        const result = layer.apply(analysis);

        // frameworkLabel must be non-empty
        expect(result.frameworkLabel.length).toBeGreaterThan(0);

        // closingQuestions must have at least one entry
        expect(result.closingQuestions.length).toBeGreaterThanOrEqual(1);

        // each closingQuestions entry must be non-empty
        for (const question of result.closingQuestions) {
          expect(question.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});
