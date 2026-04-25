import type { DataGap, VoteEntry } from '../types/index.js';
import type { FecClient } from '../data/FecClient.js';
import { DataFetcher } from '../data/DataFetcher.js';

export interface CandidateSummary {
  candidateId: string;
  name: string;
  office: 'House' | 'Senate' | 'President' | 'Other';
  officeCode: string;
  district?: string;
  party?: string;
  partyFull?: string;
  incumbencyStatus?: string;
  state: string;
  termRange: string;
  committees: string[];
}

export interface PromiseEntry {
  id: string;
  quote: string;
  sourceLine: string;
  outcomeLine: string;
  status: 'kept' | 'broken' | 'partial' | 'pending';
}

export interface DriftPair {
  topic: string;
  a: { audience: string; quote: string; date: string };
  b: { audience: string; quote: string; date: string };
  divergenceNote: string;
}

export interface EthicsFlag {
  description: string;
}

export interface DonorBreakdown {
  totalRaised: number | null;
  cashOnHand: number | null;
  disbursements: number | null;
  debt: number | null;
  individualPct: number | null;
  pacPct: number | null;
  selfFundedPct: number | null;
  topEmployers: Array<{ employer: string; total: number; count: number }>;
  sizeBuckets: Array<{ sizeBucket: string; total: number }>;
  reportingPeriod: { start: string; end: string } | null;
  source: string;
  gaps: string[];
}

export interface CandidateDigest {
  summary: CandidateSummary;
  integrityScore: number;
  stats: {
    promisesTracked: number;
    kept: number;
    broken: number;
    partial: number;
    pending: number;
    keptPct: number;
    brokenPct: number;
    votesVsParty: number | null;
    votesVsPartyMeta: string;
  };
  promises: PromiseEntry[];
  promisesIsDemo: boolean;
  drifts: DriftPair[];
  driftsIsDemo: boolean;
  ethicsFlags: EthicsFlag[];
  ethicsIsDemo: boolean;
  donor: DonorBreakdown;
  voting: {
    politicianName: string | null;
    voteCount: number;
    yeaCount: number;
    nayCount: number;
    absentCount: number;
    recentVotes: VoteEntry[];
    source: string;
    gap?: string;
  };
}

// ─── Deterministic seed (used for demo data only) ────────────────────────────

function seedFrom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pickN<T>(items: T[], count: number, seed: number): T[] {
  const out: T[] = [];
  const used = new Set<number>();
  let s = seed;
  while (out.length < Math.min(count, items.length)) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const idx = s % items.length;
    if (!used.has(idx)) { used.add(idx); out.push(items[idx]); }
  }
  return out;
}

// ─── Demo templates (clearly labeled in UI) ──────────────────────────────────

const PROMISE_TEMPLATES: Array<{ quote: string; sourceLine: string; outcomeLine: string; status: PromiseEntry['status'] }> = [
  { quote: 'I will never vote to raise the debt ceiling without spending cuts attached.', sourceLine: 'Campaign rally · Phoenix, AZ · Aug 2022', outcomeLine: 'Voted YES on clean debt ceiling raise · Mar 2023 · No spending cuts attached', status: 'broken' },
  { quote: 'I will co-sponsor legislation to strengthen border fencing within my first year.', sourceLine: 'Debate · Tucson, AZ · Oct 2022', outcomeLine: 'Co-sponsored SB 412 Border Security Act · Feb 2023', status: 'kept' },
  { quote: 'We will cut federal agency budgets by 15% across the board in year one.', sourceLine: 'Town hall · Mesa, AZ · Sep 2022', outcomeLine: 'Supported 6.2% cut — less than half of promised amount', status: 'partial' },
  { quote: 'I will introduce a veterans mental health funding bill in this session.', sourceLine: 'Veterans forum · Flagstaff, AZ · Jan 2024', outcomeLine: '', status: 'pending' },
  { quote: 'I will oppose any tax increase on Arizona small businesses.', sourceLine: 'Chamber of Commerce · Scottsdale, AZ · Jun 2022', outcomeLine: 'Voted NO on HR 5376 small-business surtax provision · Aug 2022', status: 'kept' },
  { quote: 'My first bill will protect water rights for the Colorado River Basin.', sourceLine: 'Press conference · Yuma, AZ · Nov 2022', outcomeLine: 'No bill introduced as of Apr 2026 · Co-sponsored unrelated water study', status: 'broken' },
  { quote: 'I will hold a public town hall in every county within my first year.', sourceLine: 'Campaign launch · Phoenix, AZ · Mar 2022', outcomeLine: '11 of 15 counties visited · 4 counties not yet held', status: 'partial' },
  { quote: 'I will refuse all corporate PAC contributions throughout this campaign.', sourceLine: 'Candidate forum · Tempe, AZ · Apr 2022', outcomeLine: 'FEC filings show $0 from corporate PACs through Q4 2024', status: 'kept' },
  { quote: 'I will push for term limits on Congressional committee chairs.', sourceLine: 'Op-ed · Arizona Republic · Feb 2023', outcomeLine: '', status: 'pending' },
  { quote: 'I will sponsor legislation to lower prescription drug prices in year one.', sourceLine: 'Senior center · Sun City, AZ · Sep 2022', outcomeLine: 'Co-sponsored HR 2113 Insulin Cap Act · May 2023', status: 'kept' },
];

