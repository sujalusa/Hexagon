import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CandidatePortal } from '../CandidatePortal.js';
import { CensusClient } from '../../data/CensusClient.js';
import { FecClient } from '../../data/FecClient.js';
import type { DataGap, AcsNamedRow } from '../../types/index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GEO_SCOPE = { type: 'state' as const, fips: '04' as const };

/** Minimal ACS row that satisfies all fetch methods */
function makeAcsRow(overrides: Record<string, string> = {}): AcsNamedRow {
  return {
    // B01001 - age distribution
    B01001_001E: '7000000',
    B01001_003E: '500000',
    B01001_007E: '600000',
    B01001_012E: '700000',
    B01001_017E: '400000',
    B01001_020E: '300000',
    // B02001 - race
    B02001_001E: '7000000',
    B02001_002E: '4000000',
    B02001_003E: '500000',
    B02001_005E: '300000',
    // B03003 - hispanic
    B03003_001E: '7000000',
    B03003_003E: '2000000',
    // B17001 - poverty
    B17001_001E: '7000000',
    B17001_002E: '700000',
    // B15003 - education
    B15003_001E: '5000000',
    B15003_017E: '3000000',
    B15003_022E: '1500000',
    // B25003 - housing tenure
    B25003_001E: '2500000',
    B25003_002E: '1600000',
    B25003_003E: '900000',
    // B23025 - labor force
    B23025_002E: '3500000',
    B23025_005E: '140000',
    // C24050 - employment sectors
    C24050_001E: '3500000',
    C24050_002E: '100000',
    C24050_003E: '200000',
    C24050_004E: '300000',
    C24050_005E: '150000',
    C24050_006E: '400000',
    // C24010 - occupation earnings
    C24010_003E: '65000',
    C24010_019E: '35000',
    // B16002 - language
    B16002_001E: '2500000',
    B16002_003E: '500000',
    // B16004 - LEP
    B16004_001E: '7000000',
    B16004_003E: '400000',
    // B08136 - commute time
    B08136_001E: '90000000',
    B08136_002E: '3000000',
    // B08301 - commute mode
    B08301_001E: '3000000',
    B08301_002E: '2200000',
    B08301_010E: '150000',
    // B27001 - health insurance
    B27001_001E: '7000000',
    B27001_005E: '560000',
    // B21001 - veterans
    B21001_001E: '5000000',
    B21001_002E: '320000',
    // B18101 - disability
    B18101_001E: '7000000',
    B18101_004E: '560000',
    // B28002 - broadband
    B28002_001E: '2500000',
    B28002_004E: '2050000',
    // B11012 - household composition
    B11012_001E: '2500000',
    B11012_010E: '400000',
    ...overrides,
  };
}

const DATA_GAP: DataGap = {
  description: 'Test data gap',
  primarySources: ['test'],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CandidatePortal.getConstituentProfile', () => {
  let censusClient: CensusClient;
  let fecClient: FecClient;
  let portal: CandidatePortal;

  beforeEach(() => {
    censusClient = new CensusClient();
    fecClient = new FecClient();
    portal = new CandidatePortal(censusClient, fecClient);
  });

  it('1. partial profile: one CensusClient method returns DataGap → dataGaps populated', async () => {
    const acsRow = makeAcsRow();

    // Mock fetchVariable to succeed for most, but fail for B19013_001E (medianHouseholdIncome)
    vi.spyOn(censusClient, 'fetchVariable').mockImplementation(async (variable: string) => {
      if (variable === 'B19013_001E') return DATA_GAP;
      if (variable === 'B01002_001E') return '38.5';
      if (variable === 'B19301_001E') return '42000';
      if (variable === 'B25077_001E') return '280000';
      if (variable === 'B25010_001E') return '2.6';
      return '0';
    });

    // Mock fetchGroup to succeed for all groups
    vi.spyOn(censusClient, 'fetchGroup').mockResolvedValue([acsRow]);

    const profile = await portal.getConstituentProfile({ geoScope: GEO_SCOPE });

    // dataGaps should be populated because economic section failed
    expect(profile.dataGaps.length).toBeGreaterThan(0);
    expect(profile.dataGaps.some((g) => g.description === DATA_GAP.description)).toBe(true);

    // Other sections should still be present (not stub-only)
    expect(profile.demographics.totalPopulation.localValue).not.toBe('N/A');
    expect(profile.housing.medianHomeValue.localValue).not.toBe('N/A');
  });

  it('2. missing FEC key: profile returned with fecFinance.dataGap populated, all other sections present', async () => {
    const acsRow = makeAcsRow();

    vi.spyOn(censusClient, 'fetchVariable').mockImplementation(async (variable: string) => {
      if (variable === 'B01002_001E') return '38.5';
      if (variable === 'B19013_001E') return '65000';
      if (variable === 'B19301_001E') return '42000';
      if (variable === 'B25077_001E') return '280000';
      if (variable === 'B25010_001E') return '2.6';
      return '0';
    });

    vi.spyOn(censusClient, 'fetchGroup').mockResolvedValue([acsRow]);

    // FecClient returns DataGap when no API key
    vi.spyOn(fecClient, 'fetchCandidateTotals').mockResolvedValue({
      description: 'FEC data unavailable: OPEN_FEC_API_KEY environment variable is not set.',
      primarySources: ['api.data.gov'],
    });

    const profile = await portal.getConstituentProfile({
      geoScope: GEO_SCOPE,
      candidateFecId: 'H0AZ01234',
    });

    // fecFinance should have a dataGap
    expect(profile.fecFinance).toBeDefined();
    expect(profile.fecFinance?.dataGap).toBeDefined();
    expect(profile.fecFinance?.dataGap?.description).toContain('FEC data unavailable');

    // All other sections should be present
    expect(profile.demographics).toBeDefined();
    expect(profile.economic).toBeDefined();
    expect(profile.education).toBeDefined();
    expect(profile.housing).toBeDefined();
    expect(profile.laborMarket).toBeDefined();
    expect(profile.languageAccess).toBeDefined();
    expect(profile.commute).toBeDefined();
    expect(profile.healthInsurance).toBeDefined();
    expect(profile.veterans).toBeDefined();
    expect(profile.disability).toBeDefined();
    expect(profile.broadband).toBeDefined();
    expect(profile.householdComposition).toBeDefined();
    expect(profile.civicEngagement).toBeDefined();
  });

  it('3. getConstituentProfile does NOT invoke pipeline layers (no scaffolded/perspectivesVerified/frameworkLabel fields)', async () => {
    const acsRow = makeAcsRow();

    vi.spyOn(censusClient, 'fetchVariable').mockImplementation(async (variable: string) => {
      if (variable === 'B01002_001E') return '38.5';
      if (variable === 'B19013_001E') return '65000';
      if (variable === 'B19301_001E') return '42000';
      if (variable === 'B25077_001E') return '280000';
      if (variable === 'B25010_001E') return '2.6';
      return '0';
    });

    vi.spyOn(censusClient, 'fetchGroup').mockResolvedValue([acsRow]);

    const profile = await portal.getConstituentProfile({ geoScope: GEO_SCOPE });

    // The profile must NOT have pipeline-layer fields
    expect(profile).not.toHaveProperty('scaffolded');
    expect(profile).not.toHaveProperty('perspectivesVerified');
    expect(profile).not.toHaveProperty('frameworkLabel');
  });
});
