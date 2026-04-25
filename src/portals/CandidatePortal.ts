import type {
  ConstituentProfile,
  ConstituentProfileRequest,
  DataGap,
  FinanceRecord,
  GeoScope,
} from '../types/index.js';
import { NATIONAL_AVERAGES } from '../types/index.js';
import { ProfileBuilder } from './ProfileBuilder.js';
import type { CensusClient } from '../data/CensusClient.js';
import type { FecClient } from '../data/FecClient.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDataGap(value: unknown): value is DataGap {
  return (
    value !== null &&
    typeof value === 'object' &&
    'description' in (value as object)
  );
}

function numOrNull(val: string | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isFinite(n) ? n : null;
}

function src(variableCode: string): string {
  return `ACS 5-Year Estimates 2023, ${variableCode}`;
}

// ─── CandidatePortal ──────────────────────────────────────────────────────────

export class CandidatePortal {
  constructor(private censusClient: CensusClient, private fecClient: FecClient) {}

  // ── 12 private fetch methods ────────────────────────────────────────────────

  private async fetchDemographics(geoScope: GeoScope): Promise<ConstituentProfile['demographics'] | DataGap> {
    const [medianAgeResult, ageGroupResult, raceResult, hispanicResult] = await Promise.all([
      this.censusClient.fetchVariable('B01002_001E', geoScope),
      this.censusClient.fetchGroup('B01001', geoScope),
      this.censusClient.fetchGroup('B02001', geoScope),
      this.censusClient.fetchGroup('B03003', geoScope),
    ]);

    if (isDataGap(medianAgeResult)) return medianAgeResult;
    if (isDataGap(ageGroupResult)) return ageGroupResult;

    const row = ageGroupResult[0];
    if (!row) return { description: 'No data rows returned for B01001', primarySources: [] };

    const totalPop = numOrNull(row['B01001_001E']);
    if (totalPop === null) return { description: 'Missing total population B01001_001E', primarySources: [] };

    const medianAge = numOrNull(medianAgeResult as string);

    const totalPopEntry = ProfileBuilder.buildMeasurementEntry(
      'Total Population',
      totalPop,
      NATIONAL_AVERAGES.totalPopulation,
      'count',
      src('B01001_001E'),
    );

    const medianAgeEntry = ProfileBuilder.buildMeasurementEntry(
      'Median Age',
      medianAge ?? 'N/A',
      NATIONAL_AVERAGES.medianAge,
      'years',
      src('B01002_001E'),
    );

    // Age distribution buckets using primary summary variables
    const under18Raw = numOrNull(row['B01001_003E']);
    const age1834Raw = numOrNull(row['B01001_007E']);
    const age3554Raw = numOrNull(row['B01001_012E']);
    const age5564Raw = numOrNull(row['B01001_017E']);
    const age65plusRaw = numOrNull(row['B01001_020E']);

    const ageDistribution: ConstituentProfile['demographics']['ageDistribution'] = [];

    if (under18Raw !== null && totalPop > 0) {
      ageDistribution.push(ProfileBuilder.buildMeasurementEntry('Under 18', (under18Raw / totalPop) * 100, null, 'percent', src('B01001')));
    }
    if (age1834Raw !== null && totalPop > 0) {
      ageDistribution.push(ProfileBuilder.buildMeasurementEntry('Age 18–34', (age1834Raw / totalPop) * 100, null, 'percent', src('B01001')));
    }
    if (age3554Raw !== null && totalPop > 0) {
      ageDistribution.push(ProfileBuilder.buildMeasurementEntry('Age 35–54', (age3554Raw / totalPop) * 100, null, 'percent', src('B01001')));
    }
    if (age5564Raw !== null && totalPop > 0) {
      ageDistribution.push(ProfileBuilder.buildMeasurementEntry('Age 55–64', (age5564Raw / totalPop) * 100, null, 'percent', src('B01001')));
    }
    if (age65plusRaw !== null && totalPop > 0) {
      ageDistribution.push(ProfileBuilder.buildMeasurementEntry('Age 65+', (age65plusRaw / totalPop) * 100, null, 'percent', src('B01001')));
    }

    // Race/ethnicity
    const raceEthnicity: ConstituentProfile['demographics']['raceEthnicity'] = [];

    if (!isDataGap(raceResult) && raceResult[0]) {
      const raceRow = raceResult[0];
      const raceTotalRaw = numOrNull(raceRow['B02001_001E']);
      const whiteRaw = numOrNull(raceRow['B02001_002E']);
      const blackRaw = numOrNull(raceRow['B02001_003E']);
      const asianRaw = numOrNull(raceRow['B02001_005E']);

      if (raceTotalRaw && raceTotalRaw > 0) {
        if (whiteRaw !== null) raceEthnicity.push(ProfileBuilder.buildMeasurementEntry('White alone', (whiteRaw / raceTotalRaw) * 100, null, 'percent', src('B02001_002E')));
        if (blackRaw !== null) raceEthnicity.push(ProfileBuilder.buildMeasurementEntry('Black or African American alone', (blackRaw / raceTotalRaw) * 100, null, 'percent', src('B02001_003E')));
        if (asianRaw !== null) raceEthnicity.push(ProfileBuilder.buildMeasurementEntry('Asian alone', (asianRaw / raceTotalRaw) * 100, null, 'percent', src('B02001_005E')));
      }
    }

    if (!isDataGap(hispanicResult) && hispanicResult[0]) {
      const hispRow = hispanicResult[0];
      const hispTotalRaw = numOrNull(hispRow['B03003_001E']);
      const hispanicRaw = numOrNull(hispRow['B03003_003E']);
      if (hispTotalRaw && hispTotalRaw > 0 && hispanicRaw !== null) {
        raceEthnicity.push(ProfileBuilder.buildMeasurementEntry('Hispanic or Latino', (hispanicRaw / hispTotalRaw) * 100, null, 'percent', src('B03003_003E')));
      }
    }

    return { totalPopulation: totalPopEntry, medianAge: medianAgeEntry, ageDistribution, raceEthnicity };
  }

