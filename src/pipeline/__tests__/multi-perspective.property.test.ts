// Feature: hexagon-civic-literacy, Property 13: Multi-Perspective Coverage and Balance
// Validates: Requirements 8.1, 8.2, 8.3, 2.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MultiPerspectiveLayer } from '../MultiPerspectiveLayer.js';
import type { ScaffoldedResponse, Perspective, RawAnalysis } from '../../types/index.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const nonEmptyString = fc.string({ minLength: 1, maxLength: 200 });

/**
 * Generate a list of ≥2 perspectives with distinct stakeholderGroup values
 * and balanced content (no content length exceeds twice any other's).
 * We achieve balance by generating a base length and constraining all content
 * lengths to [baseLen, baseLen * 2].
 */
const distinctPerspectivesArb: fc.Arbitrary<Perspective[]> = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 40 }), { minLength: 2, maxLength: 6 })
  .chain((groups) => {
    // Pick a base content length; all perspectives get content in [base, base*2]
    const baseLen = 10;
    return fc.tuple(
      ...groups.map((group) =>
        fc.record({
          stakeholderGroup: fc.constant(group),
          content: fc.string({ minLength: baseLen, maxLength: baseLen * 2 }),
          analyticalTradition: fc.option(nonEmptyString, { nil: undefined }),
        }),
      ),
    ).map((perspectives) => perspectives as Perspective[]);
  });

const rawAnalysisWithPerspectivesArb = (perspectivesArb: fc.Arbitrary<Perspective[]>): fc.Arbitrary<RawAnalysis> =>
  perspectivesArb.map((perspectives) => ({
    moduleId: 'debate',
    sections: [],
    frameworksApplied: ['Analytical Framework'],
    factualClaims: [],
    perspectives,
  }));

const scaffoldedResponseArb = (perspectivesArb: fc.Arbitrary<Perspective[]>): fc.Arbitrary<ScaffoldedResponse> =>
  rawAnalysisWithPerspectivesArb(perspectivesArb).map((analysis) => ({
    analysis,
    frameworkLabel: 'Analytical Framework',
    closingQuestions: ['What would you like to explore further?'],
  }));

/** Generate perspectives where all entries share the same stakeholderGroup (only 1 distinct) */
const singleGroupPerspectivesArb: fc.Arbitrary<Perspective[]> = fc
  .string({ minLength: 1, maxLength: 40 })
  .chain((group) =>
    fc.array(
      fc.record({
        stakeholderGroup: fc.constant(group),
        content: nonEmptyString,
        analyticalTradition: fc.option(nonEmptyString, { nil: undefined }),
      }),
      { minLength: 1, maxLength: 5 },
    ),
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 13: Multi-Perspective Coverage and Balance', () => {
  const layer = new MultiPerspectiveLayer();

  /**
   * **Validates: Requirements 8.1, 8.2, 8.3, 2.4**
   *
   * For any contested political topic analysis with ≥2 distinct stakeholder groups:
   * - `perspectivesVerified` is true
   * - `perspectiveCount` is ≥ 2
   * - Each perspective has non-empty `stakeholderGroup` and non-empty `content`
   * - No perspective's content length exceeds twice any other's (balance check)
   */
  it('verifies perspectives when ≥2 distinct stakeholder groups exist with balanced content', () => {
    fc.assert(
      fc.property(scaffoldedResponseArb(distinctPerspectivesArb), (scaffolded) => {
        const result = layer.apply(scaffolded);

        // perspectivesVerified must be true
        expect(result.perspectivesVerified).toBe(true);

        // perspectiveCount must be ≥ 2
        expect(result.perspectiveCount).toBeGreaterThanOrEqual(2);

        const perspectives = scaffolded.analysis.perspectives;

        // Each perspective must have non-empty stakeholderGroup and content
        for (const p of perspectives) {
          expect(p.stakeholderGroup.length).toBeGreaterThan(0);
          expect(p.content.length).toBeGreaterThan(0);
        }

        // Balance check: no perspective's content length exceeds twice any other's
        const lengths = perspectives.map((p) => p.content.length);
        const minLen = Math.min(...lengths);
        const maxLen = Math.max(...lengths);
        expect(maxLen).toBeLessThanOrEqual(minLen * 2);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.1**
   *
   * When only 1 distinct stakeholder group exists, `perspectivesVerified` must be false.
   */
  it('does not verify perspectives when only 1 distinct stakeholder group exists', () => {
    fc.assert(
      fc.property(scaffoldedResponseArb(singleGroupPerspectivesArb), (scaffolded) => {
        const result = layer.apply(scaffolded);

        expect(result.perspectivesVerified).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
