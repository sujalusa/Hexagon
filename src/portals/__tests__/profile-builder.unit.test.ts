import { describe, it, expect } from 'vitest';
import { ProfileBuilder } from '../ProfileBuilder.js';
import type { ConstituentProfile, MeasurementEntry } from '../../types/index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(metricName: string, localValue: number | string, nationalAverage: number | string | null = null): MeasurementEntry {
  return { metricName, localValue, nationalAverage, unit: 'percent', source: 'ACS' };
}

const GEO_SCOPE = { type: 'state' as const, fips: '04' as const };

function makeMinimalProfile(overrides?: {
  ageDistribution?: MeasurementEntry[];
  raceEthnicity?: MeasurementEntry[];
  topEmploymentSectors?: MeasurementEntry[];
  medianEarningsByOccupation?: MeasurementEntry[];
  fecFinance?: ConstituentProfile['fecFinance'];
}): ConstituentProfile {
  const stub = makeEntry('stub', 'N/A', null);
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

// ─── computeDivergence ────────────────────────────────────────────────────────

describe('ProfileBuilder.computeDivergence', () => {
  it('returns absolute difference for two numbers', () => {
    expect(ProfileBuilder.computeDivergence(50, 30)).toBe(20);
  });

  it('is absolute (local < national)', () => {
    expect(ProfileBuilder.computeDivergence(30, 50)).toBe(20);
  });

  it('returns 0 when local is non-numeric string', () => {
    expect(ProfileBuilder.computeDivergence('abc', 30)).toBe(0);
  });

  it('returns 0 when national is non-numeric string', () => {
    expect(ProfileBuilder.computeDivergence(30, 'xyz')).toBe(0);
  });

  it('returns 0 when local is NaN', () => {
    expect(ProfileBuilder.computeDivergence(NaN, 30)).toBe(0);
  });
});

// ─── computeKeyIssues ─────────────────────────────────────────────────────────

describe('ProfileBuilder.computeKeyIssues', () => {
  it('returns exactly 5 when 7 numeric entries exist', () => {
    // Place 7 numeric entries across ageDistribution and raceEthnicity
    const numericEntries = Array.from({ length: 7 }, (_, i) =>
      makeEntry(`metric${i}`, i * 10, i * 5),
    );
    const profile = makeMinimalProfile({ ageDistribution: numericEntries });
    expect(ProfileBuilder.computeKeyIssues(profile)).toHaveLength(5);
  });

  it('returns exactly 3 when 3 numeric entries exist', () => {
    const numericEntries = [
      makeEntry('a', 10, 5),
      makeEntry('b', 20, 8),
      makeEntry('c', 30, 12),
    ];
    const profile = makeMinimalProfile({ ageDistribution: numericEntries });
    expect(ProfileBuilder.computeKeyIssues(profile)).toHaveLength(3);
  });

  it('returns empty array when 0 numeric entries exist', () => {
    const profile = makeMinimalProfile();
    expect(ProfileBuilder.computeKeyIssues(profile)).toEqual([]);
  });
});

// ─── buildMeasurementEntry ────────────────────────────────────────────────────

describe('ProfileBuilder.buildMeasurementEntry', () => {
  it('returns correct shape with all fields', () => {
    const entry = ProfileBuilder.buildMeasurementEntry(
      'Unemployment Rate',
      5.2,
      3.8,
      'percent',
      'ACS 5-Year 2023',
      '2024-01-01T00:00:00.000Z',
    );
    expect(entry).toEqual({
      metricName: 'Unemployment Rate',
      localValue: 5.2,
      nationalAverage: 3.8,
      unit: 'percent',
      source: 'ACS 5-Year 2023',
      cachedAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('returns correct shape without cachedAt', () => {
    const entry = ProfileBuilder.buildMeasurementEntry('Median Age', 36.1, 38.9, 'years', 'ACS');
    expect(entry.metricName).toBe('Median Age');
    expect(entry.localValue).toBe(36.1);
    expect(entry.nationalAverage).toBe(38.9);
    expect(entry.unit).toBe('years');
    expect(entry.source).toBe('ACS');
    expect(entry.cachedAt).toBeUndefined();
  });
});
