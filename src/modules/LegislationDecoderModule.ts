import type { AnalysisModule, RoutedRequest, RawAnalysis, AnalysisSection, FactualClaim, Perspective } from '../types/index.js';
import { DataFetcher } from '../data/DataFetcher.js';
import { buildRawAnalysis } from '../pipeline/analysisHelpers.js';
import type { CensusClient } from '../data/CensusClient.js';

const LEGISLATIVE_KEYWORDS = ['SECTION', 'SEC.', 'Be it enacted', 'A BILL', 'WHEREAS', 'RESOLVED'];

const PROCEDURAL_STAGE_DESCRIPTIONS: Record<string, string> = {
  introduced: 'The bill has been formally introduced in a chamber but has not yet been assigned to committee.',
  committee_review: 'The bill is under review by a legislative committee, which may hold hearings, amend, or table it.',
  floor_vote: 'The bill has cleared committee and is scheduled or pending a vote by the full chamber.',
  passed_chamber: 'The bill has passed one chamber and is awaiting action in the other chamber.',
  conference: 'Both chambers have passed different versions; a conference committee is reconciling differences.',
  signed: 'The bill has been signed into law by the executive.',
  vetoed: 'The bill was passed by the legislature but rejected by the executive.',
};

function looksLegislative(text: string): boolean {
  return LEGISLATIVE_KEYWORDS.some((kw) => text.includes(kw));
}

export class LegislationDecoderModule implements AnalysisModule {
  private dataFetcher = new DataFetcher();

  constructor(private censusClient?: CensusClient) {}

