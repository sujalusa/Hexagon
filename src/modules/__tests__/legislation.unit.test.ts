// Feature: hexagon-civic-literacy
// Validates: Requirements 2.6

import { describe, it, expect } from 'vitest';
import { LegislationDecoderModule } from '../LegislationDecoderModule.js';
import type { RoutedRequest } from '../../types/index.js';

describe('LegislationDecoderModule — non-legislative input rejection', () => {
  const module = new LegislationDecoderModule();

  it('returns a DataGap for non-legislative text', async () => {
    const request: RoutedRequest = {
      moduleId: 'legislation',
      sourceText: 'The weather today is sunny and warm.',
      conversationHistory: [],
    };

    const result = await module.analyze(request);

    expect(result.dataGaps).toBeDefined();
    expect(result.dataGaps!.length).toBeGreaterThanOrEqual(1);
    expect(result.dataGaps![0].description.length).toBeGreaterThan(0);
    expect(result.dataGaps![0].primarySources.length).toBeGreaterThanOrEqual(1);
    expect(result.sections).toHaveLength(0);
  });

  it('returns a DataGap for an unknown bill ID with no source text', async () => {
    const request: RoutedRequest = {
      moduleId: 'legislation',
      entityId: 'UNKNOWN-999',
      conversationHistory: [],
    };

    const result = await module.analyze(request);

    expect(result.dataGaps).toBeDefined();
    expect(result.dataGaps!.length).toBeGreaterThanOrEqual(1);
  });

  it('returns a DataGap for an empty request', async () => {
    const request: RoutedRequest = {
      moduleId: 'legislation',
      conversationHistory: [],
    };

    const result = await module.analyze(request);

    expect(result.dataGaps).toBeDefined();
    expect(result.dataGaps!.length).toBeGreaterThanOrEqual(1);
  });
});
