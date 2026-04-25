// Feature: hexagon-civic-literacy, Property 5: Finance Structured Output
// Validates: Requirements 3.1, 3.2, 3.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FundingLensModule } from '../FundingLensModule.js';
import type { RoutedRequest } from '../../types/index.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// Known entity IDs that return stub data from DataFetcher
const knownEntityIdArb = fc.constantFrom('candidate-001', 'pac-001');

// Generate a valid RoutedRequest for funding analysis
const validFundingRequestArb: fc.Arbitrary<RoutedRequest> = knownEntityIdArb.map(
  (entityId): RoutedRequest => ({
    moduleId: 'funding',
    entityId,
    conversationHistory: [],
  }),
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 5: Finance Structured Output', () => {
  const module = new FundingLensModule();

  /**
   * **Validates: Requirements 3.1, 3.2, 3.4**
   *
   * For any valid finance request, the analysis output must:
   * 1. Have a "Contributions Overview" section with non-empty content
   * 2. Have a "Benchmarks" section with non-empty content
   * 3. Have a "Legal Context" section with non-empty content
   * 4. Have at least one factualClaim
   * 5. Have perspectives.length >= 2
   */
  it('produces required structured sections and perspectives for valid finance input', async () => {
    await fc.assert(
      fc.asyncProperty(validFundingRequestArb, async (request) => {
        const result = await module.analyze(request);

        // Must not be a data-gap response — sections should be populated
        expect(result.sections.length).toBeGreaterThan(0);

        // 1. "Contributions Overview" section exists with non-empty content
        const contributionsSection = result.sections.find(
          (s) => s.title === 'Contributions Overview',
        );
        expect(contributionsSection).toBeDefined();
        expect(contributionsSection!.content.length).toBeGreaterThan(0);

        // 2. "Benchmarks" section exists with non-empty content
        const benchmarksSection = result.sections.find(
          (s) => s.title === 'Benchmarks',
        );
        expect(benchmarksSection).toBeDefined();
        expect(benchmarksSection!.content.length).toBeGreaterThan(0);

        // 3. "Legal Context" section exists with non-empty content
        const legalContextSection = result.sections.find(
          (s) => s.title === 'Legal Context',
        );
        expect(legalContextSection).toBeDefined();
        expect(legalContextSection!.content.length).toBeGreaterThan(0);

        // 4. factualClaims has at least one entry
        expect(result.factualClaims.length).toBeGreaterThanOrEqual(1);

        // 5. perspectives.length >= 2
        expect(result.perspectives.length).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 100 },
    );
  });
});