const DRIFT_TEMPLATES: DriftPair[] = [
  { topic: 'immigration', a: { audience: 'Fox News interview', quote: 'We need to secure the border completely and stop the invasion before we talk about anything else.', date: 'Mar 15, 2024' }, b: { audience: 'Hispanic Chamber of Commerce', quote: 'Immigration is complex and we need compassionate, comprehensive reform that respects families.', date: 'Mar 22, 2024' }, divergenceNote: 'Sentiment divergence detected on "immigration" — 7 days apart, opposite framing. 3 similar pairs found this term.' },
  { topic: 'climate', a: { audience: 'Energy industry roundtable', quote: 'Reckless green mandates are killing Arizona jobs and we need to push back on this radical agenda.', date: 'Feb 02, 2024' }, b: { audience: 'University of Arizona town hall', quote: 'Climate resilience is a generational priority — we owe future Arizonans clean air and water.', date: 'Feb 19, 2024' }, divergenceNote: 'Sentiment divergence detected on "climate" — 17 days apart, opposite framing. 2 similar pairs found this term.' },
  { topic: 'healthcare', a: { audience: 'Conservative PAC dinner', quote: 'Government-run healthcare is a disaster and we will repeal these mandates on day one.', date: 'Jan 10, 2024' }, b: { audience: 'Rural hospital association', quote: 'We must protect Medicaid expansion — too many Arizona families depend on it for survival.', date: 'Jan 24, 2024' }, divergenceNote: 'Sentiment divergence detected on "healthcare" — 14 days apart, opposite framing. 4 similar pairs found this term.' },
];

