import { describe, it, expect } from 'vitest';
import { AgencyGuardrailEnforcer } from '../AgencyGuardrailEnforcer.js';
import type { RawAnalysis } from '../../types/index.js';

// Validates: Requirements 1.5

function makeAnalysis(content: string): RawAnalysis {
  return {
    moduleId: 'test',
    sections: [{ title: 'Test Section', content, contentType: 'fact' }],
    frameworksApplied: [],
    factualClaims: [],
    perspectives: [],
  };
}

describe('AgencyGuardrailEnforcer – scope-boundary message', () => {
  const enforcer = new AgencyGuardrailEnforcer();

  it('endorsement query: "vote for [candidate]" returns passed:false with neutral reframing', () => {
    const analysis = makeAnalysis('You should vote for the incumbent candidate.');
    const result = enforcer.enforce(analysis);

    expect(result.passed).toBe(false);
    expect(result.scopeBoundaryMessage).toBeTruthy();
    expect(result.scopeBoundaryMessage).not.toMatch(/vote for/i);
    expect(result.scopeBoundaryMessage).toMatch(/neutral reframing/i);
  });

  it('normative language query: "the right choice is" returns passed:false with normative_language violation', () => {
    const analysis = makeAnalysis('The right choice is to support this policy.');
    const result = enforcer.enforce(analysis);

    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.violationType === 'normative_language')).toBe(true);
    expect(result.scopeBoundaryMessage).not.toMatch(/the right choice is/i);
  });

  it('corruption characterization: "evidence of corruption" returns passed:false with recommendation violation', () => {
    const analysis = makeAnalysis('There is clear evidence of corruption in this case.');
    const result = enforcer.enforce(analysis);

    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.violationType === 'recommendation')).toBe(true);
  });

  it('clean analysis: neutral content returns passed:true with no scopeBoundaryMessage', () => {
    const analysis = makeAnalysis('This bill proposes changes to infrastructure funding.');
    const result = enforcer.enforce(analysis);

    expect(result.passed).toBe(true);
    expect(result.sanitizedAnalysis).toEqual(analysis);
    expect(result.violations).toHaveLength(0);
    expect(result.scopeBoundaryMessage).toBeUndefined();
  });
});
