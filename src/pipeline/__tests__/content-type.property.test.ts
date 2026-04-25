// Feature: hexagon-civic-literacy, Property 3: Content Type Labeling
// Validates: Requirements 1.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildRawAnalysis, validateAnalysisSections } from '../analysisHelpers.js';
import type { AnalysisSection } from '../../types/index.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const VALID_CONTENT_TYPES = ['fact', 'inference', 'opinion', 'framework', 'prompt'] as const;
type ContentType = (typeof VALID_CONTENT_TYPES)[number];

const contentTypeArb = fc.constantFrom(...VALID_CONTENT_TYPES) as fc.Arbitrary<ContentType>;

const factOrInferenceArb = fc.constantFrom('fact', 'inference') as fc.Arbitrary<'fact' | 'inference'>;

const sectionArb = (contentType: fc.Arbitrary<ContentType>): fc.Arbitrary<AnalysisSection> =>
  fc.record({
    title: fc.string({ minLength: 1, maxLength: 30 }),
    content: fc.string({ minLength: 1, maxLength: 100 }),
    contentType,
  });

// Array of sections guaranteed to include at least one fact or inference
const validSectionsArb: fc.Arbitrary<AnalysisSection[]> = fc
  .tuple(
    sectionArb(factOrInferenceArb),
    fc.array(sectionArb(contentTypeArb), { minLength: 0, maxLength: 4 }),
  )
  .map(([required, rest]) => [required, ...rest]);

// Array of sections with NO fact or inference (only opinion/framework/prompt)
const noFactOrInferenceSectionsArb: fc.Arbitrary<AnalysisSection[]> = fc.array(
  sectionArb(fc.constantFrom('opinion', 'framework', 'prompt') as fc.Arbitrary<ContentType>),
  { minLength: 1, maxLength: 4 },
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 3: Content Type Labeling', () => {
  it('every section contentType is non-null and in the allowed set', () => {
    fc.assert(
      fc.property(validSectionsArb, (sections) => {
        const result = buildRawAnalysis({
          moduleId: 'legislation',
          sections,
          frameworksApplied: [],
          factualClaims: [],
          perspectives: [],
        });

        for (const section of result.sections) {
          expect(section.contentType).not.toBeNull();
          expect(section.contentType).not.toBeUndefined();
          expect(VALID_CONTENT_TYPES).toContain(section.contentType);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('the set of contentTypes present includes at least one fact or inference', () => {
    fc.assert(
      fc.property(validSectionsArb, (sections) => {
        const result = buildRawAnalysis({
          moduleId: 'legislation',
          sections,
          frameworksApplied: [],
          factualClaims: [],
          perspectives: [],
        });

        const hasFactOrInference = result.sections.some(
          (s) => s.contentType === 'fact' || s.contentType === 'inference',
        );
        expect(hasFactOrInference).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('buildRawAnalysis throws when sections contain no fact or inference', () => {
    fc.assert(
      fc.property(noFactOrInferenceSectionsArb, (sections) => {
        expect(() =>
          buildRawAnalysis({
            moduleId: 'legislation',
            sections,
            frameworksApplied: [],
            factualClaims: [],
            perspectives: [],
          }),
        ).toThrow();
      }),
      { numRuns: 100 },
    );
  });
});
