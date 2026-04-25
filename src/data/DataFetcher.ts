/**
 * DataFetcher — replaces all stubs with live Congress.gov API v3 calls.
 *
 * Required env var:
 *   CONGRESS_API_KEY — free key from https://api.congress.gov/sign-up
 *                      (same api.data.gov account as OPEN_FEC_API_KEY)
 *
 * Congress.gov API docs: https://github.com/LibraryOfCongress/api.congress.gov
 * Rate limit: 5,000 requests/hour
 */

import type {
  LegislationRecord,
  FinanceRecord,
  VotingRecord,
  DataGap,
  ProceduralStage,
  Provision,
  GlossaryEntry,
  VoteEntry,
} from '../types/index.js';

const CONGRESS_BASE = 'https://api.congress.gov/v3';
const TIMEOUT_MS = 10_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiKey(): string | null {
  return process.env.CONGRESS_API_KEY ?? null;
}

async function congressFetch(path: string): Promise<unknown | DataGap> {
  const key = apiKey();
  if (!key) {
    return {
      description:
        'Congress.gov API key is not set. Set CONGRESS_API_KEY in your environment. ' +
        'Register for a free key at https://api.congress.gov/sign-up',
      primarySources: ['api.congress.gov/sign-up'],
    } satisfies DataGap;
  }

  const url = `${CONGRESS_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${key}&format=json`;

  let response: Response;
  try {
    response = await globalThis.fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
    if (isAbort) {
      return { description: `Request timed out fetching ${CONGRESS_BASE}${path}`, primarySources: ['api.congress.gov'] } satisfies DataGap;
    }
    return { description: `Network error: ${err instanceof Error ? err.message : String(err)}`, primarySources: ['api.congress.gov'] } satisfies DataGap;
  }

  if (response.status === 404) return null as unknown; // not found — caller handles null
  if (response.status === 429) {
    return { description: 'Congress.gov API rate limit reached. Please retry after a minute.', primarySources: ['api.congress.gov'] } satisfies DataGap;
  }
  if (response.status < 200 || response.status > 299) {
    return { description: `HTTP ${response.status} from Congress.gov API`, primarySources: ['api.congress.gov'] } satisfies DataGap;
  }

  let rawBody: string;
  try { rawBody = await response.text(); } catch {
    return { description: 'Failed to read Congress.gov response body', primarySources: ['api.congress.gov'] } satisfies DataGap;
  }

  try { return JSON.parse(rawBody); } catch {
    return { description: `Failed to parse Congress.gov response: ${rawBody.slice(0, 200)}`, primarySources: ['api.congress.gov'] } satisfies DataGap;
  }
}

function isDataGap(v: unknown): v is DataGap {
  return v !== null && typeof v === 'object' && 'description' in (v as object);
}

/**
 * Parses a bill ID string like "HR-1234", "S-5678", "H.R.1234" into
 * { congress, type, number } for the Congress.gov API.
 * Defaults to the 118th Congress (2023–2025).
 */
function parseBillId(billId: string): { congress: number; type: string; number: string } | null {
  // Normalise: remove dots, spaces, dashes between type and number
  const clean = billId.toUpperCase().replace(/\./g, '').replace(/\s+/g, '');

  // Patterns: HR1234, S5678, HJRES12, SJRES34, HCONRES5, SCONRES5
  const match = clean.match(/^(HR|S|HJRES|SJRES|HCONRES|SCONRES|HRES|SRES)[-]?(\d+)(?:\/(\d+))?$/);
  if (!match) return null;

  const typeMap: Record<string, string> = {
    HR: 'hr', S: 's', HJRES: 'hjres', SJRES: 'sjres',
    HCONRES: 'hconres', SCONRES: 'sconres', HRES: 'hres', SRES: 'sres',
  };

  return {
    congress: match[3] ? parseInt(match[3]) : 118,
    type: typeMap[match[1]] ?? match[1].toLowerCase(),
    number: match[2],
  };
}

/**
 * Maps Congress.gov action codes / latest action text to ProceduralStage.
 */
function mapStage(latestAction: string): ProceduralStage {
  const a = latestAction.toLowerCase();
  if (a.includes('became public law') || a.includes('signed by president')) return 'signed';
  if (a.includes('vetoed')) return 'vetoed';
  if (a.includes('passed senate') || a.includes('passed house')) return 'passed_chamber';
  if (a.includes('conference')) return 'conference';
  if (a.includes('floor') || a.includes('vote')) return 'floor_vote';
  if (a.includes('committee') || a.includes('referred')) return 'committee_review';
  return 'introduced';
}

