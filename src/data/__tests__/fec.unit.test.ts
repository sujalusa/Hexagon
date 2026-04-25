import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FecClient, parseFecCandidates, parseFecTotals } from '../FecClient.js';
import type { DataGap, FecCandidateList, FinanceRecord } from '../../types/index.js';

// ─── parseFecCandidates ───────────────────────────────────────────────────────

describe('parseFecCandidates', () => {
  it('returns DataGap for non-object input', () => {
    const result = parseFecCandidates('not an object');
    expect('description' in result).toBe(true);
  });

  it('returns DataGap when results is missing', () => {
    const result = parseFecCandidates({ pagination: { count: 0 } });
    expect('description' in result).toBe(true);
  });

  it('returns DataGap when results is empty', () => {
    const result = parseFecCandidates({ results: [], pagination: { count: 0 } });
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('No FEC records found');
    expect(gap.primarySources).toContain('api.open.fec.gov');
  });

  it('maps valid results to FecCandidateList', () => {
    const raw = {
      results: [
        { candidate_id: 'P00000001', name: 'Jane Doe', office: 'H', district: '01' },
      ],
      pagination: { count: 1 },
    };
    const result = parseFecCandidates(raw) as FecCandidateList;
    expect(result.results).toHaveLength(1);
    expect(result.results[0].candidate_id).toBe('P00000001');
    expect(result.results[0].name).toBe('Jane Doe');
    expect(result.results[0].office).toBe('H');
    expect(result.results[0].district).toBe('01');
    expect(result.pagination.count).toBe(1);
  });

  it('omits district when not present', () => {
    const raw = {
      results: [{ candidate_id: 'S00000001', name: 'John Smith', office: 'S' }],
      pagination: { count: 1 },
    };
    const result = parseFecCandidates(raw) as FecCandidateList;
    expect('district' in result.results[0]).toBe(false);
  });
});

// ─── parseFecTotals ───────────────────────────────────────────────────────────

describe('parseFecTotals', () => {
  it('returns DataGap when results is missing', () => {
    const result = parseFecTotals({ pagination: { count: 0 } });
    expect('description' in result).toBe(true);
  });

  it('returns DataGap when results is empty', () => {
    const result = parseFecTotals({ results: [] });
    expect('description' in result).toBe(true);
  });

  it('maps valid results[0] to FinanceRecord', () => {
    const raw = {
      results: [
        {
          candidate_id: 'P00000001',
          candidate_name: 'Jane Doe',
          receipts: 500000,
          coverage_start_date: '2023-01-01',
          coverage_end_date: '2023-12-31',
        },
      ],
    };
    const result = parseFecTotals(raw) as FinanceRecord;
    expect(result.entityId).toBe('P00000001');
    expect(result.entityName).toBe('Jane Doe');
    expect(result.totalRaised).toBe(500000);
    expect(result.reportingPeriod.start).toBe('2023-01-01');
    expect(result.reportingPeriod.end).toBe('2023-12-31');
    expect(result.contributions).toEqual([]);
    expect(result.benchmarks).toEqual([]);
    expect(result.legalContext).toContain('FEC OpenFEC API');
  });

  it('uses defaults for missing fields', () => {
    const raw = { results: [{}] };
    const result = parseFecTotals(raw) as FinanceRecord;
    expect(result.entityId).toBe('');
    expect(result.entityName).toBe('');
    expect(result.totalRaised).toBe(0);
    expect(result.reportingPeriod.start).toBe('');
    expect(result.reportingPeriod.end).toBe('');
  });
});

// ─── FecClient error paths ────────────────────────────────────────────────────

