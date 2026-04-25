import type {
  AnalysisModule,
  RoutedRequest,
  RawAnalysis,
  AnalysisSection,
  FactualClaim,
  Perspective,
  LoadedPhrase,
  StructuralChoice,
} from '../types/index.js';
import { buildRawAnalysis } from '../pipeline/analysisHelpers.js';

// ─── Loaded Phrase Dictionary ─────────────────────────────────────────────────

const LOADED_PHRASES: Array<{
  phrase: RegExp;
  connotativeWeight: string;
  framingEffect: string;
  neutralAlternative: string;
}> = [
  { phrase: /\btax relief\b/i, connotativeWeight: 'positive framing of tax reduction', framingEffect: 'Implies taxes are a burden that needs relief', neutralAlternative: 'tax reduction' },
  { phrase: /\btax burden\b/i, connotativeWeight: 'negative framing of taxation', framingEffect: 'Frames taxes as an oppressive weight', neutralAlternative: 'tax obligation' },
  { phrase: /\billegal alien\b/i, connotativeWeight: 'dehumanizing framing', framingEffect: 'Reduces a person to their legal status', neutralAlternative: 'undocumented immigrant' },
  { phrase: /\bundocumented immigrant\b/i, connotativeWeight: 'humanizing framing', framingEffect: 'Emphasizes the person over their legal status', neutralAlternative: 'person without legal immigration status' },
  { phrase: /\bpro-life\b/i, connotativeWeight: 'value-laden framing', framingEffect: 'Implies the opposing position is anti-life', neutralAlternative: 'anti-abortion' },
  { phrase: /\bpro-choice\b/i, connotativeWeight: 'value-laden framing', framingEffect: 'Implies the opposing position is anti-choice', neutralAlternative: 'abortion rights supporter' },
  { phrase: /\bclimate change\b/i, connotativeWeight: 'neutral scientific term', framingEffect: 'Describes the phenomenon without urgency framing', neutralAlternative: 'climate crisis (if urgency is intended)' },
  { phrase: /\bclimate crisis\b/i, connotativeWeight: 'urgency framing', framingEffect: 'Emphasizes severity and immediacy of the issue', neutralAlternative: 'climate change' },
  { phrase: /\bfake news\b/i, connotativeWeight: 'delegitimizing framing', framingEffect: 'Dismisses reporting without engaging with its content', neutralAlternative: 'disputed reporting' },
  { phrase: /\bmainstream media\b/i, connotativeWeight: 'skeptical framing', framingEffect: 'Implies institutional bias without specifying it', neutralAlternative: 'major news outlets' },
];

const PASSIVE_VOICE_REGEX = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/i;
const ALL_CAPS_REGEX = /\b[A-Z]{3,}\b/g;

// ─── Detection Helpers ────────────────────────────────────────────────────────

function detectLoadedPhrases(text: string): LoadedPhrase[] {
  const results: LoadedPhrase[] = [];
  for (const entry of LOADED_PHRASES) {
    const match = text.match(entry.phrase);
    if (match) {
      results.push({
        original: match[0],
        connotativeWeight: entry.connotativeWeight,
        framingEffect: entry.framingEffect,
        neutralAlternative: entry.neutralAlternative,
      });
    }
  }
  return results;
}

function detectStructuralChoices(text: string): StructuralChoice[] {
  const choices: StructuralChoice[] = [];

  // Passive voice
  if (PASSIVE_VOICE_REGEX.test(text)) {
    choices.push({
      type: 'passive_voice',
      description: 'The text contains passive voice constructions.',
      potentialEffect:
        'Passive voice can obscure agency — it may be unclear who is responsible for an action, which can reduce accountability framing.',
    });
  }

  // Emphasis: ALL CAPS words (3+ chars)
  const capsMatches = text.match(ALL_CAPS_REGEX);
  if (capsMatches && capsMatches.length > 0) {
    choices.push({
      type: 'emphasis',
      description: `The text uses ALL CAPS for emphasis: ${capsMatches.slice(0, 5).join(', ')}.`,
      potentialEffect:
        'Capitalization signals urgency or strong emotion, which can heighten the perceived importance of certain words over others.',
    });
  }

  // Emphasis: exclamation marks
  if (text.includes('!')) {
    choices.push({
      type: 'emphasis',
      description: 'The text uses exclamation marks.',
      potentialEffect:
        'Exclamation marks convey heightened emotion or urgency, which can amplify the emotional impact of surrounding claims.',
    });
  }

  // Ordering: negative framing at the start
  const firstWords = text.trimStart().slice(0, 80).toLowerCase();
  const negativeOpeners = ['never', 'no ', 'not ', 'fail', 'wrong', 'bad', 'danger', 'crisis', 'threat', 'attack'];
  if (negativeOpeners.some((w) => firstWords.startsWith(w) || firstWords.includes(` ${w}`))) {
    choices.push({
      type: 'ordering',
      description: 'The text opens with negative framing.',
      potentialEffect:
        'Leading with negative language sets a critical or alarming tone that can prime the reader to interpret subsequent information more negatively.',
    });
  }

  return choices;
}

// ─── Module ───────────────────────────────────────────────────────────────────