  private async fetchEconomic(geoScope: GeoScope): Promise<ConstituentProfile['economic'] | DataGap> {
    const [mhiResult, pcResult, povertyResult] = await Promise.all([
      this.censusClient.fetchVariable('B19013_001E', geoScope),
      this.censusClient.fetchVariable('B19301_001E', geoScope),
      this.censusClient.fetchGroup('B17001', geoScope),
    ]);

    if (isDataGap(mhiResult)) return mhiResult;
    if (isDataGap(pcResult)) return pcResult;
    if (isDataGap(povertyResult)) return povertyResult;

    const mhi = numOrNull(mhiResult as string);
    const pci = numOrNull(pcResult as string);

    const row = povertyResult[0];
    const povertyTotal = row ? numOrNull(row['B17001_001E']) : null;
    const povertyBelow = row ? numOrNull(row['B17001_002E']) : null;
    const povertyRate = povertyTotal && povertyBelow !== null && povertyTotal > 0
      ? (povertyBelow / povertyTotal) * 100
      : null;

    return {
      medianHouseholdIncome: ProfileBuilder.buildMeasurementEntry('Median Household Income', mhi ?? 'N/A', NATIONAL_AVERAGES.medianHouseholdIncome, 'dollars', src('B19013_001E')),
      perCapitaIncome: ProfileBuilder.buildMeasurementEntry('Per Capita Income', pci ?? 'N/A', NATIONAL_AVERAGES.perCapitaIncome, 'dollars', src('B19301_001E')),
      povertyRate: ProfileBuilder.buildMeasurementEntry('Poverty Rate', povertyRate ?? 'N/A', NATIONAL_AVERAGES.povertyRate, 'percent', src('B17001')),
    };
  }

  private async fetchEducation(geoScope: GeoScope): Promise<ConstituentProfile['education'] | DataGap> {
    const result = await this.censusClient.fetchGroup('B15003', geoScope);
    if (isDataGap(result)) return result;

    const row = result[0];
    if (!row) return { description: 'No data rows returned for B15003', primarySources: [] };

    const total = numOrNull(row['B15003_001E']);
    const hsGrad = numOrNull(row['B15003_017E']);
    const bachelors = numOrNull(row['B15003_022E']);

    const hsRate = total && hsGrad !== null && total > 0 ? (hsGrad / total) * 100 : null;
    const bachRate = total && bachelors !== null && total > 0 ? (bachelors / total) * 100 : null;

    return {
      highSchoolGradRate: ProfileBuilder.buildMeasurementEntry('High School Graduation Rate', hsRate ?? 'N/A', NATIONAL_AVERAGES.highSchoolGradRate, 'percent', src('B15003')),
      bachelorsDegreeRate: ProfileBuilder.buildMeasurementEntry("Bachelor's Degree Rate", bachRate ?? 'N/A', NATIONAL_AVERAGES.bachelorsDegreeRate, 'percent', src('B15003')),
    };
  }

