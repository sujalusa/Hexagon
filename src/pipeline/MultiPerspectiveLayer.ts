import type { ScaffoldedResponse, FinalResponse } from '../types/index.js';

export class MultiPerspectiveLayer {
  apply(scaffolded: ScaffoldedResponse): FinalResponse {
    const perspectives = scaffolded.analysis.perspectives;

    // Count distinct stakeholder groups (case-insensitive)
    const distinctGroups = new Set(
      perspectives.map(p => p.stakeholderGroup.toLowerCase())
    );
    const distinctCount = distinctGroups.size;

    // perspectivesVerified only when 2+ distinct stakeholder groups exist
    const perspectivesVerified = distinctCount >= 2;

    return {
      scaffolded,
      perspectivesVerified,
      perspectiveCount: distinctCount,
    };
  }
}
