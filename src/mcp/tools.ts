/**
 * MCP-style tool registry for Hexagon datasets.
 * Each tool maps a user intent to a real dataset query.
 * Tools return structured data with source citations — never opinions.
 */

import { CensusClient } from '../data/CensusClient.js';
import { FecClient } from '../data/FecClient.js';
import { ProfileBuilder } from '../portals/ProfileBuilder.js';
import { NATIONAL_AVERAGES } from '../types/index.js';
import type { GeoScope, DataGap, MeasurementEntry } from '../types/index.js';

// ─── Tool Definition ──────────────────────────────────────────────────────────

export interface McpTool {
  name: string;
  description: string;
  keywords: string[];
  execute(params: ToolParams): Promise<ToolResult>;
}

export interface ToolParams {
  query: string;
  geoScope: GeoScope;
  entityId?: string;
}

export interface ToolResult {
  toolName: string;
  data: MeasurementEntry[];
  narrative: string;
  sources: string[];
  dataGaps: DataGap[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function numOrNull(val: string | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isFinite(n) ? n : null;
}

function pct(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function fmtNum(val: number | string | null, unit: string): string {
  if (val === null || val === 'N/A') return 'data unavailable';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (unit === 'dollars') return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (unit === 'percent') return n.toFixed(1) + '%';
  if (unit === 'count') return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (unit === 'years') return n.toFixed(1) + ' years';
  if (unit === 'minutes') return n.toFixed(0) + ' minutes';
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function src(code: string): string {
  return `ACS 5-Year Estimates 2023, ${code}`;
}

// ─── Tool Registry ────────────────────────────────────────────────────────────

export function createToolRegistry(census: CensusClient, fec: FecClient): McpTool[] {
  return [
    // ── Demographics ────────────────────────────────────────────────────────
    {
      name: 'demographics_overview',
      description: 'Population, median age, age distribution, race/ethnicity',
      keywords: ['population', 'people', 'residents', 'age', 'median age', 'demographics', 'race', 'ethnicity', 'hispanic', 'white', 'black', 'asian', 'how many people', 'who lives'],
      async execute(params) {
        const data: MeasurementEntry[] = [];
        const gaps: DataGap[] = [];

        const ageResult = await census.fetchVariable('B01002_001E', params.geoScope);
        const popResult = await census.fetchGroup('B01001', params.geoScope);
        const raceResult = await census.fetchGroup('B02001', params.geoScope);

        if (typeof ageResult === 'string') {
          const age = numOrNull(ageResult);
          if (age !== null) data.push(ProfileBuilder.buildMeasurementEntry('Median Age', age, NATIONAL_AVERAGES.medianAge, 'years', src('B01002_001E')));
        } else { gaps.push(ageResult); }

        if (Array.isArray(popResult) && popResult[0]) {
          const row = popResult[0];
          const totalPop = numOrNull(row['B01001_001E']);
          if (totalPop !== null) data.push(ProfileBuilder.buildMeasurementEntry('Total Population', totalPop, NATIONAL_AVERAGES.totalPopulation, 'count', src('B01001_001E')));
        } else if (!Array.isArray(popResult)) { gaps.push(popResult); }

        if (Array.isArray(raceResult) && raceResult[0]) {
          const r = raceResult[0];
          const total = numOrNull(r['B02001_001E']);
          if (total && total > 0) {
            const white = numOrNull(r['B02001_002E']);
            const black = numOrNull(r['B02001_003E']);
            const asian = numOrNull(r['B02001_005E']);
            if (white !== null) data.push(ProfileBuilder.buildMeasurementEntry('White alone', pct(white, total)!, null, 'percent', src('B02001_002E')));
            if (black !== null) data.push(ProfileBuilder.buildMeasurementEntry('Black or African American', pct(black, total)!, null, 'percent', src('B02001_003E')));
            if (asian !== null) data.push(ProfileBuilder.buildMeasurementEntry('Asian', pct(asian, total)!, null, 'percent', src('B02001_005E')));
          }
        }

        const narrative = data.length > 0
          ? `Based on ACS 2023 data: ${data.map(d => `${d.metricName} is ${fmtNum(d.localValue, d.unit)}${d.nationalAverage !== null ? ` (US average: ${fmtNum(d.nationalAverage, d.unit)})` : ''}`).join('. ')}.`
          : 'Demographic data is currently unavailable for this geography.';

        return { toolName: 'demographics_overview', data, narrative, sources: ['api.census.gov', 'ACS 5-Year 2023'], dataGaps: gaps };
      }
    },

    // ── Economic ────────────────────────────────────────────────────────────
    {
      name: 'economic_profile',
      description: 'Median household income, per capita income, poverty rate',
      keywords: ['income', 'salary', 'money', 'earn', 'poverty', 'poor', 'wealthy', 'rich', 'economic', 'median household', 'per capita', 'how much do people make', 'cost of living'],
      async execute(params) {
        const data: MeasurementEntry[] = [];
        const gaps: DataGap[] = [];

        const mhi = await census.fetchVariable('B19013_001E', params.geoScope);
        const pci = await census.fetchVariable('B19301_001E', params.geoScope);
        const povResult = await census.fetchGroup('B17001', params.geoScope);

        if (typeof mhi === 'string') {
          const v = numOrNull(mhi);
          if (v !== null) data.push(ProfileBuilder.buildMeasurementEntry('Median Household Income', v, NATIONAL_AVERAGES.medianHouseholdIncome, 'dollars', src('B19013_001E')));
        } else { gaps.push(mhi); }

        if (typeof pci === 'string') {
          const v = numOrNull(pci);
          if (v !== null) data.push(ProfileBuilder.buildMeasurementEntry('Per Capita Income', v, NATIONAL_AVERAGES.perCapitaIncome, 'dollars', src('B19301_001E')));
        } else { gaps.push(pci); }

        if (Array.isArray(povResult) && povResult[0]) {
          const row = povResult[0];
          const total = numOrNull(row['B17001_001E']);
          const below = numOrNull(row['B17001_002E']);
          const rate = pct(below, total);
          if (rate !== null) data.push(ProfileBuilder.buildMeasurementEntry('Poverty Rate', rate, NATIONAL_AVERAGES.povertyRate, 'percent', src('B17001')));
        } else if (!Array.isArray(povResult)) { gaps.push(povResult); }

        const narrative = data.length > 0
          ? `Economic data from ACS 2023: ${data.map(d => `${d.metricName} is ${fmtNum(d.localValue, d.unit)}${d.nationalAverage !== null ? ` (US average: ${fmtNum(d.nationalAverage, d.unit)})` : ''}`).join('. ')}.`
          : 'Economic data is currently unavailable for this geography.';

        return { toolName: 'economic_profile', data, narrative, sources: ['api.census.gov', 'ACS 5-Year 2023'], dataGaps: gaps };
      }
    },

    // ── Housing ─────────────────────────────────────────────────────────────
    {
      name: 'housing_data',
      description: 'Median home value, owner vs renter rates',
      keywords: ['housing', 'home', 'house', 'rent', 'renter', 'owner', 'property', 'home value', 'mortgage', 'apartment', 'median home'],
      async execute(params) {
        const data: MeasurementEntry[] = [];
        const gaps: DataGap[] = [];

        const hvResult = await census.fetchVariable('B25077_001E', params.geoScope);
        const tenureResult = await census.fetchGroup('B25003', params.geoScope);

        if (typeof hvResult === 'string') {
          const v = numOrNull(hvResult);
          if (v !== null) data.push(ProfileBuilder.buildMeasurementEntry('Median Home Value', v, NATIONAL_AVERAGES.medianHomeValue, 'dollars', src('B25077_001E')));
        } else { gaps.push(hvResult); }

        if (Array.isArray(tenureResult) && tenureResult[0]) {
          const row = tenureResult[0];
          const total = numOrNull(row['B25003_001E']);
          const owner = numOrNull(row['B25003_002E']);
          const renter = numOrNull(row['B25003_003E']);
          if (pct(owner, total) !== null) data.push(ProfileBuilder.buildMeasurementEntry('Owner-Occupied Rate', pct(owner, total)!, NATIONAL_AVERAGES.ownerOccupiedRate, 'percent', src('B25003')));
          if (pct(renter, total) !== null) data.push(ProfileBuilder.buildMeasurementEntry('Renter-Occupied Rate', pct(renter, total)!, NATIONAL_AVERAGES.renterOccupiedRate, 'percent', src('B25003')));
        } else if (!Array.isArray(tenureResult)) { gaps.push(tenureResult); }

        const narrative = data.length > 0
          ? `Housing data from ACS 2023: ${data.map(d => `${d.metricName} is ${fmtNum(d.localValue, d.unit)}${d.nationalAverage !== null ? ` (US average: ${fmtNum(d.nationalAverage, d.unit)})` : ''}`).join('. ')}.`
          : 'Housing data is currently unavailable.';

        return { toolName: 'housing_data', data, narrative, sources: ['api.census.gov', 'ACS 5-Year 2023'], dataGaps: gaps };
      }
    },

    // ── Health & Community ──────────────────────────────────────────────────
    {
      name: 'health_community',
      description: 'Uninsured rate, veteran rate, disability rate, broadband access',
      keywords: ['health', 'insurance', 'uninsured', 'veteran', 'military', 'disability', 'disabled', 'broadband', 'internet', 'wifi', 'healthcare', 'coverage'],
      async execute(params) {
        const data: MeasurementEntry[] = [];
        const gaps: DataGap[] = [];

        const insResult = await census.fetchGroup('B27001', params.geoScope);
        const vetResult = await census.fetchGroup('B21001', params.geoScope);
        const bbResult = await census.fetchGroup('B28002', params.geoScope);

        if (Array.isArray(insResult) && insResult[0]) {
          const row = insResult[0];
          const total = numOrNull(row['B27001_001E']);
          const unins = numOrNull(row['B27001_005E']);
          const rate = pct(unins, total);
          if (rate !== null) data.push(ProfileBuilder.buildMeasurementEntry('Uninsured Rate', rate, NATIONAL_AVERAGES.uninsuredRate, 'percent', src('B27001')));
        } else if (!Array.isArray(insResult)) { gaps.push(insResult); }

        if (Array.isArray(vetResult) && vetResult[0]) {
          const row = vetResult[0];
          const total = numOrNull(row['B21001_001E']);
          const vets = numOrNull(row['B21001_002E']);
          const rate = pct(vets, total);
          if (rate !== null) data.push(ProfileBuilder.buildMeasurementEntry('Veteran Rate', rate, NATIONAL_AVERAGES.veteranRate, 'percent', src('B21001')));
        } else if (!Array.isArray(vetResult)) { gaps.push(vetResult); }

        if (Array.isArray(bbResult) && bbResult[0]) {
          const row = bbResult[0];
          const total = numOrNull(row['B28002_001E']);
          const bb = numOrNull(row['B28002_004E']);
          const rate = pct(bb, total);
          if (rate !== null) data.push(ProfileBuilder.buildMeasurementEntry('Broadband Subscription Rate', rate, NATIONAL_AVERAGES.broadbandSubscriptionRate, 'percent', src('B28002')));
        } else if (!Array.isArray(bbResult)) { gaps.push(bbResult); }

        const narrative = data.length > 0
          ? `Community data from ACS 2023: ${data.map(d => `${d.metricName} is ${fmtNum(d.localValue, d.unit)}${d.nationalAverage !== null ? ` (US average: ${fmtNum(d.nationalAverage, d.unit)})` : ''}`).join('. ')}.`
          : 'Community data is currently unavailable.';

        return { toolName: 'health_community', data, narrative, sources: ['api.census.gov', 'ACS 5-Year 2023'], dataGaps: gaps };
      }
    },

    // ── Education ───────────────────────────────────────────────────────────
    {
      name: 'education_data',
      description: 'High school graduation rate, bachelor\'s degree rate',
      keywords: ['education', 'school', 'college', 'degree', 'graduate', 'diploma', 'university', 'bachelor', 'high school', 'literacy'],
      async execute(params) {
        const data: MeasurementEntry[] = [];
        const gaps: DataGap[] = [];

        const result = await census.fetchGroup('B15003', params.geoScope);
        if (Array.isArray(result) && result[0]) {
          const row = result[0];
          const total = numOrNull(row['B15003_001E']);
          const hs = numOrNull(row['B15003_017E']);
          const bach = numOrNull(row['B15003_022E']);
          if (pct(hs, total) !== null) data.push(ProfileBuilder.buildMeasurementEntry('High School Graduation Rate', pct(hs, total)!, NATIONAL_AVERAGES.highSchoolGradRate, 'percent', src('B15003')));
          if (pct(bach, total) !== null) data.push(ProfileBuilder.buildMeasurementEntry("Bachelor's Degree Rate", pct(bach, total)!, NATIONAL_AVERAGES.bachelorsDegreeRate, 'percent', src('B15003')));
        } else if (!Array.isArray(result)) { gaps.push(result); }

        const narrative = data.length > 0
          ? `Education data from ACS 2023: ${data.map(d => `${d.metricName} is ${fmtNum(d.localValue, d.unit)} (US average: ${fmtNum(d.nationalAverage, d.unit)})`).join('. ')}.`
          : 'Education data is currently unavailable.';

        return { toolName: 'education_data', data, narrative, sources: ['api.census.gov', 'ACS 5-Year 2023'], dataGaps: gaps };
      }
    },

    // ── FEC Finance ─────────────────────────────────────────────────────────
    {
      name: 'fec_finance',
      description: 'Campaign finance data for Arizona candidates',
      keywords: ['finance', 'campaign', 'donation', 'fundrais', 'fec', 'money raised', 'spending', 'contribution', 'pac', 'candidate finance'],
      async execute(params) {
        const data: MeasurementEntry[] = [];
        const gaps: DataGap[] = [];

        if (params.entityId) {
          const result = await fec.fetchCandidateTotals(params.entityId);
          if ('description' in result) {
            gaps.push(result);
          } else {
            data.push(ProfileBuilder.buildMeasurementEntry('Total Raised', result.totalRaised, null, 'dollars', `OpenFEC API, ${result.reportingPeriod.start}–${result.reportingPeriod.end}`));
          }
        } else {
          const result = await fec.fetchCandidates('AZ');
          if ('description' in result) {
            gaps.push(result);
          } else {
            for (const c of result.results.slice(0, 5)) {
              data.push(ProfileBuilder.buildMeasurementEntry(c.name, c.candidate_id, null, 'text', 'OpenFEC API'));
            }
          }
        }

        const narrative = data.length > 0
          ? `FEC data: ${data.map(d => `${d.metricName}: ${fmtNum(d.localValue, d.unit)}`).join('. ')}.`
          : gaps.length > 0 ? gaps[0].description : 'No FEC data available.';

        return { toolName: 'fec_finance', data, narrative, sources: ['api.open.fec.gov'], dataGaps: gaps };
      }
    },

    // ── Labor Market ────────────────────────────────────────────────────────
    {
      name: 'labor_market',
      description: 'Unemployment rate, employment sectors',
      keywords: ['job', 'employment', 'unemployment', 'work', 'labor', 'career', 'sector', 'industry', 'occupation', 'hiring'],
      async execute(params) {
        const data: MeasurementEntry[] = [];
        const gaps: DataGap[] = [];

        const result = await census.fetchGroup('B23025', params.geoScope);
        if (Array.isArray(result) && result[0]) {
          const row = result[0];
          const laborForce = numOrNull(row['B23025_002E']);
          const unemployed = numOrNull(row['B23025_005E']);
          const rate = pct(unemployed, laborForce);
          if (rate !== null) data.push(ProfileBuilder.buildMeasurementEntry('Unemployment Rate', rate, NATIONAL_AVERAGES.unemploymentRate, 'percent', src('B23025')));
        } else if (!Array.isArray(result)) { gaps.push(result); }

        const narrative = data.length > 0
          ? `Labor market data from ACS 2023: ${data.map(d => `${d.metricName} is ${fmtNum(d.localValue, d.unit)} (US average: ${fmtNum(d.nationalAverage, d.unit)})`).join('. ')}.`
          : 'Labor market data is currently unavailable.';

        return { toolName: 'labor_market', data, narrative, sources: ['api.census.gov', 'ACS 5-Year 2023'], dataGaps: gaps };
      }
    },
  ];
}