  private async fetchHousing(geoScope: GeoScope): Promise<ConstituentProfile['housing'] | DataGap> {
    const [homeValueResult, tenureResult] = await Promise.all([
      this.censusClient.fetchVariable('B25077_001E', geoScope),
      this.censusClient.fetchGroup('B25003', geoScope),
    ]);

    if (isDataGap(homeValueResult)) return homeValueResult;
    if (isDataGap(tenureResult)) return tenureResult;

    const homeValue = numOrNull(homeValueResult as string);
    const row = tenureResult[0];
    const total = row ? numOrNull(row['B25003_001E']) : null;
    const ownerOcc = row ? numOrNull(row['B25003_002E']) : null;
    const renterOcc = row ? numOrNull(row['B25003_003E']) : null;

    const ownerRate = total && ownerOcc !== null && total > 0 ? (ownerOcc / total) * 100 : null;
    const renterRate = total && renterOcc !== null && total > 0 ? (renterOcc / total) * 100 : null;

    return {
      medianHomeValue: ProfileBuilder.buildMeasurementEntry('Median Home Value', homeValue ?? 'N/A', NATIONAL_AVERAGES.medianHomeValue, 'dollars', src('B25077_001E')),
      ownerOccupiedRate: ProfileBuilder.buildMeasurementEntry('Owner-Occupied Rate', ownerRate ?? 'N/A', NATIONAL_AVERAGES.ownerOccupiedRate, 'percent', src('B25003')),
      renterOccupiedRate: ProfileBuilder.buildMeasurementEntry('Renter-Occupied Rate', renterRate ?? 'N/A', NATIONAL_AVERAGES.renterOccupiedRate, 'percent', src('B25003')),
    };
  }

  private async fetchLaborMarket(geoScope: GeoScope): Promise<ConstituentProfile['laborMarket'] | DataGap> {
    const [laborResult, sectorsResult, occupResult] = await Promise.all([
      this.censusClient.fetchGroup('B23025', geoScope),
      this.censusClient.fetchGroup('C24050', geoScope),
      this.censusClient.fetchGroup('C24010', geoScope),
    ]);

    if (isDataGap(laborResult)) return laborResult;

    const row = laborResult[0];
    const laborForce = row ? numOrNull(row['B23025_002E']) : null;
    const unemployed = row ? numOrNull(row['B23025_005E']) : null;
    const unemploymentRate = laborForce && unemployed !== null && laborForce > 0
      ? (unemployed / laborForce) * 100
      : null;

    const topEmploymentSectors: ConstituentProfile['laborMarket']['topEmploymentSectors'] = [];
    if (!isDataGap(sectorsResult) && sectorsResult[0]) {
      const sRow = sectorsResult[0];
      const sTotal = numOrNull(sRow['C24050_001E']);
      if (sTotal && sTotal > 0) {
        const sectors: Array<[string, string]> = [
          ['Agriculture', 'C24050_002E'],
          ['Construction', 'C24050_003E'],
          ['Manufacturing', 'C24050_004E'],
          ['Wholesale trade', 'C24050_005E'],
          ['Retail trade', 'C24050_006E'],
        ];
        for (const [name, code] of sectors) {
          const val = numOrNull(sRow[code]);
          if (val !== null) {
            topEmploymentSectors.push(ProfileBuilder.buildMeasurementEntry(name, (val / sTotal) * 100, null, 'percent', src(code)));
          }
        }
      }
    }

    const medianEarningsByOccupation: ConstituentProfile['laborMarket']['medianEarningsByOccupation'] = [];
    if (!isDataGap(occupResult) && occupResult[0]) {
      const oRow = occupResult[0];
      const mgmtEarnings = numOrNull(oRow['C24010_003E']);
      const serviceEarnings = numOrNull(oRow['C24010_019E']);
      if (mgmtEarnings !== null) {
        medianEarningsByOccupation.push(ProfileBuilder.buildMeasurementEntry('Management/Professional earnings', mgmtEarnings, null, 'dollars', src('C24010_003E')));
      }
      if (serviceEarnings !== null) {
        medianEarningsByOccupation.push(ProfileBuilder.buildMeasurementEntry('Service occupation earnings', serviceEarnings, null, 'dollars', src('C24010_019E')));
      }
    }

    return {
      unemploymentRate: ProfileBuilder.buildMeasurementEntry('Unemployment Rate', unemploymentRate ?? 'N/A', NATIONAL_AVERAGES.unemploymentRate, 'percent', src('B23025')),
      topEmploymentSectors,
      medianEarningsByOccupation,
    };
  }

