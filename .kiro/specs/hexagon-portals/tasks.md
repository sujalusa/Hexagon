# Implementation Plan: Hexagon Portals

## Overview

Implement two new portals — `VoterPortal` and `CandidatePortal` — backed by live data from the US Census Bureau ACS API and the FEC OpenFEC API. This plan proceeds in dependency order: shared types first, then the two HTTP clients, then the profile assembly helper, then the portals themselves, finishing with module injection wiring.

## Tasks

- [x] 1. Add new shared types to `src/types/index.ts`
  - Add `GeoScope` union type (`state | county | district`)
  - Add `MeasurementEntry` interface
  - Add `ConstituentProfileRequest` interface
  - Add `CacheEntry<T>` generic interface
  - Add `KeyIssuesContext` interface
  - Add `ConstituentProfile` interface with all 12 data category sections plus `keyIssuesContext` and `dataGaps`
  - Add `ACS_VARIABLE_MAP` constant
  - Add `NATIONAL_AVERAGES` constant
  - Add `FecCandidateList` interface
  - Add `AcsNamedRow` type alias (`Record<string, string | null>`)
  - _Requirements: 1.1, 1.2, 8.1, 8.2, 9.1, 9.2, 10.1, 10.2_

- [x] 2. Implement `CensusClient` at `src/data/CensusClient.ts`
  - [x] 2.1 Implement `buildGeoParam(geoScope: GeoScope): string` helper
    - Maps `state` → `for=state:04`, `county` → `for=county:*&in=state:04`, `district` → `for=congressional district:{fips}&in=state:04`
    - _Requirements: 8.3, 8.4, 8.5_

  - [x] 2.2 Implement `parseAcsResponse(raw: unknown): AcsNamedRow[] | DataGap`
    - Validates that input is an array of arrays with a header row
    - Zips header row with each data row into named objects
    - Substitutes `DataGap` for any null or missing variable value
    - Returns `DataGap` on invalid structure
    - _Requirements: 1.7, 2.4, 3.4, 4.3, 5.3, 11.1, 11.3, 12.4, 13.3, 14.3, 15.2, 16.2, 17.2, 18.2, 19.3_

  - [x] 2.3 Implement `serializeAcsRows(rows: AcsNamedRow[]): string[][]`
    - Inverse of `parseAcsResponse`: reconstructs the array-of-arrays wire format from named objects
    - First output row is the header array; subsequent rows are value arrays in matching order
    - _Requirements: 1.7, 11.4_

  - [x]* 2.4 Write property test for ACS parse round-trip (Property F)
    - // Feature: hexagon-portals, Property F: ACS parse round-trip
    - Generate random valid ACS array-of-arrays with `fc.array(fc.array(fc.string()))` shaped as `[headers, ...dataRows]`
    - Assert `parseAcsResponse(serializeAcsRows(parseAcsResponse(input))) ≡ parseAcsResponse(input)`
    - Run minimum 100 iterations
    - **Property F: ACS Parse Round-Trip**
    - **Validates: Requirements 1.7, 11.4**

  - [x]* 2.5 Write property test for null → DataGap substitution (Property H)
    - // Feature: hexagon-portals, Property H: Null ACS values produce DataGap substitution
    - Generate random ACS responses with injected `null` values in data rows
    - Assert no `null` propagates into the parsed output; each null position yields a `DataGap`
    - Run minimum 100 iterations
    - **Property H: Null → DataGap Substitution**
    - **Validates: Requirements 2.4, 3.4, 4.3, 5.3, 12.4, 13.3, 14.3, 15.2, 16.2, 17.2, 18.2, 19.3**

  - [x] 2.6 Implement `fetch(url: string): Promise<AcsNamedRow[] | DataGap>`
    - Check in-memory `Map<string, CacheEntry<AcsNamedRow[]>>` first; return cached value if not expired (TTL 1 hour)
    - On cache miss: call `globalThis.fetch(url)` with `AbortController` timeout of 10 seconds
    - HTTP status outside 200–299 → return `DataGap` with status code and URL
    - Timeout → return `DataGap` with timeout message and URL
    - JSON parse failure → return `DataGap` with first 200 chars of raw body
    - On success: call `parseAcsResponse`, store in cache with `cachedAt` ISO timestamp, return result
    - _Requirements: 1.1, 1.5, 1.6, 10.1, 10.3, 10.4, 11.3_

  - [x]* 2.7 Write property test for cache round-trip (Property E)
    - // Feature: hexagon-portals, Property E: Cache round-trip
    - Generate random `CacheEntry<AcsNamedRow[]>` values with `fc.record({data: ..., cachedAt: fc.string(), ttlMs: fc.nat()})`
    - Store in cache then immediately retrieve; assert retrieved value equals stored value
    - Run minimum 100 iterations
    - **Property E: Cache Round-Trip**
    - **Validates: Requirements 10.5**

  - [x] 2.8 Implement `fetchGroup(group: string, geoScope: GeoScope): Promise<AcsNamedRow[] | DataGap>`
    - Builds URL: `https://api.census.gov/data/2023/acs/acs5?get=group(${group})&${buildGeoParam(geoScope)}`
    - Delegates to `fetch(url)`
    - _Requirements: 2.1, 2.2, 3.3, 4.1, 4.2, 5.2, 12.1, 12.2, 12.3, 13.1, 13.2, 14.2, 15.1, 16.1, 17.1, 18.1, 19.2_

  - [x] 2.9 Implement `fetchVariable(variable: string, geoScope: GeoScope): Promise<string | DataGap>`
    - Builds URL: `https://api.census.gov/data/2023/acs/acs5?get=${variable}&${buildGeoParam(geoScope)}`
    - Delegates to `fetch(url)`, extracts the single variable value from the first data row
    - Returns `DataGap` if the value is null or missing
    - _Requirements: 2.3, 3.1, 3.2, 5.1, 14.1, 19.1_

  - [x] 2.10 Implement `clearCache(): void`
    - Clears the in-memory cache `Map`
    - _Requirements: 10.4_

  - [x]* 2.11 Write unit tests for `CensusClient` error paths
    - HTTP 500 response → `DataGap` with status code and URL
    - 10-second timeout → `DataGap` with timeout message
    - Invalid JSON body → `DataGap` with first 200 chars
    - Null ACS variable value → `DataGap` substitution (not null propagation)
    - _Requirements: 1.5, 1.6, 2.4, 11.3_

