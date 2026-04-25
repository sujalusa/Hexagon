import type { MeasurementEntry, KeyIssuesContext, ConstituentProfile } from '../types/index.js';

function collectAllEntries(profile: ConstituentProfile): MeasurementEntry[] {
  const entries: MeasurementEntry[] = [];
  // demographics
  entries.push(profile.demographics.totalPopulation, profile.demographics.medianAge);
  entries.push(...profile.demographics.ageDistribution, ...profile.demographics.raceEthnicity);
  // economic
  entries.push(profile.economic.medianHouseholdIncome, profile.economic.perCapitaIncome, profile.economic.povertyRate);
  // education
  entries.push(profile.education.highSchoolGradRate, profile.education.bachelorsDegreeRate);
  // housing
  entries.push(profile.housing.medianHomeValue, profile.housing.ownerOccupiedRate, profile.housing.renterOccupiedRate);
  // laborMarket
  entries.push(profile.laborMarket.unemploymentRate, ...profile.laborMarket.topEmploymentSectors, ...profile.laborMarket.medianEarningsByOccupation);
  // languageAccess
  entries.push(profile.languageAccess.nonEnglishHouseholdRate, profile.languageAccess.limitedEnglishProficiencyRate);
  // commute
  entries.push(profile.commute.meanTravelTimeMinutes, profile.commute.driveAloneRate, profile.commute.publicTransitRate);
  // healthInsurance
  entries.push(profile.healthInsurance.uninsuredRate);
  // veterans
  entries.push(profile.veterans.veteranRate);
  // disability
  entries.push(profile.disability.disabilityRateUnder65);
  // broadband
  entries.push(profile.broadband.broadbandSubscriptionRate);
  // householdComposition
  entries.push(profile.householdComposition.averageHouseholdSize, profile.householdComposition.singleParentHouseholdRate);
  // civicEngagement
  entries.push(profile.civicEngagement.totalRegisteredVoters, profile.civicEngagement.voterTurnoutRate);
  // fecFinance (optional)
  if (profile.fecFinance) {
    if (profile.fecFinance.candidateTotals) entries.push(...profile.fecFinance.candidateTotals);
    entries.push(...profile.fecFinance.raceTotals);
  }
  return entries;
}

export class ProfileBuilder {
  static buildMeasurementEntry(
    metricName: string,
    localValue: number | string,
    nationalAverage: number | string | null,
    unit: string,
    source: string,
    cachedAt?: string,
  ): MeasurementEntry {
    return { metricName, localValue, nationalAverage, unit, source, cachedAt };
  }

  static computeDivergence(local: number | string, national: number | string): number {
    const l = Number(local);
    const n = Number(national);
    if (!isFinite(l) || !isFinite(n)) return 0;
    return Math.abs(l - n);
  }

  static computeKeyIssues(profile: ConstituentProfile): KeyIssuesContext[] {
    const entries = collectAllEntries(profile);

    const numeric = entries.filter((e) => {
      const localOk =
        typeof e.localValue === 'number' || isFinite(Number(e.localValue));
      const nationalOk = e.nationalAverage !== null;
      return localOk && nationalOk;
    });

    const withDivergence = numeric.map((e) => ({
      metricName: e.metricName,
      localValue: e.localValue,
      nationalAverage: e.nationalAverage as number | string,
      divergenceMagnitude: ProfileBuilder.computeDivergence(e.localValue, e.nationalAverage as number | string),
      unit: e.unit,
      source: e.source,
    }));

    withDivergence.sort((a, b) => b.divergenceMagnitude - a.divergenceMagnitude);

    return withDivergence.slice(0, 5);
  }
}
