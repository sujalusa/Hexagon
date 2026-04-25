// Feature: hexagon-civic-literacy, Property 8: Track Record Structured Output
// Validates: Requirements 5.1, 5.2, 5.3, 5.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TrackRecordExplorerModule } from '../TrackRecordExplorerModule.js';
import type { RoutedRequest } from '../../types/index.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const validPoliticianIds = ['rep-001', 'sen-001'] as const;

const trackRecordRequestArb: fc.Arbitrary<RoutedRequest> = fc
  .constantFrom(...validPoliticianIds)
  .map(
    (entityId): RoutedRequest => ({
      moduleId: 'trackrecord',
      entityId,
      conversationHistory: [],
    }),
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 8: Track Record Structured Output', () => {
  const module = new TrackRecordExplorerModule();

  /**
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   *
   * For any valid track record request, the analysis output must:
   * 1. Have a "Voting Record" section with non-empty content
   * 2. Have a "Statement/Vote Divergences" section with non-empty content
   * 3. Have a "Pattern Identification" section whose content contains at least one '?'
   * 4. Have factualClaims.length >= 1
   * 5. Have perspectives.length >= 2
   */
  it('produces required structured output for valid politician IDs', async () => {
    await fc.assert(
      fc.asyncProperty(trackRecordRequestArb, async (request) => {
        const result = await module.analyze(request);

        // 1. "Voting Record" section exists with non-empty content
        const votingSection = result.sections.find((s) => s.title === 'Voting Record');
        expect(votingSection).toBeDefined();
        expect(votingSection!.content.length).toBeGreaterThan(0);

        // 2. "Statement/Vote Divergences" section exists with non-empty content
        const divergenceSection = result.sections.find(
          (s) => s.title === 'Statement/Vote Divergences',
        );
        expect(divergenceSection).toBeDefined();
        expect(divergenceSection!.content.length).toBeGreaterThan(0);

        // 3. "Pattern Identification" section exists and content contains at least one '?'
        const patternSection = result.sections.find((s) => s.title === 'Pattern Identification');
        expect(patternSection).toBeDefined();
        expect(patternSection!.content).toContain('?');

        // 4. factualClaims.length >= 1
        expect(result.factualClaims.length).toBeGreaterThanOrEqual(1);

        // 5. perspectives.length >= 2
        expect(result.perspectives.length).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 100 },
    );
  });
});
