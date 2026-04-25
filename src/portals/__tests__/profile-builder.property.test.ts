// Feature: hexagon-portals, Property B: KeyIssuesContext count invariant
// Feature: hexagon-portals, Property C: KeyIssuesContext ordering
// Feature: hexagon-portals, Property D: No characterization labels

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { expect } from 'vitest';
import { ProfileBuilder } from '../ProfileBuilder.js';
import type { ConstituentProfile, MeasurementEntry } from '../../types/index.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const PROHIBITED_LABELS = [
  'problem', 'challenge', 'opportunity', 'crisis', 'reform',
  'policy', 'focus', 'address', 'prioritize', 'advantage',
  'disadvantage', 'competitive',
];

// Safe metric name: no prohibited labels
const safeMetricNameArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => !PROHIBITED_LABELS.some((label) => s.toLowerCase().includes(label)));

// A numeric MeasurementEntry (both localValue and nationalAverage are finite numbers)
const numericEntryArb = fc.record({
  metricName: safeMetricNameArb,
  localValue: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
  nationalAverage: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
  unit: fc.constantFrom('percent', 'dollars', 'years', 'minutes', 'count'),
  source: fc.constant('ACS'),
});

// A non-numeric MeasurementEntry (localValue is a non-numeric string, nationalAverage is null)
const nonNumericEntryArb: fc.Arbitrary<MeasurementEntry> = fc.record({
  metricName: safeMetricNameArb,
  localValue: fc.constant('N/A'),
  nationalAverage: fc.constant(null),
  unit: fc.constant(''),
  source: fc.constant('ACS'),
});

const GEO_SCOPE = { type: 'state' as const, fips: '04' as const };

function makeMinimalProfile(
  ageDistribution: MeasurementEntry[],
  raceEthnicity: MeasurementEntry[],
): ConstituentProfile {
  const stub: MeasurementEntry = { metricName: 'stub', localValue: 'N/A', nationalAverage: null, unit: '', source: 'ACS' };
  return {
    geoScope: GEO_SCOPE,
    generatedAt: new Date().toISOString(),
    demographics: { totalPopulation: stub, medianAge: stub, ageDistribution, raceEthnicity },
    economic: { medianHouseholdIncome: stub, perCapitaIncome: stub, povertyRate: stub },
    education: { highSchoolGradRate: stub, bachelorsDegreeRate: stub },
    housing: { medianHomeValue: stub, ownerOccupiedRate: stub, renterOccupiedRate: stub },
    laborMarket: { unemploymentRate: stub, topEmploymentSectors: [], medianEarningsByOccupation: [] },
    languageAccess: { nonEnglishHouseholdRate: stub, limitedEnglishProficiencyRate: stub },
    commute: { meanTravelTimeMinutes: stub, driveAloneRate: stub, publicTransitRate: stub },
    healthInsurance: { uninsuredRate: stub },
    veterans: { veteranRate: stub },
    disability: { disabilityRateUnder65: stub },
    broadband: { broadbandSubscriptionRate: stub },
    householdComposition: { averageHouseholdSize: stub, singleParentHouseholdRate: stub },
    civicEngagement: { totalRegisteredVoters: stub, voterTurnoutRate: stub },
    keyIssuesContext: [],
    dataGaps: [],
  };
}

// Arbitrary for a profile with a variable number of numeric entries (0–10)
const profileWithVaryingNumericArb = fc
  .array(numericEntryArb, { minLength: 0, maxLength: 10 })
  .map((numericEntries) => makeMinimalProfile(numericEntries, []));

// Arbitrary for a profile with at least 2 numeric entries
const profileWithAtLeast2NumericArb = fc
  .array(numericEntryArb, { minLength: 2, maxLength: 10 })
  .map((numericEntries) => makeMinimalProfile(numericEntries, []));

// Arbitrary for a profile with arbitrary (safe) metric names
const profileWithArbitraryMetricNamesArb = fc
  .array(
    fc.oneof(numericEntryArb, nonNumericEntryArb),
    { minLength: 0, maxLength: 10 },
  )
  .map((entries) => makeMinimalProfile(entries, []));

// ─── Property B: KeyIssuesContext Count Invariant ─────────────────────────────

describe('Property B: KeyIssuesContext Count Invariant', () => {
  /**
   * **Validates: Requirements 9.3, 9.6**
   *
   * For any ConstituentProfile, computeKeyIssues returns between 0 and 5 entries.
   */
  it('computeKeyIssues always returns 0–5 entries', () => {
    fc.assert(
      fc.property(profileWithVaryingNumericArb, (profile) => {
        const result = ProfileBuilder.computeKeyIssues(profile);
        expect(result.length).toBeGreaterThanOrEqual(0);
        expect(result.length).toBeLessThanOrEqual(5);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property C: KeyIssuesContext Ordering ────────────────────────────────────

describe('Property C: KeyIssuesContext Ordering', () => {
  /**
   * **Validates: Requirements 9.3**
   *
   * For any profile with 2+ numeric entries, adjacent pairs in the result
   * satisfy divergenceMagnitude[i] >= divergenceMagnitude[i+1].
   */
  it('computeKeyIssues returns entries sorted descending by divergenceMagnitude', () => {
    fc.assert(
      fc.property(profileWithAtLeast2NumericArb, (profile) => {
        const result = ProfileBuilder.computeKeyIssues(profile);
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].divergenceMagnitude).toBeGreaterThanOrEqual(result[i + 1].divergenceMagnitude);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property D: No Characterization Labels ───────────────────────────────────

describe('Property D: No Characterization Labels', () => {
  /**
   * **Validates: Requirements 8.8, 9.4, 9.5, 20.3, 20.6**
   *
   * No metricName in any MeasurementEntry or KeyIssuesContext contains
   * prohibited characterization strings.
   */
  it('no metricName contains prohibited characterization labels', () => {
    fc.assert(
      fc.property(profileWithArbitraryMetricNamesArb, (profile) => {
        const keyIssues = ProfileBuilder.computeKeyIssues(profile);

        // Check all MeasurementEntries in ageDistribution (our variable section)
        for (const entry of profile.demographics.ageDistribution) {
          for (const label of PROHIBITED_LABELS) {
            expect(entry.metricName.toLowerCase()).not.toContain(label);
          }
        }

        // Check all KeyIssuesContext entries
        for (const issue of keyIssues) {
          for (const label of PROHIBITED_LABELS) {
            expect(issue.metricName.toLowerCase()).not.toContain(label);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