  private async fetchLanguageAccess(geoScope: GeoScope): Promise<ConstituentProfile['languageAccess'] | DataGap> {
    const [langResult, lepResult] = await Promise.all([
      this.censusClient.fetchGroup('B16002', geoScope),
      this.censusClient.fetchGroup('B16004', geoScope),
    ]);

    if (isDataGap(langResult)) return langResult;
    if (isDataGap(lepResult)) return lepResult;

    const langRow = langResult[0];
    const langTotal = langRow ? numOrNull(langRow['B16002_001E']) : null;
    const nonEnglish = langRow ? numOrNull(langRow['B16002_003E']) : null;
    const nonEnglishRate = langTotal && nonEnglish !== null && langTotal > 0
      ? (nonEnglish / langTotal) * 100
      : null;

    const lepRow = lepResult[0];
    const lepTotal = lepRow ? numOrNull(lepRow['B16004_001E']) : null;
    const lepCount = lepRow ? numOrNull(lepRow['B16004_003E']) : null;
    const lepRate = lepTotal && lepCount !== null && lepTotal > 0
      ? (lepCount / lepTotal) * 100
      : null;

    return {
      nonEnglishHouseholdRate: ProfileBuilder.buildMeasurementEntry('Non-English Household Rate', nonEnglishRate ?? 'N/A', NATIONAL_AVERAGES.nonEnglishHouseholdRate, 'percent', src('B16002')),
      limitedEnglishProficiencyRate: ProfileBuilder.buildMeasurementEntry('Limited English Proficiency Rate', lepRate ?? 'N/A', NATIONAL_AVERAGES.limitedEnglishProficiencyRate, 'percent', src('B16004')),
    };
  }

  private async fetchCommute(geoScope: GeoScope): Promise<ConstituentProfile['commute'] | DataGap> {
    const [timeResult, modeResult] = await Promise.all([
      this.censusClient.fetchGroup('B08136', geoScope),
      this.censusClient.fetchGroup('B08301', geoScope),
    ]);

    if (isDataGap(timeResult)) return timeResult;
    if (isDataGap(modeResult)) return modeResult;

    const timeRow = timeResult[0];
    const aggregate = timeRow ? numOrNull(timeRow['B08136_001E']) : null;
    const workers = timeRow ? numOrNull(timeRow['B08136_002E']) : null;
    const meanTime = aggregate !== null && workers !== null && workers > 0
      ? aggregate / workers
      : null;

    const modeRow = modeResult[0];
    const modeTotal = modeRow ? numOrNull(modeRow['B08301_001E']) : null;
    const driveAlone = modeRow ? numOrNull(modeRow['B08301_002E']) : null;
    const publicTransit = modeRow ? numOrNull(modeRow['B08301_010E']) : null;

    const driveRate = modeTotal && driveAlone !== null && modeTotal > 0 ? (driveAlone / modeTotal) * 100 : null;
    const transitRate = modeTotal && publicTransit !== null && modeTotal > 0 ? (publicTransit / modeTotal) * 100 : null;

    return {
      meanTravelTimeMinutes: ProfileBuilder.buildMeasurementEntry('Mean Travel Time to Work', meanTime ?? 'N/A', NATIONAL_AVERAGES.meanTravelTimeMinutes, 'minutes', src('B08136')),
      driveAloneRate: ProfileBuilder.buildMeasurementEntry('Drive Alone Rate', driveRate ?? 'N/A', NATIONAL_AVERAGES.driveAloneRate, 'percent', src('B08301')),
      publicTransitRate: ProfileBuilder.buildMeasurementEntry('Public Transit Rate', transitRate ?? 'N/A', NATIONAL_AVERAGES.publicTransitRate, 'percent', src('B08301')),
    };
  }

  private async fetchHealthInsurance(geoScope: GeoScope): Promise<ConstituentProfile['healthInsurance'] | DataGap> {
    const result = await this.censusClient.fetchGroup('B27001', geoScope);
    if (isDataGap(result)) return result;

    const row = result[0];
    const total = row ? numOrNull(row['B27001_001E']) : null;
    const uninsured = row ? numOrNull(row['B27001_005E']) : null;
    const uninsuredRate = total && uninsured !== null && total > 0 ? (uninsured / total) * 100 : null;

    return {
      uninsuredRate: ProfileBuilder.buildMeasurementEntry('Uninsured Rate', uninsuredRate ?? 'N/A', NATIONAL_AVERAGES.uninsuredRate, 'percent', src('B27001')),
    };
  }

