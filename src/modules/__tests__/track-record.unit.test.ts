// Feature: hexagon-civic-literacy
// Validates: Requirements 5.6

import { describe, it, expect } from 'vitest';
import { TrackRecordExplorerModule } from '../TrackRecordExplorerModule.js';
import type { RoutedRequest } from '../../types/index.js';

describe('TrackRecordExplorerModule — comparison view availability', () => {
  const module = new TrackRecordExplorerModule();

  it('includes a "Comparison View" section when a second figure is specified', async () => {
    const request: RoutedRequest = {
      moduleId: 'trackrecord',
      entityId: 'rep-001',
      sourceText: 'compare with sen-001',
      conversationHistory: [],
    };

    const result = await module.analyze(request);

    const comparisonSection = result.sections.find((s) => s.title === 'Comparison View');
    expect(comparisonSection).toBeDefined();
    expect(comparisonSection!.content.length).toBeGreaterThan(0);
  });

  it('does NOT include a "Comparison View" section when no comparison text is provided', async () => {
    const request: RoutedRequest = {
      moduleId: 'trackrecord',
      entityId: 'rep-001',
      conversationHistory: [],
    };

    const result = await module.analyze(request);

    const comparisonSection = result.sections.find((s) => s.title === 'Comparison View');
    expect(comparisonSection).toBeUndefined();
  });

  it('does NOT include a "Comparison View" section when comparison ID is unknown', async () => {
    const request: RoutedRequest = {
      moduleId: 'trackrecord',
      entityId: 'rep-001',
      sourceText: 'compare with unknown-999',
      conversationHistory: [],
    };

    const result = await module.analyze(request);

    const comparisonSection = result.sections.find((s) => s.title === 'Comparison View');
    expect(comparisonSection).toBeUndefined();
  });
});
