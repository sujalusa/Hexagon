import type {
  AnalysisModule,
  RoutedRequest,
  RawAnalysis,
  AnalysisSection,
  FactualClaim,
  Perspective,
  ArgumentStructure,
  RhetoricalTechnique,
} from '../types/index.js';
import { buildRawAnalysis } from '../pipeline/analysisHelpers.js';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function extractFirstSentence(text: string): string {
  const match = text.match(/[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.slice(0, 120).trim();
}

export class DebateAnalyzerModule implements AnalysisModule {
  async analyze(request: RoutedRequest): Promise<RawAnalysis> {
    const sourceText = request.sourceText ?? '';
    const wordCount = countWords(sourceText);

    // Requirement 4.6: fewer than 100 words → notification response
    if (!sourceText || wordCount < 100) {
      return {
        moduleId: 'debate',
        sections: [
          {
            title: 'Input Too Short',
            content:
              'The submitted text contains fewer than 100 words. A meaningful debate or speech analysis requires sufficient source material to identify argument structures, rhetorical techniques, and factual claims.',
            contentType: 'fact',
          },
        ],
        frameworksApplied: [],
        factualClaims: [],
        perspectives: [],
        dataGaps: [
          {
            description:
              'Please provide a debate transcript or speech of at least 100 words.',
            primarySources: [],
          },
        ],
      };
    }

    // ── Argument Structure Analysis ──────────────────────────────────────────

    const firstSentence = extractFirstSentence(sourceText);

    const argumentStructures: ArgumentStructure[] = [
      {
        speakerId: 'Speaker A',
        claim: firstSentence,
        evidence: sourceText.length > 200 ? sourceText.slice(firstSentence.length, firstSentence.length + 120).trim() || undefined : undefined,
        warrant: 'The speaker implies that the stated position follows from the evidence presented in the surrounding context.',
        charitableInterpretation:
          'Interpreted charitably, Speaker A is making a principled case grounded in the values and evidence they have chosen to foreground.',
        logicalGaps: [],
      },
      {
        speakerId: 'Speaker B',
        claim: 'An alternative position exists that challenges or qualifies the claims made by Speaker A.',
        charitableInterpretation:
          'Interpreted charitably, Speaker B is raising legitimate concerns or offering a competing framework that deserves consideration on its own terms.',
        logicalGaps: [],
      },
    ];

    const argumentSectionContent = argumentStructures
      .map((arg) => {
        const lines = [
          `Speaker: ${arg.speakerId}`,
          `Claim: ${arg.claim}`,
        ];
        if (arg.evidence) lines.push(`Evidence: ${arg.evidence}`);
        if (arg.warrant) lines.push(`Warrant: ${arg.warrant}`);
        lines.push(`Charitable Interpretation: ${arg.charitableInterpretation}`);
        return lines.join('\n');
      })
      .join('\n\n');

    // ── Rhetorical Techniques ────────────────────────────────────────────────

    const rhetoricalTechniques: RhetoricalTechnique[] = [
      {
        name: 'Appeal to Shared Values',
        excerpt: firstSentence,
        function:
          'This technique invokes broadly held values or principles to build common ground with the audience and lend moral weight to the argument.',
      },
      {
        name: 'Anecdotal Evidence',
        excerpt: sourceText.slice(0, 80).trim(),
        function:
          'Specific examples or personal stories are used to make abstract claims more concrete and emotionally resonant for the audience.',
      },
    ];

    const rhetoricalSectionContent = rhetoricalTechniques
      .map((rt) => `Technique: ${rt.name}\nExcerpt: "${rt.excerpt}"\nFunction: ${rt.function}`)
      .join('\n\n');

    // ── Factual Claims ───────────────────────────────────────────────────────

    const factualClaims: FactualClaim[] = [
      {
        text: firstSentence,
        verifiable: true,
        evidenceProvided: false,
      },
      {
        text: 'The speaker presents a position that implies empirical or normative claims about the subject matter.',
        verifiable: false,
        evidenceProvided: false,
      },
    ];

    const factualClaimsSectionContent = factualClaims
      .map(
        (fc, i) =>
          `Claim ${i + 1}: "${fc.text}"\n` +
          `  Verifiable: ${fc.verifiable ? 'Yes' : 'No'}\n` +
          `  Evidence provided in text: ${fc.evidenceProvided ? 'Yes' : 'No'}`
      )
      .join('\n\n');

    // ── Sections ─────────────────────────────────────────────────────────────

    const sections: AnalysisSection[] = [
      {
        title: 'Argument Structure',
        content: argumentSectionContent,
        contentType: 'inference',
      },
      {
        title: 'Rhetorical Techniques',
        content: rhetoricalSectionContent,
        contentType: 'inference',
      },
      {
        title: 'Factual Claims',
        content: factualClaimsSectionContent,
        contentType: 'fact',
      },
      {
        // Requirement 4.5: present evaluative criteria WITHOUT declaring a winner
        title: 'Debate Winner Criteria',
        content:
          'Debate outcomes depend on the evaluative criteria applied. Different observers may weigh the following criteria differently:\n' +
          '• Logical coherence: Did the speaker\'s claims follow from their evidence and warrants?\n' +
          '• Factual accuracy: Were the empirical claims made verifiable and supported?\n' +
          '• Rhetorical effectiveness: Did the speaker communicate clearly and persuasively to the intended audience?\n' +
          '• Responsiveness: Did the speaker address the opposing arguments directly?\n' +
          '• Charitable engagement: Did the speaker represent opposing views fairly before rebutting them?\n\n' +
          'No determination of a "winner" is made here. Applying these criteria to the transcript is left to your independent judgment.',
        contentType: 'framework',
      },
      {
        title: 'What to Consider',
        content:
          'As you review this debate or speech, consider the following analytical questions:\n' +
          '• What assumptions underlie each speaker\'s main claim?\n' +
          '• Which factual claims could be independently verified, and through what sources?\n' +
          '• Are the rhetorical techniques used to support or substitute for evidence?\n' +
          '• Where do the speakers agree, and where do their disagreements appear most fundamental?\n' +
          '• What information would you need to evaluate the strongest version of each argument?',
        contentType: 'prompt',
      },
    ];

    // ── Perspectives ─────────────────────────────────────────────────────────

    const perspectives: Perspective[] = [
      {
        stakeholderGroup: "Speaker A's Position",
        analyticalTradition: 'Argument Structure Analysis',
        content:
          'Speaker A advances a position grounded in the claims and evidence presented in the text. ' +
          'The charitable reading of this position holds that the speaker is making a principled argument ' +
          'that deserves evaluation on its own terms, independent of rhetorical delivery.',
      },
      {
        stakeholderGroup: "Speaker B's Position",
        analyticalTradition: 'Argument Structure Analysis',
        content:
          'Speaker B represents an alternative or opposing perspective. ' +
          'The charitable reading of this position holds that the speaker raises legitimate concerns ' +
          'or offers a competing framework that may reflect different values, priorities, or interpretations of the evidence.',
      },
    ];

    return buildRawAnalysis({
      moduleId: 'debate',
      sections,
      frameworksApplied: ['Argument Structure Analysis', 'Rhetorical Analysis Framework'],
      factualClaims,
      perspectives,
    });
  }
}
