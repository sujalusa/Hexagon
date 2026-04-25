// Feature: hexagon-civic-literacy, Property 2: Redirect to Framework
// Validates: Requirements 1.3, 7.2

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AgencyGuardrailEnforcer } from '../AgencyGuardrailEnforcer.js';
import type { RawAnalysis, AnalysisSection } from '../../types/index.js';

// ─── Recommendation / Judgment Phrases ───────────────────────────────────────

const RECOMMENDATION_PHRASES = [
  'you should support',
  'the right choice is',
  'I recommend',
  'vote for',
  'endorse',
  'you ought to',
];

// Patterns that indicate a recommendation or conclusory assertion
const RECOMMENDATION_PATTERNS = RECOMMENDATION_PHRASES.map((p) => new RegExp(p, 'i'));

function containsRecommendation(text: string): boolean {
  return RECOMMENDATION_PATTERNS.some((p) => p.test(text));
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const recommendationPhraseArb = fc.constantFrom(...RECOMMENDATION_PHRASES);

const recommendationSectionArb: fc.Arbitrary<AnalysisSection> = fc.record({
  title: fc.constantFrom('Summary', 'Conclusion', 'Analysis', 'Overview'),
  content: recommendationPhraseArb.map(
    (phrase) => `Based on the evidence, ${phrase} this policy position.`,
  ),
  contentType: fc.constant('opinion' as const),
});

const recommendationAnalysisArb: fc.Arbitrary<RawAnalysis> = fc.record({
  moduleId: fc.constantFrom('legislation', 'funding', 'debate', 'trackrecord', 'framing'),
  sections: fc
    .tuple(
      recommendationSectionArb,
      fc.array(
        fc.record({
          title: fc.constant('Background'),
          content: fc.constant('This is neutral background information.'),
          contentType: fc.constant('fact' as const),
        }),
        { minLength: 0, maxLength: 2 },
      ),
    )
    .map(([rec, rest]) => [rec, ...rest]),
  frameworksApplied: fc.constant([]),
  factualClaims: fc.constant([]),
  perspectives: fc.constant([]),
  dataGaps: fc.constant(undefined),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 2: Redirect to Framework', () => {
  const enforcer = new AgencyGuardrailEnforcer();

  it('scopeBoundaryMessage references an analytical framework', () => {
    /**
     * When a query contains recommendation/judgment language, the system must
     * redirect to an analytical framework rather than providing a direct answer.
     * Validates: Requirements 1.3, 7.2
     */
    fc.assert(
      fc.property(recommendationAnalysisArb, (analysis) => {
        const result = enforcer.enforce(analysis);

        // Tainted analysis must trigger the guardrail
        expect(result.passed).toBe(false);
        expect(result.scopeBoundaryMessage).toBeDefined();

        const msg = result.scopeBoundaryMessage!;

        // Property: message must reference an analytical framework
        const mentionsFramework = /analytical framework|framework/i.test(msg);
        expect(mentionsFramework).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('scopeBoundaryMessage contains at least one open-ended question', () => {
    /**
     * The redirect response must include at least one open-ended question
     * to guide the user toward self-directed inquiry.
     * Validates: Requirements 1.3, 7.2
     */
    fc.assert(
      fc.property(recommendationAnalysisArb, (analysis) => {
        const result = enforcer.enforce(analysis);

        expect(result.passed).toBe(false);
        expect(result.scopeBoundaryMessage).toBeDefined();

        const msg = result.scopeBoundaryMessage!;

        // Property: message must contain at least one question (sentence ending with '?')
        const hasQuestion = /\?/.test(msg);
        expect(hasQuestion).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('scopeBoundaryMessage does not contain recommendation or conclusory assertion', () => {
    /**
     * The redirect response itself must not contain recommendation language —
     * it should redirect without making the very judgment it refuses to make.
     * Validates: Requirements 1.3, 7.2
     */
    fc.assert(
      fc.property(recommendationAnalysisArb, (analysis) => {
        const result = enforcer.enforce(analysis);

        expect(result.passed).toBe(false);
        expect(result.scopeBoundaryMessage).toBeDefined();

        const msg = result.scopeBoundaryMessage!;

        // Property: the boundary message itself must not contain recommendation language
        const hasRecommendation = containsRecommendation(msg);
        expect(hasRecommendation).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
