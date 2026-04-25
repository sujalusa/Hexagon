import type { Turn, RoutedRequest } from '../types/index.js';

type ModuleId = RoutedRequest['moduleId'];

const KEYWORDS: Record<ModuleId, string[]> = {
  legislation: [
    'bill', 'legislation', 'law', 'act', 'statute', 'congress', 'senate',
    'house', 'hr-', 's-', 'enacted', 'provision', 'amendment',
  ],
  funding: [
    'fund', 'donation', 'campaign finance', 'contribution', 'donor',
    'pac', 'money', 'raise', 'fundrais',
  ],
  debate: [
    'debate', 'speech', 'argument', 'rhetoric', 'transcript',
    'said', 'stated', 'claimed', 'speaker',
  ],
  trackrecord: [
    'voting record', 'track record', 'voted', 'vote history', 'politician',
    'senator', 'representative', 'congressman', 'congresswoman', 'rep.', 'sen.',
  ],
  framing: [
    'bias', 'framing', 'language', 'media', 'article', 'headline',
    'word choice', 'loaded', 'spin', 'narrative',
  ],
};

const BILL_ID_RE = /\b(HR|S|H\.R\.)-?\d+\b/i;
const ENTITY_ID_RE = /\b(rep|sen|candidate|pac)-\d+\b/i;

export class RequestRouter {
  route(userInput: string, history: Turn[]): RoutedRequest {
    const lower = userInput.toLowerCase();

    const moduleId = this._classify(lower);
    const entityId = this._extractEntityId(userInput);

    if (moduleId === null) {
      // Ambiguous — no keywords matched
      return {
        moduleId: 'legislation',
        sourceText: `Clarification needed: "${userInput}"`,
        conversationHistory: history,
      };
    }

    const result: RoutedRequest = {
      moduleId,
      conversationHistory: history,
    };

    if (entityId) {
      result.entityId = entityId;
    } else {
      result.sourceText = userInput;
    }

    return result;
  }

  private _classify(lower: string): ModuleId | null {
    for (const [id, keywords] of Object.entries(KEYWORDS) as [ModuleId, string[]][]) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return id;
      }
    }
    return null;
  }

  private _extractEntityId(input: string): string | undefined {
    const billMatch = input.match(BILL_ID_RE);
    if (billMatch) return billMatch[0];

    const entityMatch = input.match(ENTITY_ID_RE);
    if (entityMatch) return entityMatch[0];

    return undefined;
  }
}
