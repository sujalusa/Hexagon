import type { CacheEntry, DataGap, FecCandidateList, FinanceRecord } from '../types/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const FEC_BASE_URL = 'https://api.open.fec.gov/v1';
const CACHE_TTL_MS = 900_000; // 15 minutes
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Parses a raw OpenFEC /candidates/ response into a FecCandidateList.
 * Returns DataGap if the structure is invalid or results is empty.
 */
export function parseFecCandidates(raw: unknown): FecCandidateList | DataGap {
  if (
    raw === null ||
    typeof raw !== 'object' ||
    !('results' in raw) ||
    !Array.isArray((raw as Record<string, unknown>).results)
  ) {
    return {
      description: 'Invalid FEC response: expected object with a results array',
      primarySources: ['api.open.fec.gov'],
    };
  }

  const results = (raw as Record<string, unknown>).results as unknown[];

  if (results.length === 0) {
    return {
      description: 'No FEC records found for the given query parameters',
      primarySources: ['api.open.fec.gov'],
    };
  }

  const mapped = results.map((item) => {
    const r = item as Record<string, unknown>;
    return {
      candidate_id: typeof r.candidate_id === 'string' ? r.candidate_id : '',
      name: typeof r.name === 'string' ? r.name : '',
      office: typeof r.office === 'string' ? r.office : '',
      ...(r.district !== undefined && r.district !== null
        ? { district: String(r.district) }
        : {}),
      ...(typeof r.party === 'string' ? { party: r.party } : {}),
      ...(typeof r.party_full === 'string' ? { party_full: r.party_full } : {}),
      ...(typeof r.incumbent_challenge_full === 'string' ? { incumbent_challenge_full: r.incumbent_challenge_full } : {}),
    };
  });

  const pagination =
    raw !== null &&
    typeof raw === 'object' &&
    'pagination' in raw &&
    raw.pagination !== null &&
    typeof raw.pagination === 'object' &&
    'count' in (raw.pagination as object)
      ? { count: Number((raw.pagination as Record<string, unknown>).count) }
      : { count: mapped.length };

  return { results: mapped, pagination };
}

/**
 * Parses a raw OpenFEC /candidate/{id}/totals/ response into a FinanceRecord.
 * Returns DataGap if results[0] is absent.
 */
export function parseFecTotals(raw: unknown): FinanceRecord | DataGap {
  if (
    raw === null ||
    typeof raw !== 'object' ||
    !('results' in raw) ||
    !Array.isArray((raw as Record<string, unknown>).results) ||
    (raw as Record<string, unknown[]>).results.length === 0
  ) {
    return {
      description: 'No FEC records found for the given query parameters',
      primarySources: ['api.open.fec.gov'],
    };
  }

  const r = ((raw as Record<string, unknown[]>).results[0]) as Record<string, unknown>;

  return {
    entityId: typeof r.candidate_id === 'string' ? r.candidate_id : '',
    entityName: typeof r.candidate_name === 'string' ? r.candidate_name : '',
    contributions: [],
    totalRaised: typeof r.receipts === 'number' ? r.receipts : 0,
    reportingPeriod: {
      start: typeof r.coverage_start_date === 'string' ? r.coverage_start_date : '',
      end: typeof r.coverage_end_date === 'string' ? r.coverage_end_date : '',
    },
    legalContext:
      'Data sourced from FEC OpenFEC API. Federal campaign finance law governs these disclosures.',
    benchmarks: [],
  };
}

// ─── FecClient ────────────────────────────────────────────────────────────────

export class FecClient {
  private cache = new Map<string, CacheEntry<FecCandidateList | FinanceRecord>>();

  /**
   * Shared HTTP fetch with caching, timeout, and error handling.
   */
  private async fetchUrl(url: string): Promise<unknown | DataGap> {
    const now = Date.now();
    const cached = this.cache.get(url);
    if (cached && now - new Date(cached.cachedAt).getTime() < cached.ttlMs) {
      return cached.data;
    }

    let response: Response;
    try {
      response = await globalThis.fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'TimeoutError');
      if (isAbort) {
        return {
          description: `Request timed out after 10 seconds fetching ${url}`,
          primarySources: [url],
        } satisfies DataGap;
      }
      return {
        description: `Network error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`,
        primarySources: [url],
      } satisfies DataGap;
    }

