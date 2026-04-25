import type { AnalysisSection, RawAnalysis, FactualClaim, Perspective, DataGap } from '../types/index.js';

const VALID_CONTENT_TYPES = ['fact', 'inference', 'opinion', 'framework', 'prompt'] as const;

export function validateAnalysisSections(sections: AnalysisSection[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const section of sections) {
    if (!VALID_CONTENT_TYPES.includes(section.contentType)) {
      errors.push(
        `Section "${section.title}" has invalid contentType "${section.contentType}". Must be one of: ${VALID_CONTENT_TYPES.join(', ')}.`
      );
    }
  }

  const hasFactOrInference = sections.some(
    (s) => s.contentType === 'fact' || s.contentType === 'inference'
  );

  if (!hasFactOrInference) {
    errors.push('At least one section must have contentType "fact" or "inference".');
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

export function buildRawAnalysis(params: {
  moduleId: string;
  sections: AnalysisSection[];
  frameworksApplied: string[];
  factualClaims: FactualClaim[];
  perspectives: Perspective[];
  dataGaps?: DataGap[];
}): RawAnalysis {
  const { valid, errors } = validateAnalysisSections(params.sections);

  if (!valid) {
    throw new Error(`Invalid analysis sections: ${errors.join(' ')}`);
  }

  return {
    moduleId: params.moduleId,
    sections: params.sections,
    frameworksApplied: params.frameworksApplied,
    factualClaims: params.factualClaims,
    perspectives: params.perspectives,
    dataGaps: params.dataGaps,
  };
}
