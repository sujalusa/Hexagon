import type { RawAnalysis, ScaffoldedResponse } from '../types/index.js';

const DEFAULT_FRAMEWORK_LABEL = 'Analytical Framework';

const CLOSING_QUESTIONS_BY_MODULE: Record<string, string[]> = {
  legislation: [
    'What aspects of this legislation would you like to explore further?',
    'How does this information change your understanding of the topic?',
    'What additional context would help you form your own assessment?',
  ],
  funding: [
    'What additional context about these funding patterns would help you form your own assessment?',
    'How does this information change your understanding of the topic?',
    'What aspects of this analysis would you like to explore further?',
  ],
  debate: [
    'Which arguments in this debate would you like to examine more closely?',
    'How does this analysis change your understanding of the positions presented?',
    'What additional context would help you evaluate these arguments?',
  ],
  trackrecord: [
    'What patterns in this record would you like to explore further?',
    'How does this information change your understanding of the topic?',
    'What additional context would help you form your own assessment?',
  ],
  framing: [
    'What aspects of this framing analysis would you like to explore further?',
    'How does identifying these patterns change your reading of the source text?',
    'What additional context would help you form your own assessment?',
  ],
};

const DEFAULT_CLOSING_QUESTIONS = [
  'What aspects of this analysis would you like to explore further?',
  'How does this information change your understanding of the topic?',
  'What additional context would help you form your own assessment?',
];

export class ScaffoldedUnderstandingLayer {
  apply(analysis: RawAnalysis): ScaffoldedResponse {
    const frameworkLabel =
      analysis.frameworksApplied[0]?.trim() || DEFAULT_FRAMEWORK_LABEL;

    const moduleQuestions =
      Object.hasOwn(CLOSING_QUESTIONS_BY_MODULE, analysis.moduleId)
        ? CLOSING_QUESTIONS_BY_MODULE[analysis.moduleId]
        : DEFAULT_CLOSING_QUESTIONS;

    const closingQuestions = [moduleQuestions[0] ?? DEFAULT_CLOSING_QUESTIONS[0]];

    const alternativeFrameworks =
      analysis.frameworksApplied.length > 1
        ? analysis.frameworksApplied.slice(1)
        : undefined;

    return {
      analysis,
      frameworkLabel,
      closingQuestions,
      alternativeFrameworks,
    };
  }
}