  private async fetchVeterans(geoScope: GeoScope): Promise<ConstituentProfile['veterans'] | DataGap> {
    const result = await this.censusClient.fetchGroup('B21001', geoScope);
    if (isDataGap(result)) return result;

    const row = result[0];
    const total = row ? numOrNull(row['B21001_001E']) : null;
    const veterans = row ? numOrNull(row['B21001_002E']) : null;
    const veteranRate = total && veterans !== null && total > 0 ? (veterans / total) * 100 : null;

    return {
      veteranRate: ProfileBuilder.buildMeasurementEntry('Veteran Rate', veteranRate ?? 'N/A', NATIONAL_AVERAGES.veteranRate, 'percent', src('B21001')),
    };
  }

  private async fetchDisability(geoScope: GeoScope): Promise<ConstituentProfile['disability'] | DataGap> {
    const result = await this.censusClient.fetchGroup('B18101', geoScope);
    if (isDataGap(result)) return result;

    const row = result[0];
    const total = row ? numOrNull(row['B18101_001E']) : null;
    const withDisability = row ? numOrNull(row['B18101_004E']) : null;
    const disabilityRate = total && withDisability !== null && total > 0 ? (withDisability / total) * 100 : null;

    return {
      disabilityRateUnder65: ProfileBuilder.buildMeasurementEntry('Disability Rate (Under 65)', disabilityRate ?? 'N/A', NATIONAL_AVERAGES.disabilityRateUnder65, 'percent', src('B18101')),
    };
  }

  private async fetchBroadband(geoScope: GeoScope): Promise<ConstituentProfile['broadband'] | DataGap> {
    const result = await this.censusClient.fetchGroup('B28002', geoScope);
    if (isDataGap(result)) return result;

    const row = result[0];
    const total = row ? numOrNull(row['B28002_001E']) : null;
    const broadband = row ? numOrNull(row['B28002_004E']) : null;
    const broadbandRate = total && broadband !== null && total > 0 ? (broadband / total) * 100 : null;

    return {
      broadbandSubscriptionRate: ProfileBuilder.buildMeasurementEntry('Broadband Subscription Rate', broadbandRate ?? 'N/A', NATIONAL_AVERAGES.broadbandSubscriptionRate, 'percent', src('B28002')),
    };
  }

  private async fetchHouseholdComposition(geoScope: GeoScope): Promise<ConstituentProfile['householdComposition'] | DataGap> {
    const [avgSizeResult, compositionResult] = await Promise.all([
      this.censusClient.fetchVariable('B25010_001E', geoScope),
      this.censusClient.fetchGroup('B11012', geoScope),
    ]);

    if (isDataGap(avgSizeResult)) return avgSizeResult;
    if (isDataGap(compositionResult)) return compositionResult;

    const avgSize = numOrNull(avgSizeResult as string);

    const row = compositionResult[0];
    const total = row ? numOrNull(row['B11012_001E']) : null;
    const singleParent = row ? numOrNull(row['B11012_010E']) : null;
    const singleParentRate = total && singleParent !== null && total > 0 ? (singleParent / total) * 100 : null;

    return {
      averageHouseholdSize: ProfileBuilder.buildMeasurementEntry('Average Household Size', avgSize ?? 'N/A', NATIONAL_AVERAGES.averageHouseholdSize, 'persons', src('B25010_001E')),
      singleParentHouseholdRate: ProfileBuilder.buildMeasurementEntry('Single-Parent Household Rate', singleParentRate ?? 'N/A', NATIONAL_AVERAGES.singleParentHouseholdRate, 'percent', src('B11012')),
    };
  }

  // ── getConstituentProfile ───────────────────────────────────────────────────