    if (response.status === 429) {
      return {
        description: 'OpenFEC API rate limit reached. Please retry after 60 seconds.',
        primarySources: ['api.open.fec.gov'],
      } satisfies DataGap;
    }

    if (response.status < 200 || response.status > 299) {
      return {
        description: `HTTP ${response.status} error fetching ${url}`,
        primarySources: [url],
      } satisfies DataGap;
    }

    let rawBody: string;
    try {
      rawBody = await response.text();
    } catch {
      return {
        description: `Failed to read response body from ${url}`,
        primarySources: [url],
      } satisfies DataGap;
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return {
        description: `Failed to parse API response from ${url}. Raw response (first 200 chars): ${rawBody.slice(0, 200)}`,
        primarySources: [url],
      } satisfies DataGap;
    }

    return json;
  }

  /**
   * Fetches Arizona candidates from the OpenFEC API.
   */
  async fetchCandidates(
    state: string,
    office?: string,
    district?: string,
  ): Promise<FecCandidateList | DataGap> {
    const key = process.env.OPEN_FEC_API_KEY;
    if (!key) {
      return {
        description:
          'FEC data unavailable: OPEN_FEC_API_KEY environment variable is not set. Register for a free API key at api.data.gov.',
        primarySources: ['api.data.gov', 'api.open.fec.gov'],
      };
    }

    // Default to most recent completed federal cycle so we get current incumbents/active candidates.
    let url = `${FEC_BASE_URL}/candidates/?state=${state}&cycle=2024&per_page=100&api_key=${key}`;
    if (office !== undefined) url += `&office=${office}`;
    if (district !== undefined) url += `&district=${district}`;

    const result = await this.fetchUrl(url);

    // If fetchUrl returned a DataGap
    if (result !== null && typeof result === 'object' && 'description' in result) {
      return result as DataGap;
    }

    const parsed = parseFecCandidates(result);
    if (!('description' in parsed)) {
      const cachedAt = new Date().toISOString();
      this.cache.set(url, { data: parsed, cachedAt, ttlMs: CACHE_TTL_MS });
    }
    return parsed;
  }

  /**
   * Fetches totals for a specific FEC candidate ID.
   */
  async fetchCandidateTotals(candidateId: string): Promise<FinanceRecord | DataGap> {
    const key = process.env.OPEN_FEC_API_KEY;
    if (!key) {
      return {
        description:
          'FEC data unavailable: OPEN_FEC_API_KEY environment variable is not set. Register for a free API key at api.data.gov.',
        primarySources: ['api.data.gov', 'api.open.fec.gov'],
      };
    }

    const url = `${FEC_BASE_URL}/candidate/${candidateId}/totals/?api_key=${key}`;

    const result = await this.fetchUrl(url);

    // If fetchUrl returned a DataGap
    if (result !== null && typeof result === 'object' && 'description' in result) {
      return result as DataGap;
    }

    const parsed = parseFecTotals(result);
    if (!('description' in parsed)) {
      const cachedAt = new Date().toISOString();
      this.cache.set(url, { data: parsed, cachedAt, ttlMs: CACHE_TTL_MS });
    }
    return parsed;
  }

  /**
   * Fetches the raw totals JSON. Exposes additional fields not in FinanceRecord.
   */
  async fetchCandidateTotalsRaw(candidateId: string): Promise<Record<string, unknown> | DataGap> {
    const key = process.env.OPEN_FEC_API_KEY;
    if (!key) return { description: 'OPEN_FEC_API_KEY not set', primarySources: ['api.open.fec.gov'] };
    const url = `${FEC_BASE_URL}/candidate/${candidateId}/totals/?api_key=${key}&sort=-cycle&per_page=1`;
    const result = await this.fetchUrl(url);
    if (result !== null && typeof result === 'object' && 'description' in result) return result as DataGap;
    const r = result as Record<string, unknown>;
    const arr = Array.isArray(r?.results) ? (r.results as unknown[]) : [];
    if (arr.length === 0) return { description: 'No totals reported for this candidate', primarySources: ['api.open.fec.gov'] };
    return arr[0] as Record<string, unknown>;
  }

  /**
   * Fetches the raw candidate detail JSON (party, incumbent_challenge, election_years…).
   */
  async fetchCandidateDetail(candidateId: string): Promise<Record<string, unknown> | DataGap> {
    const key = process.env.OPEN_FEC_API_KEY;
    if (!key) return { description: 'OPEN_FEC_API_KEY not set', primarySources: ['api.open.fec.gov'] };
    const url = `${FEC_BASE_URL}/candidate/${candidateId}/?api_key=${key}`;
    const result = await this.fetchUrl(url);
    if (result !== null && typeof result === 'object' && 'description' in result) return result as DataGap;
    const r = result as Record<string, unknown>;
    const arr = Array.isArray(r?.results) ? (r.results as unknown[]) : [];
    if (arr.length === 0) return { description: 'Candidate detail not found', primarySources: ['api.open.fec.gov'] };
    return arr[0] as Record<string, unknown>;
  }

  /**
   * Top contributing employers for a candidate (Schedule A, by_employer).
   * Returns top N by aggregated contribution amount.
   */
  async fetchTopEmployers(candidateId: string, limit = 8): Promise<Array<{ employer: string; total: number; count: number }> | DataGap> {
    const key = process.env.OPEN_FEC_API_KEY;
    if (!key) return { description: 'OPEN_FEC_API_KEY not set', primarySources: ['api.open.fec.gov'] };
    const url = `${FEC_BASE_URL}/schedules/schedule_a/by_employer/?candidate_id=${candidateId}&per_page=${limit}&sort=-total&api_key=${key}`;
    const result = await this.fetchUrl(url);
    if (result !== null && typeof result === 'object' && 'description' in result) return result as DataGap;
    const r = result as Record<string, unknown>;
    const arr = Array.isArray(r?.results) ? (r.results as unknown[]) : [];
    return arr.map((row) => {
      const x = row as Record<string, unknown>;
      return {
        employer: String(x.employer ?? '(not disclosed)'),
        total: typeof x.total === 'number' ? x.total : 0,
        count: typeof x.count === 'number' ? x.count : 0,
      };
    });
  }

  /**
   * Contribution size buckets (Schedule A, by_size). Useful for individual vs whale donor split.
   */
  async fetchContributionSizes(candidateId: string): Promise<Array<{ sizeBucket: string; total: number }> | DataGap> {
    const key = process.env.OPEN_FEC_API_KEY;
    if (!key) return { description: 'OPEN_FEC_API_KEY not set', primarySources: ['api.open.fec.gov'] };
    const url = `${FEC_BASE_URL}/schedules/schedule_a/by_size/?candidate_id=${candidateId}&api_key=${key}`;
    const result = await this.fetchUrl(url);
    if (result !== null && typeof result === 'object' && 'description' in result) return result as DataGap;
    const r = result as Record<string, unknown>;
    const arr = Array.isArray(r?.results) ? (r.results as unknown[]) : [];
    const labels: Record<string, string> = {
      '0': '$200 and under',
      '200': '$200.01 – $499',
      '500': '$500 – $999',
      '1000': '$1,000 – $1,999',
      '2000': '$2,000+',
    };
    return arr.map((row) => {
      const x = row as Record<string, unknown>;
      const sizeKey = String(x.size ?? '');
      return {
        sizeBucket: labels[sizeKey] ?? `Size ${sizeKey}`,
        total: typeof x.total === 'number' ? x.total : 0,
      };
    });
  }

  /**
   * Clears the in-memory cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
