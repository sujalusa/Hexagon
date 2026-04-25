// Feature: hexagon-portals, Property F: ACS parse round-trip
// Feature: hexagon-portals, Property H: Null ACS values produce DataGap substitution
// Feature: hexagon-portals, Property E: Cache round-trip

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  parseAcsResponse,
  serializeAcsRows,
  CensusClient,
} from '../CensusClient.js';
import type { AcsNamedRow } from '../../types/index.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// Valid alphanumeric header names
const headerNameArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .filter((s) => /^[a-zA-Z0-9_]+$/.test(s));

// Generate a valid ACS array-of-arrays: [headers, ...dataRows]
const validAcsArrayArb = fc
  .array(headerNameArb, { minLength: 1, maxLength: 5 })
  .chain((headers) => {
    // Deduplicate headers to avoid key collisions
    const uniqueHeaders = [...new Set(headers)];
    return fc
      .array(
        fc.array(fc.string({ minLength: 0, maxLength: 20 }), {
          minLength: uniqueHeaders.length,
          maxLength: uniqueHeaders.length,
        }),
        { minLength: 1, maxLength: 3 },
      )
      .map((dataRows) => [uniqueHeaders, ...dataRows] as string[][]);
  });

// ACS array with some null values in data cells
const acsArrayWithNullsArb = fc
  .array(headerNameArb, { minLength: 1, maxLength: 5 })
  .chain((headers) => {
    const uniqueHeaders = [...new Set(headers)];
    return fc
      .array(
        fc.array(
          fc.option(fc.string({ minLength: 0, maxLength: 20 }), { nil: null }),
          {
            minLength: uniqueHeaders.length,
            maxLength: uniqueHeaders.length,
          },
        ),
        { minLength: 1, maxLength: 3 },
      )
      .map((dataRows) => [uniqueHeaders, ...dataRows] as (string | null)[][]);
  });

// ─── Property F: ACS Parse Round-Trip ─────────────────────────────────────────

describe('Property F: ACS Parse Round-Trip', () => {
  /**
   * **Validates: Requirements 1.7, 11.4**
   *
   * For any valid ACS array-of-arrays, parsing → serializing → parsing again
   * must produce an equivalent set of named objects.
   */
  it('parse(serialize(parse(input))) ≡ parse(input) for valid ACS arrays', () => {
    fc.assert(
      fc.property(validAcsArrayArb, (input) => {
        const firstParse = parseAcsResponse(input);

        // Skip if first parse returned a DataGap (shouldn't happen with valid input)
        if ('description' in firstParse) return;

        const serialized = serializeAcsRows(firstParse as AcsNamedRow[]);
        const secondParse = parseAcsResponse(serialized);

        // Second parse must also succeed
        expect('description' in secondParse).toBe(false);

        const rows1 = firstParse as AcsNamedRow[];
        const rows2 = secondParse as AcsNamedRow[];

        expect(rows2.length).toBe(rows1.length);

        for (let i = 0; i < rows1.length; i++) {
          // Keys may be reordered by sort in serialize, but values must match
          const keys1 = Object.keys(rows1[i]).sort();
          const keys2 = Object.keys(rows2[i]).sort();
          expect(keys2).toEqual(keys1);
          for (const key of keys1) {
            expect(rows2[i][key]).toBe(rows1[i][key]);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property H: Null ACS Values Produce DataGap Substitution ─────────────────

describe('Property H: Null ACS Values Produce DataGap Substitution', () => {
  /**
   * **Validates: Requirements 2.4, 3.4, 4.3, 5.3, 12.4, 13.3, 14.3, 15.2, 16.2, 17.2, 18.2, 19.3**
   *
   * When fetchVariable receives a null value for the requested variable,
   * it returns a DataGap rather than propagating null.
   */
  it('fetchVariable returns DataGap when ACS response contains null for the variable', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a variable name and a position for the null
        fc
          .array(headerNameArb, { minLength: 1, maxLength: 5 })
          .chain((headers) => {
            const uniqueHeaders = [...new Set(headers)];
            // Pick one header to be the "variable" we'll query
            return fc
              .integer({ min: 0, max: uniqueHeaders.length - 1 })
              .map((nullIdx) => ({
                variable: uniqueHeaders[nullIdx],
                headers: uniqueHeaders,
                nullIdx,
              }));
          }),
        async ({ variable, headers, nullIdx }) => {
          const client = new CensusClient();

          // Build a response where the target variable is null
          const dataRow = headers.map((_, i) => (i === nullIdx ? null : 'someValue'));
          const mockResponse = [headers, dataRow];

          vi.stubGlobal('fetch', async () => ({
            status: 200,
            text: async () => JSON.stringify(mockResponse),
          }));

          const result = await client.fetchVariable(variable, { type: 'state', fips: '04' });

          // Must return DataGap, not null
          expect(result).not.toBeNull();
          expect(typeof result).toBe('object');
          expect('description' in (result as object)).toBe(true);

          vi.unstubAllGlobals();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property E: Cache Round-Trip ─────────────────────────────────────────────

describe('Property E: Cache Round-Trip', () => {
  /**
   * **Validates: Requirements 10.5**
   *
   * Storing a value in the cache then immediately retrieving it
   * returns the same data.
   */
  it('second fetch with same URL returns cached data', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random ACS row data
        fc.array(
          fc.record({
            key: headerNameArb,
            value: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        async (entries) => {
          const client = new CensusClient();
          client.clearCache();

          // Build a valid ACS response from the entries
          const headers = [...new Set(entries.map((e) => e.key))];
          if (headers.length === 0) return;

          const dataRow = headers.map((h) => {
            const entry = entries.find((e) => e.key === h);
            return entry?.value ?? null;
          });
          const mockAcsResponse = [headers, dataRow];

          let callCount = 0;
          vi.stubGlobal('fetch', async () => {
            callCount++;
            return {
              status: 200,
              text: async () => JSON.stringify(mockAcsResponse),
            };
          });

          const url = 'https://api.census.gov/data/2023/acs/acs5?get=B01002_001E&for=state:04';

          const first = await client.fetch(url);
          const second = await client.fetch(url);

          // Only one HTTP call should have been made
          expect(callCount).toBe(1);

          // Both results should be equivalent
          expect('description' in (first as object)).toBe(false);
          expect('description' in (second as object)).toBe(false);
          expect(second).toEqual(first);

          vi.unstubAllGlobals();
        },
      ),
      { numRuns: 100 },
    );
  });
});
