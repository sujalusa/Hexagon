// Feature: hexagon-portals, Property I: Voter Portal pipeline pass-through

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { expect } from 'vitest';
import { VoterPortal } from '../VoterPortal.js';
import { CensusClient } from '../../data/CensusClient.js';
import { FecClient } from '../../data/FecClient.js';
import type { Turn, FinalResponse } from '../../types/index.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const userInputArb = fc.oneof(
  fc.constantFrom(
    'What does HR-1234 do?',
    'Show me campaign finance data for candidate-001',
    'Analyze this debate: Senator A said taxes should be cut.',
    'Is this article about immigration biased?',
    'What is the voting record of politician-001?',
    'Tell me about the infrastructure bill.',
    'Who funded this campaign?',
    'What are the key provisions of this legislation?',
  ),
  fc.string({ minLength: 1, maxLength: 80 }),
);

const turnArb: fc.Arbitrary<Turn> = fc.record({
  role: fc.constantFrom('user' as const, 'assistant' as const),
  content: fc.string({ minLength: 1, maxLength: 200 }),
});

const historyArb: fc.Arbitrary<Turn[]> = fc.array(turnArb, { minLength: 0, maxLength: 4 });

// ─── Property I: Voter Portal Pipeline Pass-Through ───────────────────────────

describe('Property I: Voter Portal Pipeline Pass-Through', () => {
  /**
   * **Validates: Requirements 7.4**
   *
   * For any non-`scopeBoundaryMessage` response from VoterPortal.process,
   * the result must be a FinalResponse with:
   * - perspectivesVerified (boolean)
   * - perspectiveCount (number)
   * - scaffolded.frameworkLabel (string)
   * - scaffolded.closingQuestions (array)
   */
  it('non-scopeBoundaryMessage responses are FinalResponse with required fields', async () => {
    const censusClient = new CensusClient();
    const fecClient = new FecClient();
    const portal = new VoterPortal(censusClient, fecClient);

    await fc.assert(
      fc.asyncProperty(userInputArb, historyArb, async (userInput, history) => {
        const result = await portal.process(userInput, history);

        if ('scopeBoundaryMessage' in result) {
          // Guardrail blocked — skip structural assertions
          expect(typeof result.scopeBoundaryMessage).toBe('string');
          return;
        }

        const finalResponse = result as FinalResponse;

        // perspectivesVerified must be a boolean
        expect(typeof finalResponse.perspectivesVerified).toBe('boolean');

        // perspectiveCount must be a number
        expect(typeof finalResponse.perspectiveCount).toBe('number');

        // scaffolded must be present
        expect(finalResponse.scaffolded).toBeDefined();

        // scaffolded.frameworkLabel must be a non-empty string
        expect(typeof finalResponse.scaffolded.frameworkLabel).toBe('string');
        expect(finalResponse.scaffolded.frameworkLabel.length).toBeGreaterThan(0);

        // scaffolded.closingQuestions must be an array
        expect(Array.isArray(finalResponse.scaffolded.closingQuestions)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
