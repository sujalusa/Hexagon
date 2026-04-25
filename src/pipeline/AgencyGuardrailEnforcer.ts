import type { RawAnalysis, GuardrailResult, GuardrailViolation } from '../types/index.js';

// ─── Prohibited Language Patterns ────────────────────────────────────────────

const PROHIBITED_PATTERNS: Array<{ pattern: RegExp; violationType: GuardrailViolation['violationType'] }> = [
  // Endorsements
  { pattern: /\byou should vote for\b/i, violationType: 'endorsement' },
  { pattern: /\bI recommend\b/i, violationType: 'endorsement' },
  { pattern: /\bsupport\s+\w+\s+candidate\b/i, violationType: 'endorsement' },
  { pattern: /\bvote for\b/i, violationType: 'endorsement' },
  { pattern: /\bendorse\b/i, violationType: 'endorsement' },

  // Normative / prescriptive language
  { pattern: /\byou should support\b/i, violationType: 'normative_language' },
  { pattern: /\bthe right choice is\b/i, violationType: 'normative_language' },
  { pattern: /\byou ought to\b/i, violationType: 'normative_language' },
  { pattern: /\bthe correct position is\b/i, violationType: 'normative_language' },
  { pattern: /\beveryone should\b/i, violationType: 'normative_language' },
  { pattern: /\bthe best policy is\b/i, violationType: 'normative_language' },

  // Corruption characterizations
  { pattern: /\bevidence of corruption\b/i, violationType: 'recommendation' },
  { pattern: /\bbribed\b/i, violationType: 'recommendation' },
  { pattern: /\bimproper intent\b/i, violationType: 'recommendation' },
  { pattern: /\bundue influence\b/i, violationType: 'recommendation' },
  { pattern: /\bcorrupt\b/i, violationType: 'recommendation' },
  { pattern: /\bquid pro quo\b/i, violationType: 'recommendation' },

  // Debate winner declarations
  { pattern: /\bwon the debate\b/i, violationType: 'normative_language' },
  { pattern: /\bclearly won\b/i, violationType: 'normative_language' },
  { pattern: /\bdominated the debate\b/i, violationType: 'normative_language' },
  { pattern: /\bdebate winner\b/i, violationType: 'normative_language' },
  { pattern: /\bperformed better in the debate\b/i, violationType: 'normative_language' },

  // Intentional bias labels
  { pattern: /\bintentionally biased\b/i, violationType: 'normative_language' },
  { pattern: /\bdeliberately misleading\b/i, violationType: 'normative_language' },
  { pattern: /\bpropaganda\b/i, violationType: 'normative_language' },
  { pattern: /\bintentional bias\b/i, violationType: 'normative_language' },
  { pattern: /\bdeliberate distortion\b/i, violationType: 'normative_language' },
];

// ─── Scope Boundary Message ───────────────────────────────────────────────────

function buildScopeBoundaryMessage(violations: GuardrailViolation[]): string {
  const sectionNames = [...new Set(violations.map(v => v.sectionTitle))].join(', ');

  return (
    `This question falls outside Hexagon's scope. Hexagon is designed to help you ` +
    `interpret and contextualize political information — not to advocate for positions, ` +
    `declare winners, or characterize intent. ` +
    `Prohibited language patterns were detected in the following section(s): ${sectionNames}. ` +
    `\n\nNeutral reframing: Instead of asking for a judgment or recommendation, consider ` +
    `using the Analytical_Framework to examine the relevant stakeholder perspectives and ` +
    `factual context so you can draw your own conclusions. ` +
    `What specific aspects of this topic would you like to explore through the analytical framework?`
  );
}

// ─── AgencyGuardrailEnforcer ──────────────────────────────────────────────────

export class AgencyGuardrailEnforcer {
  enforce(analysis: RawAnalysis): GuardrailResult {
    const violations: GuardrailViolation[] = [];

    for (const section of analysis.sections) {
      for (const { pattern, violationType } of PROHIBITED_PATTERNS) {
        const matches = section.content.match(new RegExp(pattern.source, 'gi'));
        if (matches) {
          for (const match of matches) {
            violations.push({
              sectionTitle: section.title,
              offendingText: match,
              violationType,
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      return {
        passed: false,
        violations,
        scopeBoundaryMessage: buildScopeBoundaryMessage(violations),
      };
    }

    return {
      passed: true,
      sanitizedAnalysis: analysis,
      violations: [],
    };
  }
}
