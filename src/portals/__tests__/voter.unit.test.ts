import { describe, it, expect } from 'vitest';
import { VoterPortal } from '../VoterPortal.js';
import { CensusClient } from '../../data/CensusClient.js';
import { FecClient } from '../../data/FecClient.js';
import type { FinalResponse } from '../../types/index.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VoterPortal.process', () => {
  it('1. returns a FinalResponse or scopeBoundaryMessage for a known input', async () => {
    const portal = new VoterPortal(new CensusClient(), new FecClient());
    const result = await portal.process('What does HR-1234 do?', []);

    expect(result).toBeDefined();

    if ('scopeBoundaryMessage' in result) {
      expect(typeof result.scopeBoundaryMessage).toBe('string');
    } else {
      const finalResponse = result as FinalResponse;
      expect(typeof finalResponse.perspectivesVerified).toBe('boolean');
      expect(typeof finalResponse.perspectiveCount).toBe('number');
      expect(finalResponse.scaffolded).toBeDefined();
    }
  });

  it('2. legislation query returns a result with scaffolded.frameworkLabel present', async () => {
    const portal = new VoterPortal(new CensusClient(), new FecClient());
    const result = await portal.process(
      'Explain the key provisions of the infrastructure bill HR-5678',
      [],
    );

    expect(result).toBeDefined();

    if (!('scopeBoundaryMessage' in result)) {
      const finalResponse = result as FinalResponse;
      expect(finalResponse.scaffolded).toBeDefined();
      expect(typeof finalResponse.scaffolded.frameworkLabel).toBe('string');
      expect(finalResponse.scaffolded.frameworkLabel.length).toBeGreaterThan(0);
    }
  });
});