const ETHICS_TEMPLATES: string[] = [
  'Voted on 3 bills where a top-5 donor had direct financial stake — no recusal disclosed',
  'Public statements on healthcare differ from committee vote record in 4 of 6 instances this session',
  'Received $48,000 from defense contractor PACs within 60 days of casting deciding committee vote',
  'Co-sponsored legislation that exempts top donor industry from new disclosure rules',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function officeLabel(code: string): CandidateSummary['office'] {
  if (code === 'H') return 'House';
  if (code === 'S') return 'Senate';
  if (code === 'P') return 'President';
  return 'Other';
}

function num(val: unknown): number | null {
  if (typeof val === 'number' && isFinite(val)) return val;
  if (typeof val === 'string') { const n = Number(val); return isFinite(n) ? n : null; }
  return null;
}

function pct(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// ─── Last-name extraction + AZ member matcher ───────────────────────────────

function extractLastName(fecName: string): string {
  // FEC names are usually "LASTNAME, FIRSTNAME MIDDLE" — take the part before the comma.
  const trimmed = fecName.trim();
  if (!trimmed) return '';
  if (trimmed.includes(',')) return trimmed.split(',')[0].trim().toUpperCase();
  // Fallback: take the last whitespace-separated token
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
}

interface AzMemberCacheEntry { members: Array<{ bioguideId: string; lastName: string }>; cachedAt: number; }
const AZ_MEMBER_CACHE: Record<string, AzMemberCacheEntry> = {};
const AZ_MEMBER_TTL_MS = 60 * 60 * 1000;

async function findAzMemberBioguide(fetcher: DataFetcher, office: 'House' | 'Senate', lastName: string): Promise<string | null> {
  if (!lastName) return null;
  const chamber = office === 'Senate' ? 'senate' : 'house';
  const cached = AZ_MEMBER_CACHE[chamber];
  let delegation = cached && Date.now() - cached.cachedAt < AZ_MEMBER_TTL_MS ? cached.members : null;
  if (!delegation) {
    const fetched = await fetcher.fetchStateDelegation('AZ', chamber);
    delegation = fetched.map(m => ({ bioguideId: m.bioguideId, lastName: m.lastName }));
    AZ_MEMBER_CACHE[chamber] = { members: delegation, cachedAt: Date.now() };
  }
  const match = delegation.find(m => m.lastName === lastName);
  return match ? match.bioguideId : null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class CandidateBreakdownService {
  private fetcher = new DataFetcher();
  // Per-process cache for digests so re-opens are instant
  private digestCache = new Map<string, { data: CandidateDigest; cachedAt: number }>();
  private static DIGEST_TTL_MS = 15 * 60 * 1000;

  constructor(private fec: FecClient) {}

  async listAzCandidates(office?: string): Promise<{ candidates: CandidateSummary[]; gap?: string }> {
    const result = await this.fec.fetchCandidates('AZ', office);
    if ('description' in result) return { candidates: [], gap: result.description };

    const candidates: CandidateSummary[] = result.results.map(r => ({
      candidateId: r.candidate_id,
      name: r.name,
      office: officeLabel(r.office),
      officeCode: r.office,
      district: r.district,
      party: r.party,
      partyFull: r.party_full,
      incumbencyStatus: r.incumbent_challenge_full,
      state: 'AZ',
      termRange: '',
      committees: [],
    }));
    return { candidates };
  }

  async getDigest(candidateId: string, name?: string, office?: string, district?: string): Promise<CandidateDigest> {
    const cached = this.digestCache.get(candidateId);
    if (cached && Date.now() - cached.cachedAt < CandidateBreakdownService.DIGEST_TTL_MS) {
      return cached.data;
    }

    const seed = seedFrom(candidateId);
    const officeKind = officeLabel(office ?? '');

    // ── Fire all candidate-level fetches in parallel ──────────────────────
    const [detailRaw, totalsRaw, employersRes, sizesRes] = await Promise.all([
      this.fec.fetchCandidateDetail(candidateId),
      this.fec.fetchCandidateTotalsRaw(candidateId),
      this.fec.fetchTopEmployers(candidateId, 8),
      this.fec.fetchContributionSizes(candidateId),
    ]);

    // Real party from FEC
    const detail = (detailRaw && !('description' in detailRaw)) ? detailRaw : null;
    const realParty = (detail?.party as string | undefined) ?? undefined;
    const realPartyFull = (detail?.party_full as string | undefined) ?? undefined;
    const incumbencyStatus = (detail?.incumbent_challenge_full as string | undefined) ?? undefined;

    // ── Donor breakdown from real FEC data ────────────────────────────────
    const donorGaps: string[] = [];
    let totalRaised: number | null = null;
    let cashOnHand: number | null = null;
    let disbursements: number | null = null;
    let debt: number | null = null;
    let individualPct: number | null = null;
    let pacPct: number | null = null;
    let selfFundedPct: number | null = null;
    let reportingPeriod: { start: string; end: string } | null = null;

    if (totalsRaw && !('description' in totalsRaw)) {
      const t = totalsRaw;
      totalRaised = num(t.receipts);
      cashOnHand = num(t.cash_on_hand_end_period);
      disbursements = num(t.disbursements);
      debt = num(t.debts_owed_by_committee);
      const indiv = num(t.individual_contributions);
      const pac = num(t.other_political_committee_contributions);
      const selfFunded = num(t.candidate_contribution);
      individualPct = pct(indiv, totalRaised);
      pacPct = pct(pac, totalRaised);
      selfFundedPct = pct(selfFunded, totalRaised);
      const start = String(t.coverage_start_date ?? '').slice(0, 10);
      const end = String(t.coverage_end_date ?? '').slice(0, 10);
      if (start && end) reportingPeriod = { start, end };
    } else if (totalsRaw && 'description' in totalsRaw) {
      donorGaps.push(String(totalsRaw.description));
    }

    const topEmployers = Array.isArray(employersRes) ? employersRes : [];
    const sizeBuckets = Array.isArray(sizesRes) ? sizesRes : [];
    if (!Array.isArray(employersRes) && employersRes && 'description' in employersRes) donorGaps.push(`Employer breakdown: ${String(employersRes.description)}`);
    if (!Array.isArray(sizesRes) && sizesRes && 'description' in sizesRes) donorGaps.push(`Size buckets: ${String(sizesRes.description)}`);

    const donor: DonorBreakdown = {
      totalRaised, cashOnHand, disbursements, debt,
      individualPct, pacPct, selfFundedPct,
      topEmployers, sizeBuckets,
      reportingPeriod,
      source: 'OpenFEC API',
      gaps: donorGaps,
    };

    // ── Voting record + alignment + term dates (incumbents only) ─────────
    let voting: CandidateDigest['voting'] = {
      politicianName: null, voteCount: 0, yeaCount: 0, nayCount: 0, absentCount: 0,
      recentVotes: [], source: 'Congress.gov API',
      gap: 'Voting record only available for current Congress members.',
    };
    let votesVsParty: number | null = null;
    let votesVsPartyMeta = 'Not in office — no roll-call history';
    let termRange = '';
    let realCommittees: string[] = [];

    // Real voting/alignment lookup — only for confirmed incumbents whose last name
    // matches a current AZ delegation member. We do NOT guess for challengers.
    const isIncumbent = (incumbencyStatus ?? '').toLowerCase().includes('incumbent');
    if (isIncumbent && (officeKind === 'House' || officeKind === 'Senate') && (name || candidateId)) {
      const candidateLastName = extractLastName(name ?? '');
      const bioguide = await findAzMemberBioguide(this.fetcher, officeKind, candidateLastName);
      if (bioguide) {
        const [record, alignment, memberDetail] = await Promise.all([
          this.fetcher.fetchVotingRecord(bioguide),
          this.fetcher.computePartyAlignment(bioguide, 10),
          this.fetcher.fetchMemberDetail(bioguide),
        ]);
        if (record) {
          const yea = record.votes.filter(v => v.vote === 'yea').length;
          const nay = record.votes.filter(v => v.vote === 'nay').length;
          const absent = record.votes.filter(v => v.vote === 'absent').length;
          voting = {
            politicianName: record.politicianName,
            voteCount: record.votes.length,
            yeaCount: yea, nayCount: nay, absentCount: absent,
            recentVotes: record.votes.slice(0, 8),
            source: 'Congress.gov API',
          };
        }
        if (alignment) {
          votesVsParty = alignment.alignmentPct;
          votesVsPartyMeta = `over last ${alignment.sampleSize} roll-calls`;
        } else if (record && record.votes.length > 0) {
          votesVsPartyMeta = 'alignment computation unavailable';
        }
        if (memberDetail?.termStart && memberDetail.termEnd) {
          termRange = `Term ${memberDetail.termStart}–${memberDetail.termEnd}`;
        }
      } else {
        voting.gap = 'Could not match this incumbent to a current Congress.gov member record.';
      }
    } else if (!isIncumbent) {
      voting.gap = `${incumbencyStatus ?? 'Non-incumbent'} — no Congressional voting record.`;
    }

    // ── Compose summary ───────────────────────────────────────────────────
    const summary: CandidateSummary = {
      candidateId,
      name: name ?? candidateId,
      office: officeKind,
      officeCode: office ?? '',
      district,
      party: realParty,
      partyFull: realPartyFull,
      incumbencyStatus,
      state: 'AZ',
      termRange: termRange || (incumbencyStatus ? incumbencyStatus : ''),
      committees: realCommittees,  // empty for now — Congress.gov has no member->committee endpoint
    };

    // ── Demo trackers for promises / drifts / ethics ──────────────────────
    const promises = pickN(PROMISE_TEMPLATES, 4 + (seed % 2), seed).map((p, i) => ({
      id: `${candidateId}-P${i + 1}`,
      quote: p.quote, sourceLine: p.sourceLine, outcomeLine: p.outcomeLine, status: p.status,
    }));
    const drifts = pickN(DRIFT_TEMPLATES, 1 + (seed % 2), seed >> 7);
    const ethicsFlags = pickN(ETHICS_TEMPLATES, 2 + (seed % 2), seed >> 11).map(d => ({ description: d }));

    const promisesTracked = 28 + (seed % 18);
    const kept = 12 + (seed % 10);
    const broken = 4 + ((seed >> 3) % 8);
    const partial = 3 + ((seed >> 5) % 5);
    const pending = Math.max(0, promisesTracked - kept - broken - partial);
    const keptPct = Math.round((kept / promisesTracked) * 100);
    const brokenPct = Math.round((broken / promisesTracked) * 100);

    // Integrity blends real alignment (if we have it) with demo kept-rate
    const alignmentComponent = votesVsParty !== null ? Math.max(0, 100 - Math.abs(votesVsParty - 75)) : 60;
    const integrityScore = Math.max(35, Math.min(95, Math.round(keptPct * 0.6 + alignmentComponent * 0.4)));

    const digest: CandidateDigest = {
      summary,
      integrityScore,
      stats: { promisesTracked, kept, broken, partial, pending, keptPct, brokenPct, votesVsParty, votesVsPartyMeta },
      promises, promisesIsDemo: true,
      drifts, driftsIsDemo: true,
      ethicsFlags, ethicsIsDemo: true,
      donor,
      voting,
    };

    this.digestCache.set(candidateId, { data: digest, cachedAt: Date.now() });
    return digest;
  }
}
