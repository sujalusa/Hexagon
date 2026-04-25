// ─── Conversation ────────────────────────────────────────────────────────────

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
  moduleId?: string;
  frameworksApplied?: string[];
}

// ─── Request Router ───────────────────────────────────────────────────────────

export interface RoutedRequest {
  moduleId: 'legislation' | 'funding' | 'debate' | 'trackrecord' | 'framing';
  sourceText?: string;
  entityId?: string;
  conversationHistory: Turn[];
}

// ─── Module Interface ─────────────────────────────────────────────────────────

export interface AnalysisSection {
  title: string;
  content: string;
  contentType: 'fact' | 'inference' | 'opinion' | 'framework' | 'prompt';
}

export interface FactualClaim {
  text: string;
  verifiable: boolean;
  evidenceProvided: boolean;
  source?: string;
}

export interface Perspective {
  stakeholderGroup: string;
  analyticalTradition?: string;
  content: string;
}

export interface DataGap {
  description: string;
  primarySources: string[];
}

export interface RawAnalysis {
  moduleId: string;
  sections: AnalysisSection[];
  frameworksApplied: string[];
  factualClaims: FactualClaim[];
  perspectives: Perspective[];
  dataGaps?: DataGap[];
}

export interface AnalysisModule {
  analyze(request: RoutedRequest): Promise<RawAnalysis>;
}

// ─── Pipeline Interfaces ──────────────────────────────────────────────────────

export interface GuardrailViolation {
  sectionTitle: string;
  offendingText: string;
  violationType: 'endorsement' | 'normative_language' | 'recommendation';
}

export interface GuardrailResult {
  passed: boolean;
  sanitizedAnalysis?: RawAnalysis;
  scopeBoundaryMessage?: string;
  violations: GuardrailViolation[];
}

export interface ScaffoldedResponse {
  analysis: RawAnalysis;
  frameworkLabel: string;
  closingQuestions: string[];
  alternativeFrameworks?: string[];
}

export interface FinalResponse {
  scaffolded: ScaffoldedResponse;
  perspectivesVerified: boolean;
  perspectiveCount: number;
}

// ─── Data Models ──────────────────────────────────────────────────────────────

export type ProceduralStage =
  | 'introduced'
  | 'committee_review'
  | 'floor_vote'
  | 'passed_chamber'
  | 'conference'
  | 'signed'
  | 'vetoed';

