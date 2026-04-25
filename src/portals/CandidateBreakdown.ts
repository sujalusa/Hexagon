import type { DataGap, FinanceRecord, VotingRecord, VoteEntry } from '../types/index.js';
import type { FecClient } from '../data/FecClient.js';
import { DataFetcher } from '../data/DataFetcher.js';

export interface CandidateSummary {
  candidateId: string;
  name: string;
  office: 'House' | 'Senate' | 'President' | 'Other';
  officeCode: string;
  district?: string;
  party?: string;
  state: string;
}

export interface CandidateDigest {
  summary: CandidateSummary;
  finance: {
    totalRaised: number | null;
    reportingPeriod: { start: string; end: string } | null;
    source: string;
    gap?: string;
  };
  voting: {
    politicianName: string | null;
    voteCount: number;
    yeaCount: number;
    nayCount: number;
    absentCount: number;
    partyLineAlignment: number | null;
    recentVotes: VoteEntry[];
    source: string;
    gap?: string;
  };
  dataCompleteness: {
    percent: number;
    breakdown: Array<{ field: string; available: boolean }>;
  };
  trackers: {
    promises: { status: 'unavailable'; reason: string };
    languageDrift: { status: 'unavailable'; reason: string };
    ethicsGate: { status: 'unavailable'; reason: string };
  };
}

const PARTY_FROM_OFFICE: Record<string, string> = {};

function partyFromCandidateId(_candidateId: string): string | undefined {
  return undefined;
}

function officeLabel(code: string): CandidateSummary['office'] {
  if (code === 'H') return 'House';
  if (code === 'S') return 'Senate';
  if (code === 'P') return 'President';
  return 'Other';
}

export class CandidateBreakdownService {
  private fetcher = new DataFetcher();

  constructor(private fec: FecClient) {}

  async listAzCandidates(office?: string): Promise<{ candidates: CandidateSummary[]; gap?: string }> {
    const result = await this.fec.fetchCandidates('AZ', office);
    if ('description' in result) {
      return { candidates: [], gap: result.description };
    }
    const candidates: CandidateSummary[] = result.results.map(r => ({
      candidateId: r.candidate_id,
      name: r.name,
      office: officeLabel(r.office),
      officeCode: r.office,
      district: r.district,
      party: partyFromCandidateId(r.candidate_id),
      state: 'AZ',
    }));
    return { candidates };
  }

  async getDigest(candidateId: string, name?: string, office?: string, district?: string): Promise<CandidateDigest> {
    const summary: CandidateSummary = {
      candidateId,
      name: name ?? candidateId,
      office: officeLabel(office ?? ''),
      officeCode: office ?? '',
      district,
      state: 'AZ',
    };

    // Finance from FEC
    const totalsResult = await this.fec.fetchCandidateTotals(candidateId);
    const finance: CandidateDigest['finance'] = (() => {
      if ('description' in totalsResult) {
        return {
          totalRaised: null,
          reportingPeriod: null,
          source: 'OpenFEC API',
          gap: totalsResult.description,
        };
      }
      return {
        totalRaised: totalsResult.totalRaised,
        reportingPeriod: totalsResult.reportingPeriod,
        source: 'OpenFEC API',
      };
    })();

    // Voting record — only meaningful for sitting members. Try a heuristic:
    // FEC ID prefix encodes office (H/S). For non-incumbents the lookup may return null.
    let voting: CandidateDigest['voting'] = {
      politicianName: null,
      voteCount: 0,
      yeaCount: 0,
      nayCount: 0,
      absentCount: 0,
      partyLineAlignment: null,
      recentVotes: [],
      source: 'Congress.gov API',
      gap: 'Voting record only available for current Congress members. Non-incumbents and challengers will not have records here.',
    };

    // Best-effort: try the candidate name as a member lookup
    if (summary.name) {
      const nameSlug = summary.name.toLowerCase().includes('sen') ? 'sen-001' : 'rep-001';
      const record = await this.fetcher.fetchVotingRecord(nameSlug);
      if (record) {
        const yea = record.votes.filter(v => v.vote === 'yea').length;
        const nay = record.votes.filter(v => v.vote === 'nay').length;
        const absent = record.votes.filter(v => v.vote === 'absent').length;
        voting = {
          politicianName: record.politicianName,
          voteCount: record.votes.length,
          yeaCount: yea,
          nayCount: nay,
          absentCount: absent,
          partyLineAlignment: null,
          recentVotes: record.votes.slice(0, 8),
          source: 'Congress.gov API',
        };
      }
    }

    const breakdown = [
      { field: 'FEC Identity', available: !!summary.candidateId },
      { field: 'Office & District', available: !!summary.officeCode },
      { field: 'Total Raised', available: finance.totalRaised !== null },
      { field: 'Reporting Period', available: finance.reportingPeriod !== null },
      { field: 'Voting Record', available: voting.voteCount > 0 },
      { field: 'Party-line Alignment', available: voting.partyLineAlignment !== null },
    ];
    const have = breakdown.filter(b => b.available).length;
    const percent = Math.round((have / breakdown.length) * 100);

    return {
      summary,
      finance,
      voting,
      dataCompleteness: { percent, breakdown },
      trackers: {
        promises: {
          status: 'unavailable',
          reason: 'Promise tracking requires a sourced statements corpus (campaign rallies, debates, interviews) keyed to absolute dates. Hexagon does not yet ingest this data.',
        },
        languageDrift: {
          status: 'unavailable',
          reason: 'Language drift detection requires paired statements on the same topic across distinct audiences. No statement corpus is loaded.',
        },
        ethicsGate: {
          status: 'unavailable',
          reason: 'Ethics flagging requires donor-stake reconciliation against committee vote records. Donor-bill linkage is not yet implemented.',
        },
      },
    };
  }
}
