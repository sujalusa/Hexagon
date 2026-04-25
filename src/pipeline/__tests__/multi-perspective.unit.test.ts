import { describe, it, expect } from 'vitest';
import { MultiPerspectiveLayer } from '../MultiPerspectiveLayer.js';
import type { ScaffoldedResponse } from '../../types/index.js';

function makeScaffolded(perspectives: { stakeholderGroup: string }[]): ScaffoldedResponse {
  return {
    analysis: {
      moduleId: 'debate',
      sections: [],
      frameworksApplied: [],
      factualClaims: [],
      perspectives: perspectives.map(p => ({
        stakeholderGroup: p.stakeholderGroup,
        content: 'some content',
      })),
    },
    frameworkLabel: 'test',
    closingQuestions: [],
  };
}

describe('MultiPerspectiveLayer', () => {
  const layer = new MultiPerspectiveLayer();

  it('one-sided request (single stakeholder group) returns perspectivesVerified: false and perspectiveCount: 1', () => {
    const input = makeScaffolded([
      { stakeholderGroup: 'Progressive' },
      { stakeholderGroup: 'Progressive' },
    ]);
    const result = layer.apply(input);
    expect(result.perspectivesVerified).toBe(false);
    expect(result.perspectiveCount).toBe(1);
  });

  it('two distinct perspectives returns perspectivesVerified: true and perspectiveCount: 2', () => {
    const input = makeScaffolded([
      { stakeholderGroup: 'Progressive' },
      { stakeholderGroup: 'Conservative' },
    ]);
    const result = layer.apply(input);
    expect(result.perspectivesVerified).toBe(true);
    expect(result.perspectiveCount).toBe(2);
  });

  it('empty perspectives returns perspectivesVerified: false and perspectiveCount: 0', () => {
    const input = makeScaffolded([]);
    const result = layer.apply(input);
    expect(result.perspectivesVerified).toBe(false);
    expect(result.perspectiveCount).toBe(0);
  });

  it('case-insensitive comparison treats "Progressive" and "progressive" as the same group', () => {
    const input = makeScaffolded([
      { stakeholderGroup: 'Progressive' },
      { stakeholderGroup: 'progressive' },
    ]);
    const result = layer.apply(input);
    expect(result.perspectivesVerified).toBe(false);
    expect(result.perspectiveCount).toBe(1);
  });
});
