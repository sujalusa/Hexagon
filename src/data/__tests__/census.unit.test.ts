import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CensusClient, buildGeoParam, parseAcsResponse, serializeAcsRows } from '../CensusClient.js';

// ─── buildGeoParam ────────────────────────────────────────────────────────────

describe('buildGeoParam', () => {
  it('state scope → for=state:04', () => {
    expect(buildGeoParam({ type: 'state', fips: '04' })).toBe('for=state:04');
  });

  it('county scope without countyFips → for=county:*&in=state:04', () => {
    expect(buildGeoParam({ type: 'county', stateFips: '04' })).toBe('for=county:*&in=state:04');
  });

  it('county scope with countyFips → for=county:013&in=state:04', () => {
    expect(buildGeoParam({ type: 'county', stateFips: '04', countyFips: '013' })).toBe(
      'for=county:013&in=state:04',
    );
  });

  it('district scope → for=congressional%20district:01&in=state:04', () => {
    expect(buildGeoParam({ type: 'district', fips: '01' })).toBe(
      'for=congressional%20district:01&in=state:04',
    );
  });
});

// ─── parseAcsResponse ─────────────────────────────────────────────────────────

describe('parseAcsResponse', () => {
  it('returns DataGap for non-array input', () => {
    const result = parseAcsResponse('not an array');
    expect('description' in result).toBe(true);
  });

  it('returns DataGap for array with fewer than 2 rows', () => {
    const result = parseAcsResponse([['header1']]);
    expect('description' in result).toBe(true);
  });

  it('parses valid ACS response into named rows', () => {
    const input = [['NAME', 'B01002_001E', 'state'], ['Arizona', '38.5', '04']];
    const result = parseAcsResponse(input);
    expect(Array.isArray(result)).toBe(true);
    const rows = result as ReturnType<typeof parseAcsResponse> & Array<unknown>;
    expect(rows).toHaveLength(1);
    expect((rows[0] as Record<string, unknown>)['NAME']).toBe('Arizona');
    expect((rows[0] as Record<string, unknown>)['B01002_001E']).toBe('38.5');
  });

  it('keeps null values as null', () => {
    const input = [['NAME', 'B01002_001E'], ['Arizona', null]];
    const result = parseAcsResponse(input);
    expect(Array.isArray(result)).toBe(true);
    const rows = result as Array<Record<string, string | null>>;
    expect(rows[0]['B01002_001E']).toBeNull();
  });

  it('converts Census suppression code -666666666 to null', () => {
    const input = [['NAME', 'B01002_001E'], ['Arizona', '-666666666']];
    const result = parseAcsResponse(input);
    const rows = result as Array<Record<string, string | null>>;
    expect(rows[0]['B01002_001E']).toBeNull();
  });
});

// ─── serializeAcsRows ─────────────────────────────────────────────────────────

describe('serializeAcsRows', () => {
  it('returns [] for empty input', () => {
    expect(serializeAcsRows([])).toEqual([]);
  });

  it('first row is sorted headers, subsequent rows are values', () => {
    const rows = [{ B: 'val_b', A: 'val_a' }];
    const result = serializeAcsRows(rows);
    expect(result[0]).toEqual(['A', 'B']); // sorted
    expect(result[1]).toEqual(['val_a', 'val_b']);
  });
});

// ─── CensusClient error paths ─────────────────────────────────────────────────

describe('CensusClient error paths', () => {
  let client: CensusClient;

  beforeEach(() => {
    client = new CensusClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('HTTP 500 → DataGap with status and URL', async () => {
    vi.stubGlobal('fetch', async () => ({
      status: 500,
      text: async () => 'Internal Server Error',
    }));

    const url = 'https://api.census.gov/data/2023/acs/acs5?get=B01002_001E&for=state:04';
    const result = await client.fetch(url);

    expect('description' in result).toBe(true);
    const gap = result as { description: string; primarySources: string[] };
    expect(gap.description).toContain('500');
    expect(gap.description).toContain(url);
    expect(gap.primarySources).toContain(url);
  });

  it('AbortError (timeout) → DataGap with timeout message', async () => {
    vi.stubGlobal('fetch', async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });

    const url = 'https://api.census.gov/data/2023/acs/acs5?get=B01002_001E&for=state:04';
    const result = await client.fetch(url);

    expect('description' in result).toBe(true);
    const gap = result as { description: string; primarySources: string[] };
    expect(gap.description).toContain('timed out');
    expect(gap.description).toContain(url);
    expect(gap.primarySources).toContain(url);
  });

  it('TimeoutError → DataGap with timeout message', async () => {
    vi.stubGlobal('fetch', async () => {
      const err = new Error('The operation timed out');
      err.name = 'TimeoutError';
      throw err;
    });

    const url = 'https://api.census.gov/data/2023/acs/acs5?get=B01002_001E&for=state:04';
    const result = await client.fetch(url);

    expect('description' in result).toBe(true);
    const gap = result as { description: string; primarySources: string[] };
    expect(gap.description).toContain('timed out');
  });

  it('invalid JSON → DataGap with first 200 chars of raw body', async () => {
    const rawBody = 'this is not json at all!!!';
    vi.stubGlobal('fetch', async () => ({
      status: 200,
      text: async () => rawBody,
    }));

    const url = 'https://api.census.gov/data/2023/acs/acs5?get=B01002_001E&for=state:04';
    const result = await client.fetch(url);

    expect('description' in result).toBe(true);
    const gap = result as { description: string; primarySources: string[] };
    expect(gap.description).toContain('Failed to parse');
    expect(gap.description).toContain(rawBody.slice(0, 200));
    expect(gap.primarySources).toContain(url);
  });

  it('fetchVariable with null value → DataGap (not null)', async () => {
    const mockResponse = [['B01002_001E', 'state'], [null, '04']];
    vi.stubGlobal('fetch', async () => ({
      status: 200,
      text: async () => JSON.stringify(mockResponse),
    }));

    const result = await client.fetchVariable('B01002_001E', { type: 'state', fips: '04' });

    expect(result).not.toBeNull();
    expect(typeof result).toBe('object');
    expect('description' in (result as object)).toBe(true);
  });

  it('cache returns same data on second call without re-fetching', async () => {
    const mockResponse = [['B01002_001E', 'state'], ['38.5', '04']];
    let callCount = 0;
    vi.stubGlobal('fetch', async () => {
      callCount++;
      return {
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      };
    });

    const url = 'https://api.census.gov/data/2023/acs/acs5?get=B01002_001E&for=state:04';
    await client.fetch(url);
    await client.fetch(url);

    expect(callCount).toBe(1);
  });

  it('clearCache causes re-fetch on next call', async () => {
    const mockResponse = [['B01002_001E', 'state'], ['38.5', '04']];
    let callCount = 0;
    vi.stubGlobal('fetch', async () => {
      callCount++;
      return {
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      };
    });

    const url = 'https://api.census.gov/data/2023/acs/acs5?get=B01002_001E&for=state:04';
    await client.fetch(url);
    client.clearCache();
    await client.fetch(url);

    expect(callCount).toBe(2);
  });
});