export class BiasFramingIndicatorModule implements AnalysisModule {
  async analyze(request: RoutedRequest): Promise<RawAnalysis> {
    // Requirement 6.1 / input validation
    if (!request.sourceText) {
      return {
        moduleId: 'framing',
        sections: [
          {
            title: 'No Source Text Provided',
            content:
              'No source text was submitted for framing analysis. Please provide a political text, article excerpt, or statement to analyze.',
            contentType: 'fact',
          },
        ],
        frameworksApplied: [],
        factualClaims: [],
        perspectives: [],
        dataGaps: [
          {
            description: 'A source text is required to perform framing analysis.',
            primarySources: [],
          },
        ],
      };
    }

    const sourceText = request.sourceText;
    const loadedPhrases = detectLoadedPhrases(sourceText);
    const structuralChoices = detectStructuralChoices(sourceText);

    // Requirement 6.6: no patterns found
    if (loadedPhrases.length === 0 && structuralChoices.length === 0) {
      return {
        moduleId: 'framing',
        sections: [
          {
            title: 'Framing Analysis Result',
            content: JSON.stringify({
              framingPatternsDetected: false,
              criteriaApplied: [
                'Loaded phrase detection (connotatively weighted political language)',
                'Passive voice detection',
                'Emphasis pattern detection (ALL CAPS, exclamation marks)',
                'Negative opening framing detection',
              ],
            }),
            contentType: 'fact',
          },
        ],
        frameworksApplied: ['Critical Discourse Analysis'],
        factualClaims: [],
        perspectives: [],
      };
    }

    // ── Loaded Language Section ───────────────────────────────────────────────

    const loadedLanguageContent =
      loadedPhrases.length > 0
        ? loadedPhrases
            .map(
              (lp) =>
                `Phrase: "${lp.original}"\n` +
                `  Connotative Weight: ${lp.connotativeWeight}\n` +
                `  Framing Effect: ${lp.framingEffect}\n` +
                `  Neutral Alternative: "${lp.neutralAlternative}"`
            )
            .join('\n\n')
        : 'No loaded phrases were detected in the submitted text.';

    // ── Structural Choices Section ────────────────────────────────────────────

    const structuralContent =
      structuralChoices.length > 0
        ? structuralChoices
            .map(
              (sc) =>
                `Type: ${sc.type}\n` +
                `  Description: ${sc.description}\n` +
                `  Potential Effect: ${sc.potentialEffect}`
            )
            .join('\n\n')
        : 'No notable structural choices were detected.';

    // ── Sections ──────────────────────────────────────────────────────────────

    const sections: AnalysisSection[] = [
      {
        title: 'Loaded Language Analysis',
        content: loadedLanguageContent,
        contentType: 'inference',
      },
      {
        title: 'Structural Choices',
        content: structuralContent,
        contentType: 'inference',
      },
      {
        title: 'Framing Spectrum',
        content:
          'Framing exists on a spectrum rather than as a binary "biased / unbiased" distinction. ' +
          'All language involves choices about what to foreground, what to omit, and how to characterize events. ' +
          'This analysis applies Critical Discourse Analysis to surface those choices — it does not conclude that ' +
          'the source is intentionally misleading or that any particular framing is inappropriate. ' +
          'The same event can be described accurately using language that carries different connotative weights.',
        contentType: 'framework',
      },
      {
        title: 'What to Consider',
        content:
          'As you evaluate this text, consider the following questions:\n' +
          '• What words or phrases carry emotional or political weight, and how might different readers respond to them?\n' +
          '• Are there neutral alternatives that convey the same factual content with less connotative loading?\n' +
          '• Does the structure of the text (what comes first, what is emphasized) shape how you interpret the information?\n' +
          '• What context or perspectives might be absent from this framing?\n' +
          '• How would the same information read if written from a different framing perspective?',
        contentType: 'prompt',
      },
    ];

    // ── Factual Claims ────────────────────────────────────────────────────────

    const factualClaims: FactualClaim[] = loadedPhrases.map((lp) => ({
      text: `The phrase "${lp.original}" appears in the source text.`,
      verifiable: true,
      evidenceProvided: true,
    }));

    // ── Perspectives ──────────────────────────────────────────────────────────

    const perspectives: Perspective[] = [
      {
        stakeholderGroup: 'Critical Discourse Analyst',
        analyticalTradition: 'Critical Discourse Analysis',
        content:
          'From a Critical Discourse Analysis perspective, language is never neutral — word choices reflect and reinforce ' +
          'social, political, and ideological positions. The loaded phrases and structural choices identified here are ' +
          'worth examining because they shape how readers construct meaning, even when the underlying facts are accurate.',
      },
      {
        stakeholderGroup: 'Communicator / Author Perspective',
        analyticalTradition: 'Rhetorical Communication',
        content:
          'From a rhetorical communication perspective, word choice is a legitimate tool for effective communication. ' +
          'Authors select language that resonates with their intended audience and conveys their intended emphasis. ' +
          'The presence of connotatively weighted language does not necessarily indicate an intent to mislead — ' +
          'it may reflect the author\'s genuine perspective or their audience\'s shared vocabulary.',
      },
    ];

    return buildRawAnalysis({
      moduleId: 'framing',
      sections,
      frameworksApplied: ['Critical Discourse Analysis'],
      factualClaims,
      perspectives,
    });
  }
}