- [x] 3. Implement `FecClient` at `src/data/FecClient.ts`
  - [x] 3.1 Implement `parseFecCandidates(raw: unknown): FecCandidateList | DataGap`
    - Validates that `raw` has a `results` array; returns `DataGap` if missing or empty
    - Maps each result to `{ candidate_id, name, office, district }`
    - _Requirements: 6.1, 6.3, 11.2_

  - [x] 3.2 Implement `parseFecTotals(raw: unknown): FinanceRecord | DataGap`
    - Validates that `raw.results[0]` exists; returns `DataGap` if absent
    - Maps to `FinanceRecord` with `totalRaised`, `totalSpent`, and `reportingPeriod`
    - _Requirements: 6.2, 11.2_

  - [x]* 3.3 Write property test for FEC parse round-trip (Property G)
    - // Feature: hexagon-portals, Property G: FEC parse round-trip
    - Generate random valid OpenFEC-shaped JSON objects with `fc.record({results: fc.array(...)})`
    - Assert `parseFecTotals(JSON.parse(JSON.stringify(parseFecTotals(input)))) ≡ parseFecTotals(input)` (when both are `FinanceRecord`)
    - Run minimum 100 iterations
    - **Property G: FEC Parse Round-Trip**
    - **Validates: Requirements 1.7, 11.5**

  - [x] 3.4 Implement `fetchCandidates(state: string, office?: string, district?: string): Promise<FecCandidateList | DataGap>`
    - Return `DataGap` immediately if `OPEN_FEC_API_KEY` is not set
    - Build URL: `https://api.open.fec.gov/v1/candidates/?state=${state}&api_key=${key}` (append `office` and `district` if provided)
    - Apply 10-second `AbortController` timeout; cache for 15 minutes
    - HTTP 429 → `DataGap` with rate-limit message and 60-second retry advice
    - HTTP status outside 200–299 → `DataGap` with status code and URL
    - Timeout → `DataGap` with timeout message
    - Delegate response parsing to `parseFecCandidates`
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 6.1, 6.3, 6.4, 6.5, 10.2_

  - [x] 3.5 Implement `fetchCandidateTotals(candidateId: string): Promise<FinanceRecord | DataGap>`
    - Return `DataGap` immediately if `OPEN_FEC_API_KEY` is not set
    - Build URL: `https://api.open.fec.gov/v1/candidate/${candidateId}/totals/?api_key=${key}`
    - Apply 10-second timeout; cache for 15 minutes
    - HTTP 429 → `DataGap` with rate-limit message
    - HTTP status outside 200–299 → `DataGap` with status code and URL
    - Delegate response parsing to `parseFecTotals`
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 6.2, 6.4, 6.5, 10.2_

  - [x] 3.6 Implement `clearCache(): void`
    - Clears the in-memory cache `Map`
    - _Requirements: 10.4_

  - [x]* 3.7 Write unit tests for `FecClient` error paths
    - Missing `OPEN_FEC_API_KEY` → `DataGap` with `api.data.gov` source
    - HTTP 429 → `DataGap` with 60-second retry message
    - HTTP 500 → `DataGap` with status code and URL
    - Empty `results` array → `DataGap` indicating no records found
    - 10-second timeout → `DataGap` with timeout message
    - _Requirements: 1.3, 1.5, 1.6, 6.3, 6.5_

