// Feature: hexagon-civic-literacy, Property 4: Legislation Structured Output
// Validates: Requirements 2.1, 2.2, 2.3, 2.5

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LegislationDecoderModule } from '../LegislationDecoderModule.js';
import type { RoutedRequest } from '../../types/index.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// Known bill IDs that return stub data from DataFetcher
const knownBillIdArb = fc.constantFrom('HR-1234', 'S-5678');

// Legislative keywords that trigger text-based analysis
const legislativeKeywordArb = fc.constantFrom(
  'SECTION',
  'SEC.',
  'Be it enacted',
  'A BILL',
  'WHEREAS',
  'RESOLVED',
);

// Generate a sourceText containing at least one legislative keyword
const legislativeSourceTextArb: fc.Arbitrary<string> = fc
  .tuple(
    legislativeKeywordArb,
    fc.string({ minLength: 10, maxLength: 100 }),
  )
  .map(([keyword, suffix]) => `${keyword} ${suffix}`);

// Generate a valid RoutedRequest — alternating between known bill IDs and legislative source texts
const validLegislativeRequestArb: fc.Arbitrary<RoutedRequest> = fc.oneof(
  // Path 1: known entityId (returns full stub record)
  knownBillIdArb.map(
    (billId): RoutedRequest => ({
      moduleId: 'legislation',
      entityId: billId,
      conversationHistory: [],
    }),
  ),
  // Path 2: legislative source text (triggers text-based analysis)
  legislativeSourceTextArb.map(
    (text): RoutedRequest => ({
      moduleId: 'legislation',
      sourceText: text,
      conversationHistory: [],
    }),
  ),
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 4: Legislation Structured Output', () => {
  const module = new LegislationDecoderModule();

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
   *
   * For any valid legislative input, the analysis output must:
   * 1. Have a "Stated Purpose" section with non-empty content
   * 2. Have a "Key Provisions" section with non-empty content
   * 3. Have an "Affected Parties" section with non-empty content
   * 4. Have a "Procedural Stage" section with non-empty content
   * 5. Have a "What to Look For" section whose content contains at least one '?'
   * 6. Have perspectives.length >= 2 with distinct stakeholderGroup values
   */
  it('produces required structured sections and perspectives for valid legislative input', async () => {
    await fc.assert(
      fc.asyncProperty(validLegislativeRequestArb, async (request) => {
        const result = await module.analyze(request);

        // Must not be a data-gap response — sections should be populated
        expect(result.sections.length).toBeGreaterThan(0);

        // 1. "Stated Purpose" section exists with non-empty content
        const statedPurposeSection = result.sections.find(
          (s) => s.title === 'Stated Purpose',
        );
        expect(statedPurposeSection).toBeDefined();
        expect(statedPurposeSection!.content.length).toBeGreaterThan(0);

        // 2. "Key Provisions" section exists with non-empty content
        const keyProvisionsSection = result.sections.find(
          (s) => s.title === 'Key Provisions',
        );
        expect(keyProvisionsSection).toBeDefined();
        expect(keyProvisionsSection!.content.length).toBeGreaterThan(0);

        // 3. "Affected Parties" section exists with non-empty content
        const affectedPartiesSection = result.sections.find(
          (s) => s.title === 'Affected Parties',
        );
        expect(affectedPartiesSection).toBeDefined();
        expect(affectedPartiesSection!.content.length).toBeGreaterThan(0);

        // 4. "Procedural Stage" section exists with non-empty content
        const proceduralStageSection = result.sections.find(
          (s) => s.title === 'Procedural Stage',
        );
        expect(proceduralStageSection).toBeDefined();
        expect(proceduralStageSection!.content.length).toBeGreaterThan(0);

        // 5. "What to Look For" section exists and contains at least one '?'
        const whatToLookForSection = result.sections.find(
          (s) => s.title === 'What to Look For',
        );
        expect(whatToLookForSection).toBeDefined();
        expect(whatToLookForSection!.content).toContain('?');

        // 6. perspectives.length >= 2 with distinct stakeholderGroup values
        expect(result.perspectives.length).toBeGreaterThanOrEqual(2);
        const stakeholderGroups = result.perspectives.map((p) => p.stakeholderGroup);
        const uniqueGroups = new Set(stakeholderGroups);
        expect(uniqueGroups.size).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 100 },
    );
  });
});