// ─── DataFetcher ──────────────────────────────────────────────────────────────

export class DataFetcher {

  // ── Legislation ─────────────────────────────────────────────────────────────

  async fetchLegislation(billId: string): Promise<LegislationRecord | null> {
    const parsed = parseBillId(billId);
    if (!parsed) return null;

    const { congress, type, number } = parsed;

    // Fetch bill details and summaries in parallel
    const [detailRaw, summaryRaw] = await Promise.all([
      congressFetch(`/bill/${congress}/${type}/${number}`),
      congressFetch(`/bill/${congress}/${type}/${number}/summaries`),
    ]);

    if (isDataGap(detailRaw)) return null;
    if (detailRaw === null) return null;

    const detail = (detailRaw as Record<string, unknown>).bill as Record<string, unknown> | undefined;
    if (!detail) return null;

    // Extract title
    const title = String(detail.title ?? detail.shortTitle ?? `${billId.toUpperCase()}`);

    // Extract stated purpose from summaries
    let statedPurpose = '';
    if (!isDataGap(summaryRaw) && summaryRaw !== null) {
      const summaries = (summaryRaw as Record<string, unknown>).summaries as unknown[];
      if (Array.isArray(summaries) && summaries.length > 0) {
        const latest = summaries[summaries.length - 1] as Record<string, unknown>;
        // Strip HTML tags from summary text
        const raw = String(latest.text ?? '');
        statedPurpose = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
      }
    }
    if (!statedPurpose) {
      statedPurpose = String(detail.title ?? 'Purpose not available from Congress.gov API.');
    }

    // Extract procedural stage from latest action
    const latestAction = detail.latestAction as Record<string, unknown> | undefined;
    const latestActionText = String(latestAction?.text ?? '');
    const proceduralStage = mapStage(latestActionText);

    // Extract sponsors as affected parties
    const sponsors = detail.sponsors as unknown[] | undefined;
    const sponsorNames: string[] = Array.isArray(sponsors)
      ? sponsors.map(s => {
          const sp = s as Record<string, unknown>;
          return `${sp.firstName ?? ''} ${sp.lastName ?? ''} (${sp.party ?? '?'}-${sp.state ?? '?'})`.trim();
        })
      : [];

    // Extract policy area
    const policyArea = (detail.policyArea as Record<string, unknown> | undefined)?.name as string | undefined;

    // Build key provisions from cosponsors count + committees
    const committees = detail.committees as Record<string, unknown> | undefined;
    const committeeCount = (committees?.count as number) ?? 0;

    const keyProvisions: Provision[] = [
      {
        id: `${billId}-P1`,
        summary: statedPurpose.slice(0, 200) || 'See full bill text on congress.gov.',
        affectedParties: policyArea ? [policyArea] : ['General public'],
      },
    ];
    if (committeeCount > 0) {
      keyProvisions.push({
        id: `${billId}-P2`,
        summary: `Referred to ${committeeCount} committee(s) for review.`,
        affectedParties: ['Congressional committees', 'Federal agencies'],
      });
    }

    // Glossary — common legislative terms
    const glossaryTerms: GlossaryEntry[] = [
      { term: 'Cloture', definition: 'A Senate procedure to end debate and bring a bill to a vote, requiring 60 votes.' },
      { term: 'Markup', definition: 'The committee process of amending and revising a bill before it is reported to the full chamber.' },
      { term: 'Engrossed bill', definition: 'The final version of a bill as passed by one chamber of Congress.' },
    ];

    const affectedParties = [
      ...(policyArea ? [policyArea + ' sector'] : []),
      ...sponsorNames.slice(0, 2),
      'Federal agencies',
      'General public',
    ];

    return {
      billId: billId.toUpperCase(),
      title,
      fullText: `Full text available at https://congress.gov/bill/${congress}th-congress/${type === 'hr' ? 'house-bill' : 'senate-bill'}/${number}`,
      statedPurpose,
      keyProvisions,
      affectedParties,
      proceduralStage,
      glossaryTerms,
    };
  }

  // ── Finance (delegates to FecClient via DataGap — real data via FecClient) ──

