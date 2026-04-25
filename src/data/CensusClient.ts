import type { AcsNamedRow, CacheEntry, DataGap, GeoScope } from '../types/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACS_BASE_URL = 'https://api.census.gov/data/2023/acs/acs5';
const CACHE_TTL_MS = 3_600_000; // 1 hour
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds
const CENSUS_SUPPRESSION_CODE = '-666666666';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the `for=...&in=...` geo parameter string for the ACS API.
 */
export function buildGeoParam(geoScope: GeoScope): string {
  switch (geoScope.type) {
    case 'state':
      return `for=state:${geoScope.fips}`;
    case 'county':
      if (geoScope.countyFips !== undefined) {
        return `for=county:${geoScope.countyFips}&in=state:${geoScope.stateFips}`;
      }
      return `for=county:*&in=state:${geoScope.stateFips}`;
    case 'district':
      return `for=congressional%20district:${geoScope.fips}&in=state:04`;
  }
}

/**
 * Parses a raw ACS array-of-arrays response into named row objects.
 * First row is treated as headers; subsequent rows are data.
 * Null values and Census suppression codes are kept as null.
 * Returns DataGap if the structure is invalid.
 */
export function parseAcsResponse(raw: unknown): AcsNamedRow[] | DataGap {
  if (!Array.isArray(raw) || raw.length < 2) {
    return {
      description: 'Invalid ACS response: expected array with at least 2 rows (header + data)',
      primarySources: [ACS_BASE_URL],
    };
  }

  const [headerRow, ...dataRows] = raw as unknown[];

  if (!Array.isArray(headerRow) || !headerRow.every((h) => typeof h === 'string')) {
    return {
      description: 'Invalid ACS response: first row must be an array of strings (headers)',
      primarySources: [ACS_BASE_URL],
    };
  }

  const headers = headerRow as string[];

  const result: AcsNamedRow[] = [];
  for (const row of dataRows) {
    if (!Array.isArray(row)) {
      return {
        description: 'Invalid ACS response: data rows must be arrays',
        primarySources: [ACS_BASE_URL],
      };
    }
    const namedRow: AcsNamedRow = {};
    for (let i = 0; i < headers.length; i++) {
      const rawVal = row[i];
      if (rawVal === null || rawVal === CENSUS_SUPPRESSION_CODE) {
        namedRow[headers[i]] = null;
      } else {
        namedRow[headers[i]] = rawVal !== undefined ? String(rawVal) : null;
      }
    }
    result.push(namedRow);
  }

  return result;
}

/**
 * Serializes AcsNamedRow[] back to the ACS array-of-arrays wire format.
 * First output row = sorted keys (headers); subsequent rows = values in same order.
 * Returns [] for empty input.
 */
export function serializeAcsRows(rows: AcsNamedRow[]): string[][] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]).sort();
  const output: string[][] = [headers];

  for (const row of rows) {
    const dataRow = headers.map((h) => {
      const val = row[h];
      return val === null ? null : val;
    }) as string[];
    output.push(dataRow);
  }

  return output;
}

// ─── CensusClient ─────────────────────────────────────────────────────────────

export class CensusClient {
  private cache = new Map<string, CacheEntry<AcsNamedRow[]>>();

  /**
   * Fetches a URL, using the in-memory cache when available (TTL = 1 hour).
   */
  async fetch(url: string): Promise<AcsNamedRow[] | DataGap> {
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
        };
      }
      return {
        description: `Network error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`,
        primarySources: [url],
      };
    }

    if (response.status < 200 || response.status > 299) {
      return {
        description: `HTTP ${response.status} error fetching ${url}`,
        primarySources: [url],
      };
    }

    let rawBody: string;
    try {
      rawBody = await response.text();
    } catch {
      return {
        description: `Failed to read response body from ${url}`,
        primarySources: [url],
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return {
        description: `Failed to parse API response from ${url}. Raw response (first 200 chars): ${rawBody.slice(0, 200)}`,
        primarySources: [url],
      };
    }

    const parsed = parseAcsResponse(json);
    if ('description' in parsed) {
      return parsed;
    }

    const cachedAt = new Date().toISOString();
    this.cache.set(url, { data: parsed, cachedAt, ttlMs: CACHE_TTL_MS });
    return parsed;
  }

  /**
   * Fetches all variables in an ACS group for the given geography.
   */
  async fetchGroup(group: string, geoScope: GeoScope): Promise<AcsNamedRow[] | DataGap> {
    const url = `${ACS_BASE_URL}?get=group(${group})&${buildGeoParam(geoScope)}`;
    return this.fetch(url);
  }

  /**
   * Fetches a single ACS variable and returns its string value.
   * Returns DataGap if the value is null or missing.
   */
  async fetchVariable(variable: string, geoScope: GeoScope): Promise<string | DataGap> {
    const url = `${ACS_BASE_URL}?get=${variable}&${buildGeoParam(geoScope)}`;
    const result = await this.fetch(url);

    if ('description' in result) {
      return result;
    }

    const value = result[0]?.[variable];
    if (value === null || value === undefined) {
      return {
        description: `No value returned for variable ${variable}`,
        primarySources: [url],
      };
    }

    return value;
  }

  /**
   * Clears the in-memory cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