describe('FecClient error paths', () => {
  let client: FecClient;

  beforeEach(() => {
    client = new FecClient();
    client.clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPEN_FEC_API_KEY;
  });

  // ── Missing API key ──────────────────────────────────────────────────────────

  it('fetchCandidates: missing OPEN_FEC_API_KEY → DataGap with api.data.gov source', async () => {
    delete process.env.OPEN_FEC_API_KEY;
    const result = await client.fetchCandidates('AZ');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('OPEN_FEC_API_KEY');
    expect(gap.primarySources).toContain('api.data.gov');
  });

  it('fetchCandidateTotals: missing OPEN_FEC_API_KEY → DataGap with api.data.gov source', async () => {
    delete process.env.OPEN_FEC_API_KEY;
    const result = await client.fetchCandidateTotals('P00000001');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('OPEN_FEC_API_KEY');
    expect(gap.primarySources).toContain('api.data.gov');
  });

  // ── HTTP 429 ─────────────────────────────────────────────────────────────────

  it('fetchCandidates: HTTP 429 → DataGap with 60-second retry message', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => ({ status: 429, text: async () => 'Rate limited' }));

    const result = await client.fetchCandidates('AZ');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('rate limit');
    expect(gap.description).toContain('60 seconds');
    expect(gap.primarySources).toContain('api.open.fec.gov');
  });

  it('fetchCandidateTotals: HTTP 429 → DataGap with 60-second retry message', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => ({ status: 429, text: async () => 'Rate limited' }));

    const result = await client.fetchCandidateTotals('P00000001');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('rate limit');
    expect(gap.description).toContain('60 seconds');
  });

  // ── HTTP 500 ─────────────────────────────────────────────────────────────────

  it('fetchCandidates: HTTP 500 → DataGap with status code and URL', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => ({ status: 500, text: async () => 'Server Error' }));

    const result = await client.fetchCandidates('AZ');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('500');
    expect(gap.primarySources[0]).toContain('api.open.fec.gov');
  });

  it('fetchCandidateTotals: HTTP 500 → DataGap with status code and URL', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => ({ status: 500, text: async () => 'Server Error' }));

    const result = await client.fetchCandidateTotals('P00000001');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('500');
  });

  // ── Empty results ─────────────────────────────────────────────────────────────

  it('fetchCandidates: empty results array → DataGap indicating no records found', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => ({
      status: 200,
      text: async () => JSON.stringify({ results: [], pagination: { count: 0 } }),
    }));

    const result = await client.fetchCandidates('AZ');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('No FEC records found');
  });

  it('fetchCandidateTotals: empty results array → DataGap indicating no records found', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => ({
      status: 200,
      text: async () => JSON.stringify({ results: [], pagination: { count: 0 } }),
    }));

    const result = await client.fetchCandidateTotals('P00000001');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('No FEC records found');
  });

  // ── Timeout (AbortError) ──────────────────────────────────────────────────────

  it('fetchCandidates: AbortError → DataGap with timeout message', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });

    const result = await client.fetchCandidates('AZ');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('timed out');
    expect(gap.description).toContain('10 seconds');
  });

  it('fetchCandidateTotals: TimeoutError → DataGap with timeout message', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => {
      const err = new Error('The operation timed out');
      err.name = 'TimeoutError';
      throw err;
    });

    const result = await client.fetchCandidateTotals('P00000001');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('timed out');
    expect(gap.description).toContain('10 seconds');
  });

  // ── Valid response ────────────────────────────────────────────────────────────

  it('fetchCandidates: valid response → returns FecCandidateList', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    const mockData = {
      results: [{ candidate_id: 'P00000001', name: 'Jane Doe', office: 'H', district: '01' }],
      pagination: { count: 1 },
    };
    vi.stubGlobal('fetch', async () => ({
      status: 200,
      text: async () => JSON.stringify(mockData),
    }));

    const result = await client.fetchCandidates('AZ');
    expect('description' in result).toBe(false);
    const list = result as FecCandidateList;
    expect(list.results).toHaveLength(1);
    expect(list.results[0].candidate_id).toBe('P00000001');
  });

  it('fetchCandidateTotals: valid response → returns FinanceRecord', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    const mockData = {
      results: [
        {
          candidate_id: 'P00000001',
          candidate_name: 'Jane Doe',
          receipts: 1_000_000,
          coverage_start_date: '2023-01-01',
          coverage_end_date: '2023-12-31',
        },
      ],
      pagination: { count: 1 },
    };
    vi.stubGlobal('fetch', async () => ({
      status: 200,
      text: async () => JSON.stringify(mockData),
    }));

    const result = await client.fetchCandidateTotals('P00000001');
    expect('description' in result).toBe(false);
    const record = result as FinanceRecord;
    expect(record.entityId).toBe('P00000001');
    expect(record.totalRaised).toBe(1_000_000);
  });

  // ── JSON parse failure ────────────────────────────────────────────────────────

  it('fetchCandidates: invalid JSON → DataGap with first 200 chars', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    const rawBody = 'this is not json!!!';
    vi.stubGlobal('fetch', async () => ({
      status: 200,
      text: async () => rawBody,
    }));

    const result = await client.fetchCandidates('AZ');
    expect('description' in result).toBe(true);
    const gap = result as DataGap;
    expect(gap.description).toContain('Failed to parse');
    expect(gap.description).toContain(rawBody.slice(0, 200));
  });

  // ── URL construction ──────────────────────────────────────────────────────────

  it('fetchCandidates appends office and district when provided', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    let capturedUrl = '';
    vi.stubGlobal('fetch', async (url: string) => {
      capturedUrl = url;
      return {
        status: 200,
        text: async () =>
          JSON.stringify({
            results: [{ candidate_id: 'H00000001', name: 'Test', office: 'H', district: '01' }],
            pagination: { count: 1 },
          }),
      };
    });

    await client.fetchCandidates('AZ', 'H', '01');
    expect(capturedUrl).toContain('&office=H');
    expect(capturedUrl).toContain('&district=01');
  });

  // ── Cache ─────────────────────────────────────────────────────────────────────

  it('clearCache causes re-fetch on next call', async () => {
    process.env.OPEN_FEC_API_KEY = 'test-key';
    const mockData = {
      results: [{ candidate_id: 'P00000001', name: 'Jane Doe', office: 'H' }],
      pagination: { count: 1 },
    };
    let callCount = 0;
    vi.stubGlobal('fetch', async () => {
      callCount++;
      return { status: 200, text: async () => JSON.stringify(mockData) };
    });

    await client.fetchCandidates('AZ');
    client.clearCache();
    await client.fetchCandidates('AZ');
    expect(callCount).toBe(2);
  });
});
