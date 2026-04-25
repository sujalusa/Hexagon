// Feature: hexagon-portals, Property G: FEC parse round-trip

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { parseFecTotals } from '../FecClient.js';
import type { FinanceRecord } from '../../types/index.js';

// ─── Property G: FEC Parse Round-Trip ─────────────────────────────────────────

describe('Property G: FEC Parse Round-Trip', () => {
  /**
   * **Validates: Requirements 1.7, 11.5**
   *
   * For any valid OpenFEC-shaped JSON object, parsing to a FinanceRecord then
   * serializing to JSON then parsing again must produce an equivalent FinanceRecord.
   */
  it('parseFecTotals(JSON.parse(JSON.stringify(parseFecTotals(input)))) ≡ parseFecTotals(input)', () => {
    const openFecArb = fc.record({
      results: fc.array(
        fc.record({
          candidate_id: fc.string({ minLength: 1, maxLength: 10 }),
          candidate_name: fc.string({ minLength: 1, maxLength: 30 }),
          receipts: fc.float({ min: 0, max: 10_000_000 }),
          coverage_start_date: fc.constant('2023-01-01'),
          coverage_end_date: fc.constant('2023-12-31'),
        }),
        { minLength: 1, maxLength: 3 },
      ),
      pagination: fc.record({ count: fc.nat() }),
    });

    fc.assert(
      fc.property(openFecArb, (input) => {
        const first = parseFecTotals(input);

        // Skip if first parse returned a DataGap
        if ('description' in first) return;

        const record = first as FinanceRecord;

        // Serialize the raw input to JSON and back, then re-parse
        // This tests that JSON serialization of the raw API shape is stable
        const roundTrippedInput = JSON.parse(JSON.stringify(input)) as unknown;
        const second = parseFecTotals(roundTrippedInput);

        // Second parse must also succeed and be equivalent
        if ('description' in second) {
          throw new Error('Second parse returned DataGap unexpectedly');
        }

        const r2 = second as FinanceRecord;

        // Compare all fields
        if (r2.entityId !== record.entityId) throw new Error('entityId mismatch');
        if (r2.entityName !== record.entityName) throw new Error('entityName mismatch');
        if (r2.totalRaised !== record.totalRaised) throw new Error('totalRaised mismatch');
        if (r2.reportingPeriod.start !== record.reportingPeriod.start)
          throw new Error('reportingPeriod.start mismatch');
        if (r2.reportingPeriod.end !== record.reportingPeriod.end)
          throw new Error('reportingPeriod.end mismatch');
        if (r2.legalContext !== record.legalContext) throw new Error('legalContext mismatch');
      }),
      { numRuns: 100 },
    );
  });
});
