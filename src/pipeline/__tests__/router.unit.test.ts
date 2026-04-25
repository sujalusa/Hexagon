import { describe, it, expect } from 'vitest';
import { RequestRouter } from '../RequestRouter.js';

const router = new RequestRouter();
const history = [];

describe('RequestRouter', () => {
  it('routes legislation by bill ID (HR-1234)', () => {
    const result = router.route('What does HR-1234 do?', history);
    expect(result.moduleId).toBe('legislation');
    expect(result.entityId).toBe('HR-1234');
  });

  it('routes legislation by text keyword', () => {
    const result = router.route('Explain this bill about infrastructure', history);
    expect(result.moduleId).toBe('legislation');
  });

  it('routes funding with entity ID', () => {
    const result = router.route('Show me campaign finance data for candidate-001', history);
    expect(result.moduleId).toBe('funding');
    expect(result.entityId).toBe('candidate-001');
  });

  it('routes debate by keyword', () => {
    const result = router.route('Analyze this debate transcript', history);
    expect(result.moduleId).toBe('debate');
  });

  it('routes track record with entity ID', () => {
    const result = router.route('What is the voting record of rep-001?', history);
    expect(result.moduleId).toBe('trackrecord');
    expect(result.entityId).toBe('rep-001');
  });

  it('routes framing by keyword', () => {
    const result = router.route('Is this article biased?', history);
    expect(result.moduleId).toBe('framing');
  });

  it('returns clarification prompt for ambiguous input', () => {
    const result = router.route('Hello, what can you do?', history);
    expect(result.sourceText).toContain('Clarification needed');
  });

  it('extracts bill ID S-5678', () => {
    const result = router.route('Tell me about S-5678', history);
    expect(result.entityId).toBe('S-5678');
  });
});