export interface Provision {
  id: string;
  summary: string;
  affectedParties: string[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface LegislationRecord {
  billId: string;
  title: string;
  fullText: string;
  statedPurpose: string;
  keyProvisions: Provision[];
  affectedParties: string[];
  proceduralStage: ProceduralStage;
  glossaryTerms: GlossaryEntry[];
}

export interface DateRange {
  start: string;
  end: string;
}

export interface Contribution {
  donorCategory: string;
  donorName?: string;
  amount: number;
  date: string;
  disclosureStatus: 'disclosed' | 'undisclosed' | 'partial';
}

export interface FinanceBenchmark {
  label: string;
  value: number;
  description: string;
}

export interface FinanceRecord {
  entityId: string;
  entityName: string;
  contributions: Contribution[];
  totalRaised: number;
  reportingPeriod: DateRange;
  legalContext: string;
  benchmarks: FinanceBenchmark[];
}

export interface VoteEntry {
  billId: string;
  billTitle: string;
  billPurpose: string;
  policyArea: string;
  date: string;
  vote: 'yea' | 'nay' | 'abstain' | 'absent';
  finalOutcome: 'passed' | 'failed';
}

export interface PublicStatement {
  date: string;
  text: string;
  topic: string;
  relatedBillId?: string;
}

export interface VotingRecord {
  politicianId: string;
  politicianName: string;
  votes: VoteEntry[];
  publicStatements: PublicStatement[];
}

export interface ArgumentStructure {
  speakerId: string;
  claim: string;
  evidence?: string;
  warrant?: string;
  charitableInterpretation: string;
  logicalGaps: string[];
}

export interface RhetoricalTechnique {
  name: string;
  excerpt: string;
  function: string;
}

export interface DebateAnalysis {
  sourceText: string;
  arguments: ArgumentStructure[];
  rhetoricalTechniques: RhetoricalTechnique[];
  factualClaims: FactualClaim[];
}

export interface LoadedPhrase {
  original: string;
  connotativeWeight: string;
  framingEffect: string;
  neutralAlternative: string;
}

export interface StructuralChoice {
  type: 'ordering' | 'omission' | 'passive_voice' | 'emphasis' | 'other';
  description: string;
  potentialEffect: string;
}

export interface FramingAnalysis {
  sourceText: string;
  loadedPhrases: LoadedPhrase[];
  structuralChoices: StructuralChoice[];
  framingPatternsDetected: boolean;
  criteriaApplied: string[];
}

// ─── Portal Types ─────────────────────────────────────────────────────────────

export type AcsNamedRow = Record<string, string | null>;

export type GeoScope =
  | { type: 'state'; fips: '04' }
  | { type: 'county'; stateFips: '04'; countyFips?: string }
  | { type: 'district'; fips: string };

export interface MeasurementEntry {
  metricName: string;
  localValue: number | string;
  nationalAverage: number | string | null;
  unit: string;
  source: string;
  cachedAt?: string;
}

export interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  ttlMs: number;
}

export interface KeyIssuesContext {
  metricName: string;
  localValue: number | string;
  nationalAverage: number | string;
  divergenceMagnitude: number;
  unit: string;
  source: string;
}

export interface ConstituentProfileRequest {
  geoScope: GeoScope;
  candidateFecId?: string;
  officeType?: 'H' | 'S' | 'P';
  district?: string;
}

export interface FecCandidateList {
  results: Array<{
    candidate_id: string;
    name: string;
    office: string;
    district?: string;
  }>;
  pagination: { count: number };
}

export interface ConstituentProfile {
  geoScope: GeoScope;
  generatedAt: string;
  demographics: {
    totalPopulation: MeasurementEntry;
    medianAge: MeasurementEntry;
    ageDistribution: MeasurementEntry[];
    raceEthnicity: MeasurementEntry[];
  };
  economic: {
    medianHouseholdIncome: MeasurementEntry;
    perCapitaIncome: MeasurementEntry;
    povertyRate: MeasurementEntry;
  };
  education: {
    highSchoolGradRate: MeasurementEntry;
    bachelorsDegreeRate: MeasurementEntry;
  };
  housing: {
    medianHomeValue: MeasurementEntry;
    ownerOccupiedRate: MeasurementEntry;
    renterOccupiedRate: MeasurementEntry;
  };
  laborMarket: {
    unemploymentRate: MeasurementEntry;
    topEmploymentSectors: MeasurementEntry[];
    medianEarningsByOccupation: MeasurementEntry[];
  };
  languageAccess: {
    nonEnglishHouseholdRate: MeasurementEntry;
    limitedEnglishProficiencyRate: MeasurementEntry;
  };
  commute: {
    meanTravelTimeMinutes: MeasurementEntry;
    driveAloneRate: MeasurementEntry;
    publicTransitRate: MeasurementEntry;
  };
  healthInsurance: {
    uninsuredRate: MeasurementEntry;
  };
  veterans: {
    veteranRate: MeasurementEntry;
  };
  disability: {
    disabilityRateUnder65: MeasurementEntry;
  };
  broadband: {
    broadbandSubscriptionRate: MeasurementEntry;
  };
  householdComposition: {
    averageHouseholdSize: MeasurementEntry;
    singleParentHouseholdRate: MeasurementEntry;
  };
  civicEngagement: {
    totalRegisteredVoters: MeasurementEntry;
    voterTurnoutRate: MeasurementEntry;
  };
  fecFinance?: {
    candidateTotals?: MeasurementEntry[];
    raceTotals: MeasurementEntry[];
    dataGap?: DataGap;
  };
  keyIssuesContext: KeyIssuesContext[];
  dataGaps: DataGap[];
}

export const ACS_VARIABLE_MAP = {
  medianAge:             'B01002_001E',
  medianHouseholdIncome: 'B19013_001E',
  perCapitaIncome:       'B19301_001E',
  medianHomeValue:       'B25077_001E',
  averageHouseholdSize:  'B25010_001E',
  ageDistribution:       'B01001',
  raceEthnicity:         ['B02001', 'B03003'] as const,
  poverty:               'B17001',
  education:             'B15003',
  housing:               'B25003',
  laborForce:            'B23025',
  employmentSectors:     'C24050',
  occupationEarnings:    'C24010',
  languageHome:          'B16002',
  limitedEnglish:        'B16004',
  commuteTime:           'B08136',
  commuteMode:           'B08301',
  healthInsurance:       'B27001',
  veterans:              'B21001',
  disability:            'B18101',
  broadband:             'B28002',
  householdComposition:  'B11012',
} as const;

export const NATIONAL_AVERAGES = {
  totalPopulation:               334914895,
  medianAge:                     38.9,
  medianHouseholdIncome:         75149,
  perCapitaIncome:               40480,
  povertyRate:                   11.5,
  highSchoolGradRate:            89.9,
  bachelorsDegreeRate:           35.4,
  medianHomeValue:               244900,
  ownerOccupiedRate:             65.9,
  renterOccupiedRate:            34.1,
  unemploymentRate:              3.8,
  nonEnglishHouseholdRate:       21.5,
  limitedEnglishProficiencyRate: 8.3,
  meanTravelTimeMinutes:         27.6,
  driveAloneRate:                72.5,
  publicTransitRate:             5.0,
  uninsuredRate:                 8.0,
  veteranRate:                   6.4,
  disabilityRateUnder65:         8.7,
  broadbandSubscriptionRate:     82.0,
  averageHouseholdSize:          2.53,
  singleParentHouseholdRate:     16.0,
} as const;