  async getConstituentProfile(request: ConstituentProfileRequest): Promise<ConstituentProfile> {
    const { geoScope, candidateFecId } = request;

    const [
      demographics,
      economic,
      education,
      housing,
      laborMarket,
      languageAccess,
      commute,
      healthInsurance,
      veterans,
      disability,
      broadband,
      householdComposition,
      fecResult,
    ] = await Promise.allSettled([
      this.fetchDemographics(geoScope),
      this.fetchEconomic(geoScope),
      this.fetchEducation(geoScope),
      this.fetchHousing(geoScope),
      this.fetchLaborMarket(geoScope),
      this.fetchLanguageAccess(geoScope),
      this.fetchCommute(geoScope),
      this.fetchHealthInsurance(geoScope),
      this.fetchVeterans(geoScope),
      this.fetchDisability(geoScope),
      this.fetchBroadband(geoScope),
      this.fetchHouseholdComposition(geoScope),
      candidateFecId
        ? this.fecClient.fetchCandidateTotals(candidateFecId)
        : Promise.resolve(null),
    ]);

    const dataGaps: DataGap[] = [];

    function unwrap<T>(result: PromiseSettledResult<T | DataGap>, fallback: T): T {
      if (result.status === 'rejected') {
        dataGaps.push({ description: String(result.reason), primarySources: [] });
        return fallback;
      }
      if (result.value !== null && typeof result.value === 'object' && 'description' in result.value) {
        dataGaps.push(result.value as DataGap);
        return fallback;
      }
      return result.value as T;
    }

    const stubEntry = ProfileBuilder.buildMeasurementEntry('Data unavailable', 'N/A', null, '', 'ACS');

    const profile: ConstituentProfile = {
      geoScope,
      generatedAt: new Date().toISOString(),
      demographics: unwrap(demographics, {
        totalPopulation: stubEntry,
        medianAge: stubEntry,
        ageDistribution: [],
        raceEthnicity: [],
      }),
      economic: unwrap(economic, {
        medianHouseholdIncome: stubEntry,
        perCapitaIncome: stubEntry,
        povertyRate: stubEntry,
      }),
      education: unwrap(education, {
        highSchoolGradRate: stubEntry,
        bachelorsDegreeRate: stubEntry,
      }),
      housing: unwrap(housing, {
        medianHomeValue: stubEntry,
        ownerOccupiedRate: stubEntry,
        renterOccupiedRate: stubEntry,
      }),
      laborMarket: unwrap(laborMarket, {
        unemploymentRate: stubEntry,
        topEmploymentSectors: [],
        medianEarningsByOccupation: [],
      }),
      languageAccess: unwrap(languageAccess, {
        nonEnglishHouseholdRate: stubEntry,
        limitedEnglishProficiencyRate: stubEntry,
      }),
      commute: unwrap(commute, {
        meanTravelTimeMinutes: stubEntry,
        driveAloneRate: stubEntry,
        publicTransitRate: stubEntry,
      }),
      healthInsurance: unwrap(healthInsurance, { uninsuredRate: stubEntry }),
      veterans: unwrap(veterans, { veteranRate: stubEntry }),
      disability: unwrap(disability, { disabilityRateUnder65: stubEntry }),
      broadband: unwrap(broadband, { broadbandSubscriptionRate: stubEntry }),
      householdComposition: unwrap(householdComposition, {
        averageHouseholdSize: stubEntry,
        singleParentHouseholdRate: stubEntry,
      }),
      civicEngagement: {
        totalRegisteredVoters: ProfileBuilder.buildMeasurementEntry(
          'Total Registered Voters',
          'Data not available via ACS API',
          null,
          'count',
          'Arizona Secretary of State (azsos.gov)',
        ),
        voterTurnoutRate: ProfileBuilder.buildMeasurementEntry(
          'Voter Turnout Rate',
          'Data not available via ACS API',
          null,
          'percent',
          'Arizona Secretary of State (azsos.gov)',
        ),
      },
      keyIssuesContext: [],
      dataGaps,
    };

    // Handle FEC finance
    if (candidateFecId && fecResult.status === 'fulfilled' && fecResult.value !== null) {
      const fecValue = fecResult.value;
      if (isDataGap(fecValue)) {
        profile.fecFinance = { raceTotals: [], dataGap: fecValue as DataGap };
      } else {
        const record = fecValue as FinanceRecord;
        profile.fecFinance = {
          candidateTotals: [
            ProfileBuilder.buildMeasurementEntry(
              'Total Raised',
              record.totalRaised,
              null,
              'dollars',
              `OpenFEC API, ${record.reportingPeriod.start}–${record.reportingPeriod.end}`,
            ),
          ],
          raceTotals: [],
        };
      }
    }

    // Compute key issues
    profile.keyIssuesContext = ProfileBuilder.computeKeyIssues(profile);

    return profile;
  }
}