  async fetchFinanceData(entityId: string): Promise<FinanceRecord | null> {
    // Finance data is handled by FecClient when injected.
    // This fallback returns null so modules show a DataGap.
    return null;
  }

  // ── Voting Records ───────────────────────────────────────────────────────────

  /**
   * Accepts either a BioGuide ID (e.g. "A000370") or a search name (e.g. "rep-001").
   * For search names, first looks up the member by state (AZ) then fetches their votes.
   */
  async fetchVotingRecord(politicianId: string): Promise<VotingRecord | null> {
    // Resolve BioGuide ID
    let bioguideId = politicianId;
    let memberName = politicianId;

    // If it looks like a stub ID (rep-001, sen-001), search AZ members
    if (/^(rep|sen)-\d+$/i.test(politicianId)) {
      const chamber = politicianId.toLowerCase().startsWith('rep') ? 'house' : 'senate';
      const membersRaw = await congressFetch(`/member?state=AZ&chamber=${chamber}&limit=5&currentMember=true`);
      if (isDataGap(membersRaw) || membersRaw === null) return null;

      const members = (membersRaw as Record<string, unknown>).members as unknown[];
      if (!Array.isArray(members) || members.length === 0) return null;

      // Pick the first result
      const idx = parseInt(politicianId.replace(/\D/g, ''), 10) - 1;
      const member = (members[Math.min(idx, members.length - 1)] as Record<string, unknown>);
      bioguideId = String(member.bioguideId ?? '');
      const name = member.name as Record<string, unknown> | undefined;
      memberName = name
        ? `${name.first ?? ''} ${name.last ?? ''}`.trim()
        : String(member.directOrderName ?? bioguideId);
    }

    if (!bioguideId) return null;

    // Fetch member details and votes in parallel
    const [memberRaw, votesRaw] = await Promise.all([
      congressFetch(`/member/${bioguideId}`),
      congressFetch(`/member/${bioguideId}/votes?limit=20`),
    ]);

    if (isDataGap(memberRaw) || memberRaw === null) return null;

    // Extract member name from detail
    const memberDetail = (memberRaw as Record<string, unknown>).member as Record<string, unknown> | undefined;
    if (memberDetail) {
      const directName = memberDetail.directOrderName as string | undefined;
      const terms = memberDetail.terms as unknown[] | undefined;
      const latestTerm = Array.isArray(terms) ? terms[terms.length - 1] as Record<string, unknown> : undefined;
      const chamber = latestTerm?.chamber as string | undefined;
      const party = (memberDetail.partyHistory as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
      const partyCode = party?.partyAbbreviation as string | undefined;
      const state = memberDetail.state as string | undefined;
      if (directName) {
        const prefix = chamber?.toLowerCase().includes('senate') ? 'Sen.' : 'Rep.';
        memberName = `${prefix} ${directName}${partyCode && state ? ` (${partyCode}-${state})` : ''}`;
      }
    }

    // Parse votes
    const votes: VoteEntry[] = [];
    if (!isDataGap(votesRaw) && votesRaw !== null) {
      const voteList = (votesRaw as Record<string, unknown>).votes as unknown[];
      if (Array.isArray(voteList)) {
        for (const v of voteList.slice(0, 20)) {
          const vote = v as Record<string, unknown>;
          const bill = vote.bill as Record<string, unknown> | undefined;
          if (!bill) continue;

          const billNum = String(bill.number ?? '');
          const billType = String(bill.type ?? '').toLowerCase();
          const billCongress = String(bill.congress ?? '118');
          const billId = `${billType.toUpperCase()}-${billNum}`;

          const votePos = String(vote.votePosition ?? '').toLowerCase();
          const mappedVote: VoteEntry['vote'] =
            votePos === 'yes' || votePos === 'yea' ? 'yea' :
            votePos === 'no' || votePos === 'nay' ? 'nay' :
            votePos === 'not voting' || votePos === 'absent' ? 'absent' : 'abstain';

          votes.push({
            billId,
            billTitle: String(bill.title ?? billId),
            billPurpose: String(bill.title ?? 'See congress.gov for bill details.'),
            policyArea: String((bill.policyArea as Record<string, unknown> | undefined)?.name ?? 'General'),
            date: String(vote.date ?? '').slice(0, 10),
            vote: mappedVote,
            finalOutcome: 'passed', // Congress.gov member votes endpoint doesn't include final outcome
          });
        }
      }
    }

    return {
      politicianId: bioguideId,
      politicianName: memberName,
      votes,
      publicStatements: [], // Congress.gov API does not provide public statements
    };
  }

  // ── Member detail (term dates, committee codes) ─────────────────────────────

  async fetchMemberDetail(bioguideId: string): Promise<{
    bioguideId: string;
    fullName: string | null;
    party: string | null;
    state: string | null;
    chamber: string | null;
    termStart: string | null;
    termEnd: string | null;
  } | null> {
    const raw = await congressFetch(`/member/${bioguideId}`);
    if (isDataGap(raw) || raw === null) return null;
    const d = (raw as Record<string, unknown>).member as Record<string, unknown> | undefined;
    if (!d) return null;
    const terms = Array.isArray(d.terms) ? (d.terms as Array<Record<string, unknown>>) : [];
    const latest = terms[terms.length - 1];
    const partyHistory = Array.isArray(d.partyHistory) ? (d.partyHistory as Array<Record<string, unknown>>) : [];
    const party = (partyHistory[partyHistory.length - 1]?.partyAbbreviation as string | undefined) ?? null;
    return {
      bioguideId,
      fullName: (d.directOrderName as string | undefined) ?? null,
      party,
      state: (d.state as string | undefined) ?? null,
      chamber: (latest?.chamber as string | undefined) ?? null,
      termStart: latest?.startYear ? String(latest.startYear) : null,
      termEnd: latest?.endYear ? String(latest.endYear) : null,
    };
  }

  /**
   * Returns all current members of a chamber for a given state, with name + bioguide.
   * Uses /member/{state} which returns the active delegation. The `district` field
   * distinguishes House (numbered) from Senate (null).
   */
  async fetchStateDelegation(state: string, chamber: 'house' | 'senate'): Promise<Array<{ bioguideId: string; firstName: string; lastName: string; district: string | null; party: string | null }>> {
    const raw = await congressFetch(`/member/${state}?limit=50&currentMember=true`);
    if (isDataGap(raw) || raw === null) return [];
    const members = (raw as Record<string, unknown>).members as unknown[];
    if (!Array.isArray(members)) return [];

    const all = members.map((m) => {
      const member = m as Record<string, unknown>;
      const partyName = String(member.partyName ?? '').toUpperCase();
      const party = partyName.includes('REPUB') ? 'R' : partyName.includes('DEMOC') ? 'D' : partyName ? 'I' : null;
      // Format here is "Lastname, Firstname Middle"
      const nameStr = String(member.name ?? '');
      let lastName = '';
      let firstName = '';
      if (nameStr.includes(',')) {
        const [last, first] = nameStr.split(',').map(s => s.trim());
        lastName = last;
        firstName = (first.split(/\s+/)[0] ?? '');
      } else {
        const parts = nameStr.split(/\s+/);
        lastName = parts[parts.length - 1] ?? '';
        firstName = parts[0] ?? '';
      }
      const districtRaw = member.district;
      const district = districtRaw === null || districtRaw === undefined ? null : String(districtRaw);
      return {
        bioguideId: String(member.bioguideId ?? ''),
        firstName: firstName.toUpperCase(),
        lastName: lastName.toUpperCase().replace(/[.]/g, ''),
        district,
        party,
      };
    }).filter(m => m.bioguideId);

    // Senate members have null district; House members have numeric district.
    return all.filter(m => chamber === 'senate' ? m.district === null : m.district !== null);
  }

  /**
   * Resolves a stub ID (rep-001/sen-001) or BioGuide ID to a real BioGuide ID
   * by searching Arizona members. Returns null if no match.
   */
  async resolveBioguideId(politicianId: string): Promise<string | null> {
    if (!/^(rep|sen)-\d+$/i.test(politicianId)) {
      return politicianId; // assume already a BioGuide ID
    }
    const chamber = politicianId.toLowerCase().startsWith('rep') ? 'house' : 'senate';
    const raw = await congressFetch(`/member?state=AZ&chamber=${chamber}&limit=5&currentMember=true`);
    if (isDataGap(raw) || raw === null) return null;
    const members = (raw as Record<string, unknown>).members as unknown[];
    if (!Array.isArray(members) || members.length === 0) return null;
    const idx = parseInt(politicianId.replace(/\D/g, ''), 10) - 1;
    const member = members[Math.min(idx, members.length - 1)] as Record<string, unknown>;
    return (member.bioguideId as string | undefined) ?? null;
  }

  /**
   * Computes party-line alignment for a member. For each of their N most recent
   * roll-call votes, fetches the chamber-wide vote tally and counts whether the
   * member sided with their own party's majority. Returns null if not enough data.
   */
  async computePartyAlignment(bioguideId: string, sampleSize = 10): Promise<{
    alignmentPct: number;
    sampleSize: number;
    matched: number;
  } | null> {
    const votesRaw = await congressFetch(`/member/${bioguideId}/votes?limit=${sampleSize}`);
    if (isDataGap(votesRaw) || votesRaw === null) return null;

    const memberDetail = await this.fetchMemberDetail(bioguideId);
    const memberParty = memberDetail?.party;
    if (!memberParty) return null;

    const voteList = (votesRaw as Record<string, unknown>).votes as unknown[];
    if (!Array.isArray(voteList) || voteList.length === 0) return null;

    let matched = 0;
    let counted = 0;

    for (const v of voteList) {
      const vote = v as Record<string, unknown>;
      const memberPos = String(vote.votePosition ?? '').toLowerCase();
      if (memberPos !== 'yes' && memberPos !== 'no' && memberPos !== 'yea' && memberPos !== 'nay') continue;

      const congress = vote.congress;
      const chamber = String(vote.chamber ?? '').toLowerCase();
      const session = vote.sessionNumber;
      const rollNumber = vote.rollNumber;
      if (!congress || !session || !rollNumber || !chamber) continue;

      const chamberPath = chamber === 'senate' ? 'senate-vote' : 'house-vote';
      const detailRaw = await congressFetch(`/${chamberPath}/${congress}/${session}/${rollNumber}`);
      if (isDataGap(detailRaw) || detailRaw === null) continue;

      const detail = (detailRaw as Record<string, unknown>);
      const voteData = (detail.houseRollCallVote ?? detail.senateRollCallVote ?? detail.vote) as Record<string, unknown> | undefined;
      if (!voteData) continue;

      const partyTotals = voteData.partyVoteTotal ?? voteData.partyTotals ?? voteData.partyTotal;
      const partyArr = Array.isArray(partyTotals) ? (partyTotals as Array<Record<string, unknown>>) : [];
      const myParty = partyArr.find((p) => {
        const code = String(p.party ?? p.partyAbbreviation ?? '').toUpperCase();
        return code === memberParty.toUpperCase() || code.startsWith(memberParty.toUpperCase());
      });
      if (!myParty) continue;

      const yea = Number(myParty.yeaTotal ?? myParty.yea ?? 0);
      const nay = Number(myParty.nayTotal ?? myParty.nay ?? 0);
      const partyMajorityYes = yea >= nay;
      const memberYes = memberPos === 'yes' || memberPos === 'yea';

      counted += 1;
      if (memberYes === partyMajorityYes) matched += 1;
    }

    if (counted === 0) return null;
    return { alignmentPct: Math.round((matched / counted) * 100), sampleSize: counted, matched };
  }

  // ── DataGap helpers ──────────────────────────────────────────────────────────

  legislationDataGap(): DataGap {
    return {
      description: apiKey()
        ? 'Legislation data for the requested bill was not found on Congress.gov. Check the bill ID format (e.g. HR-1234, S-5678).'
        : 'CONGRESS_API_KEY is not set. Register at https://api.congress.gov/sign-up for a free key.',
      primarySources: ['api.congress.gov', 'congress.gov'],
    };
  }

  financeDataGap(): DataGap {
    return {
      description: 'Campaign finance data requires a FEC candidate ID and OPEN_FEC_API_KEY. Register at https://api.data.gov.',
      primarySources: ['api.open.fec.gov', 'fec.gov'],
    };
  }

  votingRecordDataGap(): DataGap {
    return {
      description: apiKey()
        ? 'Voting record not found. Use a BioGuide ID (e.g. A000370) or a stub ID (rep-001, sen-001) for Arizona members.'
        : 'CONGRESS_API_KEY is not set. Register at https://api.congress.gov/sign-up for a free key.',
      primarySources: ['api.congress.gov', 'congress.gov'],
    };
  }
}
