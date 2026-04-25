import type { AnalysisModule, RoutedRequest, RawAnalysis, AnalysisSection, FactualClaim, Perspective } from '../types/index.js';
import { DataFetcher } from '../data/DataFetcher.js';
import { buildRawAnalysis } from '../pipeline/analysisHelpers.js';
import type { FecClient } from '../data/FecClient.js';

export class FundingLensModule implements AnalysisModule {
  private dataFetcher = new DataFetcher();

  constructor(private fecClient?: FecClient) {}

  async analyze(request: RoutedRequest): Promise<RawAnalysis> {
    let record = null;
    const dataGapsFromFec: import('../types/index.js').DataGap[] = [];

    if (request.entityId) {
      if (this.fecClient) {
        const result = await this.fecClient.fetchCandidateTotals(request.entityId);
        if ('description' in result) {
          // FecClient returned a DataGap
          dataGapsFromFec.push(result);
        } else {
          record = result;
        }
      } else {
        record = await this.dataFetcher.fetchFinanceData(request.entityId);
      }
    }

    // Data unavailable — return bare RawAnalysis with dataGap
    if (!record) {
      return {
        moduleId: 'funding',
        sections: [],
        frameworksApplied: [],
        factualClaims: [],
        perspectives: [],
        dataGaps: dataGapsFromFec.length > 0 ? dataGapsFromFec : [this.dataFetcher.financeDataGap()],
      };
    }

    // Data unavailable — return bare RawAnalysis with dataGap
    if (!record) {
      return {
        moduleId: 'funding',
        sections: [],
        frameworksApplied: [],
        factualClaims: [],
        perspectives: [],
        dataGaps: [this.dataFetcher.financeDataGap()],
      };
    }

    const sections: AnalysisSection[] = [];
    const factualClaims: FactualClaim[] = [];
    const perspectives: Perspective[] = [];

    // ── Contributions Overview ────────────────────────────────────────────────
    const contributionLines = record.contributions.map((c) => {
      const donorPart = c.donorName ? ` (${c.donorName})` : '';
      return `• ${c.donorCategory}${donorPart}: $${c.amount.toLocaleString()} — reported ${c.date} [${c.disclosureStatus}]`;
    });
    contributionLines.push(`\nTotal raised (${record.reportingPeriod.start} – ${record.reportingPeriod.end}): $${record.totalRaised.toLocaleString()}`);

    sections.push({
      title: 'Contributions Overview',
      content: `Campaign finance data for ${record.entityName}:\n\n${contributionLines.join('\n')}`,
      contentType: 'fact',
    });

    factualClaims.push({
      text: `${record.entityName} raised $${record.totalRaised.toLocaleString()} between ${record.reportingPeriod.start} and ${record.reportingPeriod.end}.`,
      verifiable: true,
      evidenceProvided: true,
      source: 'FEC disclosure records',
    });

    for (const c of record.contributions) {
      factualClaims.push({
        text: `${c.donorCategory} contributions totaled $${c.amount.toLocaleString()} as of ${c.date}.`,
        verifiable: true,
        evidenceProvided: true,
        source: 'FEC disclosure records',
      });
    }

    // ── Benchmarks ────────────────────────────────────────────────────────────
    const benchmarkLines = record.benchmarks.map((b) => {
      const valueDisplay = b.value < 1 ? `${(b.value * 100).toFixed(1)}%` : `$${b.value.toLocaleString()}`;
      return `• ${b.label}: ${valueDisplay}\n  ${b.description}`;
    });

    sections.push({
      title: 'Benchmarks',
      content: `Contextual comparisons for proportional interpretation:\n\n${benchmarkLines.join('\n\n')}`,
      contentType: 'fact',
    });

    for (const b of record.benchmarks) {
      factualClaims.push({
        text: `${b.label}: ${b.value < 1 ? (b.value * 100).toFixed(1) + '%' : '$' + b.value.toLocaleString()}. ${b.description}`,
        verifiable: true,
        evidenceProvided: true,
        source: 'Comparative campaign finance data',
      });
    }

    // ── Legal Context ─────────────────────────────────────────────────────────
    sections.push({
      title: 'Legal Context',
      content: record.legalContext,
      contentType: 'fact',
    });

    factualClaims.push({
      text: record.legalContext,
      verifiable: true,
      evidenceProvided: true,
      source: 'Federal Election Commission regulations',
    });

    // ── Incentive Mapping Framework ───────────────────────────────────────────
    sections.push({
      title: 'Incentive Mapping Framework',
      content:
        'This analysis uses an Incentive Mapping Framework to help you think about donor relationships. ' +
        'The framework identifies three observable dimensions — without asserting conclusions about intent:\n\n' +
        '1. Alignment of Interests: Does the donor category (e.g., corporate, individual, PAC) have publicly stated policy preferences that overlap with the candidate\'s or entity\'s known positions?\n\n' +
        '2. Historical Voting Correlation: For incumbents, is there a documented pattern between donor categories and voting behavior on related legislation? (Correlation is not causation.)\n\n' +
        '3. Disclosure Status: Are contributions fully disclosed, partially disclosed, or undisclosed? Disclosure status affects what can be independently verified.\n\n' +
        'This framework surfaces observable data points. Drawing conclusions about motivation or influence requires additional evidence beyond contribution records alone.',
      contentType: 'framework',
    });

    // ── What to Consider ──────────────────────────────────────────────────────
    sections.push({
      title: 'What to Consider',
      content:
        'As you review this funding data, consider the following questions:\n' +
        '• How does the total raised compare to the benchmark for comparable races or entities?\n' +
        '• What proportion of funding comes from small-dollar donors versus large institutional sources?\n' +
        '• Are there donor categories whose policy interests are publicly known and relevant to this candidate or entity?\n' +
        '• What does the disclosure status of each contribution tell you about what can and cannot be independently verified?\n' +
        '• How do the legal contribution limits shape what you are seeing in this data?',
      contentType: 'prompt',
    });

    // ── Perspectives ──────────────────────────────────────────────────────────
    perspectives.push({
      stakeholderGroup: 'Campaign Finance Transparency Advocates',
      analyticalTradition: 'Incentive Mapping Framework',
      content:
        'Transparency advocates emphasize that public disclosure of contribution sources enables voters to identify potential conflicts of interest and hold elected officials accountable. ' +
        'From this perspective, the composition of a funding base — particularly the ratio of large institutional donors to small-dollar contributors — is a meaningful signal about whose interests a candidate may be structurally incentivized to prioritize. ' +
        'They would encourage examining whether donor categories with concentrated financial stakes in policy outcomes represent a disproportionate share of total fundraising.',
    });

    perspectives.push({
      stakeholderGroup: 'Campaign Finance Practitioners',
      analyticalTradition: 'Incentive Mapping Framework',
      content:
        'Campaign finance practitioners — including campaign managers, legal counsel, and political scientists who study electoral behavior — note that fundraising reflects a complex mix of factors: ideological alignment, geographic networks, professional associations, and organizational capacity. ' +
        'From this perspective, contribution data alone does not establish a causal link between donations and policy decisions. ' +
        'They would point out that legal contribution limits, disclosure requirements, and the competitive fundraising environment all shape the funding landscape in ways that are independent of any individual donor relationship.',
    });

    return buildRawAnalysis({
      moduleId: 'funding',
      sections,
      frameworksApplied: ['Incentive Mapping Framework'],
      factualClaims,
      perspectives,
    });
  }
}