- [x] 4. Checkpoint — run all tests, verify everything passes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement `ProfileBuilder` at `src/portals/ProfileBuilder.ts`
  - [x] 5.1 Implement `static buildMeasurementEntry(metricName, localValue, nationalAverage, unit, source, cachedAt?): MeasurementEntry`
    - Constructs a `MeasurementEntry` with all required fields populated
    - `metricName` must be non-empty; `localValue` must be non-null; `unit` and `source` must be non-empty
    - _Requirements: 8.2, 9.2_

  - [x] 5.2 Implement `static computeDivergence(local: number | string, national: number | string): number`
    - Returns `Math.abs(Number(local) - Number(national))`
    - Returns `0` if either value is not a finite number
    - _Requirements: 9.1_

  - [x] 5.3 Implement `static computeKeyIssues(profile: ConstituentProfile): KeyIssuesContext[]`
    - Collects all `MeasurementEntry` objects from every section of the profile where `localValue` and `nationalAverage` are both numeric
    - Computes `divergenceMagnitude` for each via `computeDivergence`
    - Sorts descending by `divergenceMagnitude`
    - Returns the top 5 (or fewer if fewer than 5 numeric entries exist)
    - Does NOT label any entry as a problem, challenge, or opportunity
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x]* 5.4 Write property test for KeyIssuesContext count invariant (Property B)
    - // Feature: hexagon-portals, Property B: KeyIssuesContext count invariant
    - Generate random `ConstituentProfile` shapes with varying numbers of numeric `MeasurementEntry` objects
    - Assert `computeKeyIssues(profile).length >= 0 && computeKeyIssues(profile).length <= 5`
    - Run minimum 100 iterations
    - **Property B: KeyIssuesContext Count Invariant**
    - **Validates: Requirements 9.3, 9.6**

  - [x]* 5.5 Write property test for KeyIssuesContext ordering (Property C)
    - // Feature: hexagon-portals, Property C: KeyIssuesContext ordering
    - Generate random profiles with 2 or more numeric `MeasurementEntry` objects
    - Assert that for every adjacent pair `[i]` and `[i+1]`, `divergenceMagnitude[i] >= divergenceMagnitude[i+1]`
    - Run minimum 100 iterations
    - **Property C: KeyIssuesContext Ordering**
    - **Validates: Requirements 9.3**

  - [x]* 5.6 Write property test for no characterization labels (Property D)
    - // Feature: hexagon-portals, Property D: No characterization labels
    - Generate random `ConstituentProfile` objects with arbitrary metric names
    - Assert no `metricName` in any `MeasurementEntry` or `KeyIssuesContext` contains: "problem", "challenge", "opportunity", "crisis", "reform", "policy", "focus", "address", "prioritize", "advantage", "disadvantage", "competitive"
    - Run minimum 100 iterations
    - **Property D: No Characterization Labels**
    - **Validates: Requirements 8.8, 9.4, 9.5, 20.3, 20.6**

  - [x]* 5.7 Write unit tests for `ProfileBuilder`
    - `computeDivergence(50, 30)` → `20`
    - `computeDivergence("abc", 30)` → `0`
    - `computeKeyIssues` with 7 numeric entries returns exactly 5
    - `computeKeyIssues` with 3 numeric entries returns exactly 3
    - `computeKeyIssues` with 0 numeric entries returns `[]`
    - _Requirements: 9.1, 9.3, 9.6_

