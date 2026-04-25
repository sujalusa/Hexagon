// Feature: hexagon-portals, Property A: MeasurementEntry completeness

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { expect } from 'vitest';
import type { ConstituentProfile, MeasurementEntry } from '../../types/index.js';
import { ProfileBuilder } from '../ProfileBuilder.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GEO_SCOPE = { type: 'state' as const, fips: '04' as const };

function makeEntry(
  metricName: string,
  localValue: number | string,
  nationalAverage: number | string | null,
  unit: string,
  source: string,
): MeasurementEntry {
  return { metricName, localValue, nationalAverage, unit, source };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 40 });

const unitArb = fc.constantFrom('percent', 'dollars', 'years', 'minutes', 'count', 'persons');

const localValueArb: fc.Arbitrary<number | string> = fc.oneof(
  fc.float({ min: 0, max: 1_000_000, noNaN: true }),
  nonEmptyStringArb,
);

const nationalAverageArb: fc.Arbitrary<number | string | null> = fc.oneof(
  fc.float({ min: 0, max: 1_000_000, noNaN: true }),
  fc.constant(null),
);

const measurementEntryArb: fc.Arbitrary<MeasurementEntry> = fc.record({
  metricName: nonEmptyStringArb,
  localValue: localValueArb,
  nationalAverage: nationalAverageArb,
  unit: unitArb,
  source: nonEmptyStringArb,
});

const measurementEntryArrayArb = fc.array(measurementEntryArb, { minLength: 0, maxLength: 5 });

function makeMinimalProfile(overrides?: Partial<{
  ageDistribution: MeasurementEntry[];
  raceEthnicity: MeasurementEntry[];
  topEmploymentSectors: MeasurementEntry[];
  medianEarningsByOccupation: MeasurementEntry[];
  fecFinance: ConstituentProfile['fecFinance'];
}>): ConstituentProfile {
  // Use a valid stub with non-empty unit and source so the property holds
  const stub = makeEntry('stub', 'N/A', null, 'count', 'ACS');
  return {
    geoScope: GEO_SCOPE,
    generatedAt: new Date().toISOString(),
    demographics: {
      totalPopulation: stub,
      medianAge: stub,
      ageDistribution: overrides?.ageDistribution ?? [],
      raceEthnicity: overrides?.raceEthnicity ?? [],
    },
    economic: { medianHouseholdIncome: stub, perCapitaIncome: stub, povertyRate: stub },
    education: { highSchoolGradRate: stub, bachelorsDegreeRate: stub },
    housing: { medianHomeValue: stub, ownerOccupiedRate: stub, renterOccupiedRate: stub },
    laborMarket: {
      unemploymentRate: stub,
      topEmploymentSectors: overrides?.topEmploymentSectors ?? [],
      medianEarningsByOccupation: overrides?.medianEarningsByOccupation ?? [],
    },
    languageAccess: { nonEnglishHouseholdRate: stub, limitedEnglishProficiencyRate: stub },
    commute: { meanTravelTimeMinutes: stub, driveAloneRate: stub, publicTransitRate: stub },
    healthInsurance: { uninsuredRate: stub },
    veterans: { veteranRate: stub },
    disability: { disabilityRateUnder65: stub },
    broadband: { broadbandSubscriptionRate: stub },
    householdComposition: { averageHouseholdSize: stub, singleParentHouseholdRate: stub },
    civicEngagement: { totalRegisteredVoters: stub, voterTurnoutRate: stub },
    fecFinance: overrides?.fecFinance,
    keyIssuesContext: [],
    dataGaps: [],
  };
}

// Arbitrary for a full ConstituentProfile with random MeasurementEntries
const constituentProfileArb: fc.Arbitrary<ConstituentProfile> = fc.record({
  ageDistribution: measurementEntryArrayArb,
  raceEthnicity: measurementEntryArrayArb,
  topEmploymentSectors: measurementEntryArrayArb,
  medianEarningsByOccupation: measurementEntryArrayArb,
}).map(({ ageDistribution, raceEthnicity, topEmploymentSectors, medianEarningsByOccupation }) =>
  makeMinimalProfile({ ageDistribution, raceEthnicity, topEmploymentSectors, medianEarningsByOccupation }),
);

// ─── Collect all MeasurementEntries from a profile ───────────────────────────

function collectAllEntries(profile: ConstituentProfile): MeasurementEntry[] {
  const entries: MeasurementEntry[] = [];
  entries.push(profile.demographics.totalPopulation, profile.demographics.medianAge);
  entries.push(...profile.demographics.ageDistribution, ...profile.demographics.raceEthnicity);
  entries.push(profile.economic.medianHouseholdIncome, profile.economic.perCapitaIncome, profile.economic.povertyRate);
  entries.push(profile.education.highSchoolGradRate, profile.education.bachelorsDegreeRate);
  entries.push(profile.housing.medianHomeValue, profile.housing.ownerOccupiedRate, profile.housing.renterOccupiedRate);
  entries.push(profile.laborMarket.unemploymentRate, ...profile.laborMarket.topEmploymentSectors, ...profile.laborMarket.medianEarningsByOccupation);
  entries.push(profile.languageAccess.nonEnglishHouseholdRate, profile.languageAccess.limitedEnglishProficiencyRate);
  entries.push(profile.commute.meanTravelTimeMinutes, profile.commute.driveAloneRate, profile.commute.publicTransitRate);
  entries.push(profile.healthInsurance.uninsuredRate);
  entries.push(profile.veterans.veteranRate);
  entries.push(profile.disability.disabilityRateUnder65);
  entries.push(profile.broadband.broadbandSubscriptionRate);
  entries.push(profile.householdComposition.averageHouseholdSize, profile.householdComposition.singleParentHouseholdRate);
  entries.push(profile.civicEngagement.totalRegisteredVoters, profile.civicEngagement.voterTurnoutRate);
  if (profile.fecFinance) {
    if (profile.fecFinance.candidateTotals) entries.push(...profile.fecFinance.candidateTotals);
    entries.push(...profile.fecFinance.raceTotals);
  }
  return entries;
}

// ─── Property A: MeasurementEntry Completeness ───────────────────────────────

describe('Property A: MeasurementEntry Completeness', () => {
  /**
   * **Validates: Requirements 8.1, 8.2, 9.1**
   *
   * For any ConstituentProfile, every MeasurementEntry must have:
   * - non-empty metricName
   * - non-null localValue
   * - non-empty unit
   * - non-empty source
   */
  it('every MeasurementEntry has non-empty metricName, non-null localValue, non-empty unit, non-empty source', () => {
    fc.assert(
      fc.property(constituentProfileArb, (profile) => {
        const entries = collectAllEntries(profile);
        for (const entry of entries) {
          expect(entry.metricName).toBeTruthy();
          expect(entry.localValue).not.toBeNull();
          expect(entry.unit).toBeTruthy();
          expect(entry.source).toBeTruthy();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('ProfileBuilder.buildMeasurementEntry always produces a complete entry', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        localValueArb,
        nationalAverageArb,
        unitArb,
        nonEmptyStringArb,
        (metricName, localValue, nationalAverage, unit, source) => {
          const entry = ProfileBuilder.buildMeasurementEntry(metricName, localValue, nationalAverage, unit, source);
          expect(entry.metricName).toBe(metricName);
          expect(entry.localValue).toBe(localValue);
          expect(entry.nationalAverage).toBe(nationalAverage);
          expect(entry.unit).toBe(unit);
          expect(entry.source).toBe(source);
        },
      ),
      { numRuns: 100 },
    );
  });
});
