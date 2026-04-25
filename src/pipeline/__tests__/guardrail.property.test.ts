// Feature: hexagon-civic-literacy, Property 1: Guardrail Output Cleanliness
// Validates: Requirements 1.1, 1.2, 3.3, 4.4, 5.2, 6.2

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AgencyGuardrailEnforcer } from '../AgencyGuardrailEnforcer.js';
import type { RawAnalysis, AnalysisSection } from '../../types/index.js';

// ─── Prohibited Patterns ──────────────────────────────────────────────────────

const PROHIBITED_PATTERNS = [
  // Endorsement language
  /vote for/i,
  /endorse/i,
  /I recommend/i,
  /you should vote for/i,
  // Normative language
  /you should support/i,
  /the right choice is/i,
  /you ought to/i,
  /the best policy is/i,
  // Corruption characterizations
  /evidence of corruption/i,
  /bribed/i,
  /improper intent/i,
  /undue influence/i,
  /corrupt/i,
  /quid pro quo/i,
  // Debate winner declarations
  /won the debate/i,
  /clearly won/i,
  /dominated the debate/i,
  /debate winner/i,
  // Intentional bias labels
  /intentionally biased/i,
  /deliberately misleading/i,
  /propaganda/i,
  /intentional bias/i,
];

function containsProhibitedPattern(text: string): boolean {
  return PROHIBITED_PATTERNS.some((p) => p.test(text));
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const safeWordArb = fc.stringMatching(/^[a-zA-Z0-9 .,;:!?()-]{1,30}$/);

const safeSectionArb: fc.Arbitrary<AnalysisSection> = fc.record({
  title: fc.constantFrom(
    'Overview',
    'Key Provisions',
    'Stakeholder Impact',
    'Analytical Framework',
    'Follow-up Questions',
  ),
  content: fc.array(safeWordArb, { minLength: 1, maxLength: 5 }).map((words) => words.join(' ')),
  contentType: fc.constantFrom('fact', 'inference', 'opinion', 'framework', 'prompt') as fc.Arbitrary<
    'fact' | 'inference' | 'opinion' | 'framework' | 'prompt'
  >,
});

const safeRawAnalysisArb: fc.Arbitrary<RawAnalysis> = fc.record({
  moduleId: fc.constantFrom('legislation', 'funding', 'debate', 'trackrecord', 'framing'),
  sections: fc.array(safeSectionArb, { minLength: 1, maxLength: 4 }),
  frameworksApplied: fc.array(fc.constantFrom('Pluralist', 'Institutionalist', 'Critical'), {
    minLength: 0,
    maxLength: 2,
  }),
  factualClaims: fc.constant([]),
  perspectives: fc.constant([]),
  dataGaps: fc.constant(undefined),
});

// Prohibited phrases to inject for testing guardrail detection
const PROHIBITED_PHRASES = [
  'vote for',
  'endorse',
  'I recommend',
  'you should vote for',
  'you should support',
  'the right choice is',
  'you ought to',
  'the best policy is',
  'evidence of corruption',
  'bribed',
  'improper intent',
  'undue influence',
  'corrupt',
  'quid pro quo',
  'won the debate',
  'clearly won',
  'dominated the debate',
  'debate winner',
  'intentionally biased',
  'deliberately misleading',
  'propaganda',
  'intentional bias',
];

const prohibitedPhraseArb = fc.constantFrom(...PROHIBITED_PHRASES);

const taintedSectionArb: fc.Arbitrary<AnalysisSection> = fc.record({
  title: fc.constantFrom('Overview', 'Analysis', 'Summary'),
  content: prohibitedPhraseArb.map((phrase) => `This analysis shows that ${phrase} applies here.`),
  contentType: fc.constant('opinion' as const),
});

const taintedRawAnalysisArb: fc.Arbitrary<RawAnalysis> = fc.record({
  moduleId: fc.constantFrom('legislation', 'funding', 'debate', 'trackrecord', 'framing'),
  sections: fc
    .tuple(
      taintedSectionArb,
      fc.array(safeSectionArb, { minLength: 0, maxLength: 2 }),
    )
    .map(([tainted, safe]) => [tainted, ...safe]),
  frameworksApplied: fc.constant([]),
  factualClaims: fc.constant([]),
  perspectives: fc.constant([]),
  dataGaps: fc.constant(undefined),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 1: Guardrail Output Cleanliness', () => {
  const enforcer = new AgencyGuardrailEnforcer();

  it('if passed === true, sanitizedAnalysis sections contain no prohibited patterns', () => {
    fc.assert(
      fc.property(safeRawAnalysisArb, (analysis) => {
        const result = enforcer.enforce(analysis);

        if (result.passed === true) {
          expect(result.sanitizedAnalysis).toBeDefined();
          for (const section of result.sanitizedAnalysis!.sections) {
            const hasProhibited = containsProhibitedPattern(section.content);
            expect(hasProhibited).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('if passed === false, scopeBoundaryMessage is non-empty and violations.length > 0', () => {
    fc.assert(
      fc.property(taintedRawAnalysisArb, (analysis) => {
        const result = enforcer.enforce(analysis);

        if (result.passed === false) {
          expect(result.scopeBoundaryMessage).toBeDefined();
          expect(result.scopeBoundaryMessage!.length).toBeGreaterThan(0);
          expect(result.violations.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('tainted analysis with prohibited phrases always fails the guardrail', () => {
    fc.assert(
      fc.property(taintedRawAnalysisArb, (analysis) => {
        const result = enforcer.enforce(analysis);
        // Tainted analysis always has at least one prohibited phrase, so guardrail must catch it
        expect(result.passed).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.scopeBoundaryMessage).toBeDefined();
        expect(result.scopeBoundaryMessage!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
