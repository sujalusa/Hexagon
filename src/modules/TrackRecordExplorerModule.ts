import type {
  AnalysisModule,
  RoutedRequest,
  RawAnalysis,
  AnalysisSection,
  FactualClaim,
  Perspective,
  VoteEntry,
  VotingRecord,
} from '../types/index.js';
import { DataFetcher } from '../data/DataFetcher.js';
import { buildRawAnalysis } from '../pipeline/analysisHelpers.js';
import type { CensusClient } from '../data/CensusClient.js';

export class TrackRecordExplorerModule implements AnalysisModule {
  private dataFetcher = new DataFetcher();

  constructor(private censusClient?: CensusClient) {}

  async analyze(request: RoutedRequest): Promise<RawAnalysis> {
    const record = request.entityId
      ? await this.dataFetcher.fetchVotingRecord(request.entityId)
      : null;

    // Data unavailable — return bare RawAnalysis with dataGap
    if (!record) {
      return {
        moduleId: 'trackrecord',
        sections: [],
        frameworksApplied: [],
        factualClaims: [],
        perspectives: [],
        dataGaps: [this.dataFetcher.votingRecordDataGap()],
      };
    }

    const sections: AnalysisSection[] = [];
    const factualClaims: FactualClaim[] = [];
    const perspectives: Perspective[] = [];

    // ── Voting Record ─────────────────────────────────────────────────────────
    // Organize by policyArea, then date, then finalOutcome
    const byArea = new Map<string, VoteEntry[]>();
    for (const vote of record.votes) {
      const bucket = byArea.get(vote.policyArea) ?? [];
      bucket.push(vote);
      byArea.set(vote.policyArea, bucket);
    }

    const votingLines: string[] = [];
    for (const [area, votes] of byArea) {
      votingLines.push(`Policy Area: ${area}`);
      const sorted = [...votes].sort((a, b) => a.date.localeCompare(b.date));
      for (const v of sorted) {
        votingLines.push(
          `  • ${v.date} | ${v.billTitle} — Vote: ${v.vote.toUpperCase()} | Bill outcome: ${v.finalOutcome}`
        );
        votingLines.push(`    Purpose: ${v.billPurpose}`);
      }
    }

    sections.push({
      title: 'Voting Record',
      content: `Voting history for ${record.politicianName}:\n\n${votingLines.join('\n')}`,
      contentType: 'fact',
    });

    for (const v of record.votes) {
      factualClaims.push({
        text: `${record.politicianName} voted ${v.vote} on ${v.billTitle} (${v.billId}) on ${v.date}. The bill ${v.finalOutcome}.`,
        verifiable: true,
        evidenceProvided: true,
        source: 'Official congressional voting records',
      });
    }

    // ── Statement/Vote Divergences ────────────────────────────────────────────
    const divergenceLines: string[] = [];
    for (const vote of record.votes) {
      const relatedStatements = record.publicStatements.filter(
        (s) =>
          (s.relatedBillId && s.relatedBillId === vote.billId) ||
          s.topic === vote.policyArea
      );
      if (relatedStatements.length > 0) {
        divergenceLines.push(`Bill: ${vote.billTitle} (${vote.billId})`);
        divergenceLines.push(`  Vote cast: ${vote.vote.toUpperCase()} on ${vote.date}`);
        for (const stmt of relatedStatements) {
          divergenceLines.push(`  Public statement (${stmt.date}): "${stmt.text}"`);
        }
        divergenceLines.push('');
      }
    }

    const divergenceContent =
      divergenceLines.length > 0
        ? `The following entries show votes alongside related public statements for the same bill or policy area. Both are presented as recorded:\n\n${divergenceLines.join('\n')}`
        : 'No public statements were found that directly correspond to the votes in this record.';

    sections.push({
      title: 'Statement/Vote Divergences',
      content: divergenceContent,
      contentType: 'inference',
    });

    // ── Pattern Identification ─────────────────────────────────────────────────
    sections.push({
      title: 'Pattern Identification',
      content:
        'This analysis uses a Historical Pattern Analysis framework to help you observe trends over time. ' +
        'Rather than asserting conclusions, consider the following questions as you review the record:\n\n' +
        `• Do you notice any consistent alignment between ${record.politicianName}'s votes and a particular policy area?\n` +
        '• Are there policy areas where the vote and public statements appear to point in the same direction, and areas where they diverge?\n' +
        '• How does the final outcome of each bill relate to the vote cast — does the politician tend to vote with or against the majority?\n' +
        '• What patterns, if any, do you observe across the dates and policy areas represented here?',
      contentType: 'prompt',
    });

    // ── Comparison View (optional) ────────────────────────────────────────────
    const compareMatch = request.sourceText?.match(/compare with\s+([\w-]+)/i);
    if (compareMatch) {
      const compareId = compareMatch[1];
      const compareRecord: VotingRecord | null =
        await this.dataFetcher.fetchVotingRecord(compareId);

      if (compareRecord) {
        const compareLines: string[] = [];
        const compareByArea = new Map<string, VoteEntry[]>();
        for (const vote of compareRecord.votes) {
          const bucket = compareByArea.get(vote.policyArea) ?? [];
          bucket.push(vote);
          compareByArea.set(vote.policyArea, bucket);
        }
        for (const [area, votes] of compareByArea) {
          compareLines.push(`Policy Area: ${area}`);
          const sorted = [...votes].sort((a, b) => a.date.localeCompare(b.date));
          for (const v of sorted) {
            compareLines.push(
              `  • ${v.date} | ${v.billTitle} — Vote: ${v.vote.toUpperCase()} | Bill outcome: ${v.finalOutcome}`
            );
            compareLines.push(`    Purpose: ${v.billPurpose}`);
          }
        }

        sections.push({
          title: 'Comparison View',
          content:
            `Voting record for ${compareRecord.politicianName} (for comparison):\n\n` +
            compareLines.join('\n'),
          contentType: 'fact',
        });

        for (const v of compareRecord.votes) {
          factualClaims.push({
            text: `${compareRecord.politicianName} voted ${v.vote} on ${v.billTitle} (${v.billId}) on ${v.date}. The bill ${v.finalOutcome}.`,
            verifiable: true,
            evidenceProvided: true,
            source: 'Official congressional voting records',
          });
        }
      }
    }

    // ── Perspectives ──────────────────────────────────────────────────────────
    perspectives.push({
      stakeholderGroup: 'Constituent Accountability Advocates',
      analyticalTradition: 'Historical Pattern Analysis',
      content:
        'From a constituent accountability perspective, a voting record is the most direct evidence of how a representative exercises power on behalf of those they represent. ' +
        'Advocates in this tradition emphasize examining whether votes align with the stated priorities and needs of the politician\'s district or constituency, ' +
        'and whether public statements made before or after votes reflect the reasoning behind legislative choices. ' +
        'They would encourage reviewing the full record across policy areas rather than focusing on individual votes in isolation.',
    });

    perspectives.push({
      stakeholderGroup: 'Legislative Process Analysts',
      analyticalTradition: 'Historical Pattern Analysis',
      content:
        'Legislative process analysts note that individual votes are shaped by a complex set of institutional factors: party caucus dynamics, procedural rules, amendment structures, and strategic vote-trading. ' +
        'From this perspective, a single vote — or even a pattern of votes — may reflect procedural constraints or coalition-building rather than a politician\'s personal policy preferences. ' +
        'They would encourage examining the legislative context of each vote (including whether the bill passed, what amendments were attached, and what the political environment was at the time) before drawing conclusions about intent or consistency.',
    });

    return buildRawAnalysis({
      moduleId: 'trackrecord',
      sections,
      frameworksApplied: ['Historical Pattern Analysis'],
      factualClaims,
      perspectives,
    });
  }
}