  async analyze(request: RoutedRequest): Promise<RawAnalysis> {
    // 1. Try to fetch by entityId
    let record = null;
    if (request.entityId) {
      record = await this.dataFetcher.fetchLegislation(request.entityId);
    }

    // 2. Check if sourceText looks legislative
    const sourceText = request.sourceText ?? '';
    const textIsLegislative = looksLegislative(sourceText);

    // 3. If neither, return a DataGap response
    if (!record && !textIsLegislative) {
      return {
        moduleId: 'legislation',
        sections: [],
        frameworksApplied: [],
        factualClaims: [],
        perspectives: [],
        dataGaps: [
          {
            description:
              'The submitted input does not appear to be a recognizable legislative document. Please provide a valid bill identifier (e.g., "HR-1234") or paste the text of a legislative document containing standard legislative language.',
            primarySources: ['congress.gov', 'govtrack.us', 'legiscan.com'],
          },
        ],
      };
    }

    // 4. Build analysis from record or sourceText
    const sections: AnalysisSection[] = [];
    const factualClaims: FactualClaim[] = [];
    const perspectives: Perspective[] = [];

    if (record) {
      // Purpose section
      sections.push({
        title: 'Stated Purpose',
        content: record.statedPurpose,
        contentType: 'fact',
      });
      factualClaims.push({
        text: record.statedPurpose,
        verifiable: true,
        evidenceProvided: true,
        source: `Bill ${record.billId}: ${record.title}`,
      });

      // Key Provisions section
      const provisionsContent = record.keyProvisions
        .map((p) => `• ${p.summary} (Affected parties: ${p.affectedParties.join(', ')})`)
        .join('\n');
      sections.push({
        title: 'Key Provisions',
        content: provisionsContent,
        contentType: 'fact',
      });
      for (const provision of record.keyProvisions) {
        factualClaims.push({
          text: provision.summary,
          verifiable: true,
          evidenceProvided: true,
          source: `Provision ${provision.id}`,
        });
      }

      // Affected Parties section
      sections.push({
        title: 'Affected Parties',
        content: record.affectedParties.join(', '),
        contentType: 'fact',
      });

      // Procedural Stage section
      const stageDescription =
        PROCEDURAL_STAGE_DESCRIPTIONS[record.proceduralStage] ??
        'The current procedural stage is not described.';
      sections.push({
        title: 'Procedural Stage',
        content: `Current stage: ${record.proceduralStage.replace('_', ' ')}. ${stageDescription}`,
        contentType: 'fact',
      });

      // Glossary section
      if (record.glossaryTerms.length > 0) {
        const glossaryContent = record.glossaryTerms
          .map((g) => `${g.term}: ${g.definition}`)
          .join('\n');
        sections.push({
          title: 'Glossary',
          content: glossaryContent,
          contentType: 'framework',
        });
      }
    } else {
      // Parse from sourceText
      sections.push({
        title: 'Stated Purpose',
        content:
          'The stated purpose was extracted from the submitted legislative text. Review the preamble or "Be it enacted" clause for the bill\'s declared intent.',
        contentType: 'inference',
      });
      factualClaims.push({
        text: 'Legislative text submitted for analysis contains standard legislative markers.',
        verifiable: true,
        evidenceProvided: true,
      });

      sections.push({
        title: 'Key Provisions',
        content:
          'The submitted text contains legislative provisions. Review each numbered section or clause for specific mandates, authorizations, or prohibitions.',
        contentType: 'inference',
      });

      sections.push({
        title: 'Affected Parties',
        content:
          'Affected parties are identified within the text. Look for named entities, defined classes of persons, agencies, or jurisdictions referenced in the operative clauses.',
        contentType: 'inference',
      });

      sections.push({
        title: 'Procedural Stage',
        content:
          'The procedural stage could not be determined from the submitted text alone. Check the bill header or official legislative tracking sources for current status.',
        contentType: 'inference',
      });

      // Inline glossary for common legislative jargon found in text
      const glossaryEntries: string[] = [];
      if (sourceText.includes('WHEREAS')) {
        glossaryEntries.push('WHEREAS: A recital clause that states the background facts or reasons motivating the legislation.');
      }
      if (sourceText.includes('RESOLVED')) {
        glossaryEntries.push('RESOLVED: The operative clause in a resolution that states the formal decision or action being taken.');
      }
      if (sourceText.includes('Be it enacted')) {
        glossaryEntries.push('Be it enacted: The enacting clause that formally gives a bill the force of law upon passage.');
      }
      if (sourceText.includes('SECTION') || sourceText.includes('SEC.')) {
        glossaryEntries.push('SECTION / SEC.: A numbered subdivision of a bill that contains a distinct provision or set of related provisions.');
      }
      if (glossaryEntries.length > 0) {
        sections.push({
          title: 'Glossary',
          content: glossaryEntries.join('\n'),
          contentType: 'framework',
        });
      }
    }

    // "What to look for" section — always included
    sections.push({
      title: 'What to Look For',
      content:
        'As you read this legislation, consider the following questions:\n' +
        '• Who are the named beneficiaries of this bill?\n' +
        '• What enforcement mechanisms are specified, and who is responsible for enforcement?\n' +
        '• Are there sunset clauses or expiration dates on any provisions?\n' +
        '• What funding sources or appropriations are identified?\n' +
        '• Which agencies or levels of government are granted new authority?',
      contentType: 'prompt',
    });

    // Perspectives — at least 2 stakeholder viewpoints
    perspectives.push({
      stakeholderGroup: 'Proponents',
      analyticalTradition: 'Stakeholder Analysis Framework',
      content: record
        ? `Supporters of ${record.title} may argue that the bill addresses a documented public need, citing the stated purpose: "${record.statedPurpose}". They may point to the affected parties who stand to benefit and the provisions designed to achieve the bill's goals.`
        : 'Supporters of this legislation may argue that it addresses a documented public need as stated in the bill\'s preamble, and that the provisions create clear mandates or resources to achieve the stated goals.',
    });

    perspectives.push({
      stakeholderGroup: 'Critics',
      analyticalTradition: 'Stakeholder Analysis Framework',
      content: record
        ? `Critics of ${record.title} may raise concerns about implementation costs, the scope of authority granted to named agencies, or the adequacy of enforcement mechanisms. They may also question whether the affected parties most impacted had sufficient input into the bill's design.`
        : 'Critics of this legislation may raise concerns about implementation costs, the breadth of authority granted, unintended consequences for parties not explicitly named, or whether the enforcement mechanisms are sufficient to achieve the stated goals.',
    });

    return buildRawAnalysis({
      moduleId: 'legislation',
      sections,
      frameworksApplied: ['Stakeholder Analysis Framework'],
      factualClaims,
      perspectives,
    });
  }
}