- [x] 6. Implement `CandidatePortal` at `src/portals/CandidatePortal.ts`
  - [x] 6.1 Implement constructor accepting `CensusClient` and `FecClient`
    - Store injected clients as private fields
    - _Requirements: 8.1_

  - [x] 6.2 Implement the 12 private fetch-and-parse methods (one per data category)
    - `fetchDemographics(geoScope)` — fetches `B01001`, `B02001`, `B03003`, `B01002_001E`; builds `MeasurementEntry[]` using `ProfileBuilder.buildMeasurementEntry` and `NATIONAL_AVERAGES`
    - `fetchEconomic(geoScope)` — fetches `B19013_001E`, `B19301_001E`, `B17001`
    - `fetchEducation(geoScope)` — fetches `B15003`
    - `fetchHousing(geoScope)` — fetches `B25077_001E`, `B25003`
    - `fetchLaborMarket(geoScope)` — fetches `B23025`, `C24050`, `C24010`
    - `fetchLanguageAccess(geoScope)` — fetches `B16002`, `B16004`
    - `fetchCommute(geoScope)` — fetches `B08136_001E`, `B08301`
    - `fetchHealthInsurance(geoScope)` — fetches `B27001`
    - `fetchVeterans(geoScope)` — fetches `B21001`
    - `fetchDisability(geoScope)` — fetches `B18101`
    - `fetchBroadband(geoScope)` — fetches `B28002`
    - `fetchHouseholdComposition(geoScope)` — fetches `B25010_001E`, `B11012`
    - Each method returns its section data or a `DataGap` on failure
    - _Requirements: 2.1–2.5, 3.1–3.4, 4.1–4.3, 5.1–5.3, 12.1–12.5, 13.1–13.4, 14.1–14.4, 15.1–15.3, 16.1–16.3, 17.1–17.3, 18.1–18.3, 19.1–19.4_

  - [x] 6.3 Implement `getConstituentProfile(request: ConstituentProfileRequest): Promise<ConstituentProfile>`
    - Fan out all 12 fetch methods plus optional FEC fetch using `Promise.allSettled`
    - Assemble `ConstituentProfile` from settled results; record any `DataGap` in `profile.dataGaps`
    - Call `ProfileBuilder.computeKeyIssues(profile)` and attach result to `profile.keyIssuesContext`
    - Does NOT call `AgencyGuardrailEnforcer`, `ScaffoldedUnderstandingLayer`, or `MultiPerspectiveLayer`
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.7, 8.8, 8.9, 8.10, 9.1–9.6, 20.1–20.6_

  - [x]* 6.4 Write property test for MeasurementEntry completeness (Property A)
    - // Feature: hexagon-portals, Property A: MeasurementEntry completeness
    - Generate random `ConstituentProfile` objects with arbitrary `MeasurementEntry` arrays
    - Assert every `MeasurementEntry` has non-empty `metricName`, non-null `localValue`, non-empty `unit`, non-empty `source`
    - Run minimum 100 iterations
    - **Property A: MeasurementEntry Completeness**
    - **Validates: Requirements 8.2, 9.2**

  - [x]* 6.5 Write unit tests for `CandidatePortal`
    - Partial profile: one fetch returns `DataGap`, remaining sections are populated — profile is returned with `dataGaps` populated
    - Missing `OPEN_FEC_API_KEY`: profile returned with `fecFinance.dataGap` populated, all other sections present
    - `getConstituentProfile` does NOT invoke `AgencyGuardrailEnforcer`, `ScaffoldedUnderstandingLayer`, or `MultiPerspectiveLayer`
    - _Requirements: 8.10, 20.4, 20.5_

- [x] 7. Update modules to accept injected clients and implement `VoterPortal`
  - [x] 7.1 Update `FundingLensModule` to accept an optional injected `FecClient`
    - Add constructor parameter `fecClient?: FecClient`
    - When `fecClient` is provided, use it in `analyze()` instead of `DataFetcher` for finance data
    - Preserve existing `DataFetcher` fallback when no client is injected (backward compatibility)
    - _Requirements: 7.2_

  - [x] 7.2 Update `LegislationDecoderModule` to accept an optional injected `CensusClient`
    - Add constructor parameter `censusClient?: CensusClient`
    - When `censusClient` is provided, use it in `analyze()` for demographic/economic context
    - Preserve existing `DataFetcher` fallback
    - _Requirements: 7.3_

  - [x] 7.3 Update `TrackRecordExplorerModule` to accept an optional injected `CensusClient`
    - Add constructor parameter `censusClient?: CensusClient`
    - When `censusClient` is provided, use it in `analyze()` for demographic context
    - Preserve existing `DataFetcher` fallback
    - _Requirements: 7.3_

  - [x] 7.4 Implement `VoterPortal` at `src/portals/VoterPortal.ts`
    - Constructor accepts `censusClient: CensusClient` and `fecClient: FecClient`
    - Instantiates `HexagonPipeline` with live-client-injected module instances
    - `process(userInput, history)` delegates entirely to `HexagonPipeline.process()`
    - When a live data fetch returns `DataGap`, includes it in the response alongside available analysis
    - When all data sources return `DataGap`, returns only `DataGap` entries with the message `"Live data is currently unavailable for this request. No analysis has been generated."`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x]* 7.5 Write property test for VoterPortal pipeline pass-through (Property I)
    - // Feature: hexagon-portals, Property I: Voter Portal pipeline pass-through
    - Generate random user input strings and conversation histories
    - For any non-`scopeBoundaryMessage` response, assert the result is a `FinalResponse` with `perspectivesVerified`, `perspectiveCount`, `frameworkLabel`, and `closingQuestions` fields present
    - Run minimum 100 iterations
    - **Property I: Voter Portal Pipeline Pass-Through**
    - **Validates: Requirements 7.4**

  - [x]* 7.6 Write unit tests for `VoterPortal`
    - `DataGap` from `FecClient` is included in the response alongside available analysis
    - All data sources return `DataGap` → response contains only `DataGap` entries and unavailability message
    - _Requirements: 7.5, 7.6_

- [x] 8. Final checkpoint — run all tests, verify everything passes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with a minimum of 100 iterations each
- Checkpoints ensure incremental validation before proceeding to the next phase
- `CandidatePortal` intentionally bypasses the `HexagonPipeline` layers (Requirement 8.10)
- `NATIONAL_AVERAGES` are hardcoded 2023 ACS national estimates — no per-request API call needed
