# Requirements Document

## Introduction

This feature adds two new portals to the Hexagon Civic Literacy platform, both backed by live data from free public APIs rather than stub data. The **Voter Portal** exposes the existing Hexagon analysis pipeline (legislation, funding, debate, track record, framing) to Arizona residents using real data fetched from the US Census Bureau ACS API, the FEC OpenFEC API, and the Census Population Estimates API. The **Candidate Portal** is a new, distinct portal that gives Arizona political candidates a structured, fully unbiased demographic, economic, and civic profile of their constituents, drawn from the same public data sources.

Both portals target Arizona (state FIPS code `04`) as the initial geographic scope, with additional support for Arizona county-level data. Neither portal changes the Agency Guardrail or the analytical neutrality commitments of the existing Hexagon pipeline. The Candidate Portal is designed to be equally useful to candidates of any party or ideology: all data is presented as factual measurements with national average comparisons, no data point is labeled as a problem or opportunity, and no policy direction is implied.

## Glossary

- **Voter_Portal**: The Hexagon portal that presents the existing five-module analysis pipeline to Arizona voters, backed by live public API data.
- **Candidate_Portal**: The new Hexagon portal that presents constituent demographic, economic, and civic profile data to Arizona political candidates.
- **Census_Client**: The internal HTTP client responsible for fetching data from the US Census Bureau ACS 5-Year API and the Census Population Estimates API.
- **FEC_Client**: The internal HTTP client responsible for fetching data from the FEC OpenFEC API.
- **ACS_API**: The US Census Bureau American Community Survey 5-Year Estimates API, available at `https://api.census.gov/data/2023/acs/acs5`. No API key is required for standard use.
- **OpenFEC_API**: The Federal Election Commission's public data API, available at `https://api.open.fec.gov/v1/`. Requires a free API key from api.data.gov.
- **PEP_API**: The Census Bureau Population Estimates Program API, available at `https://api.census.gov/data/2023/pep/population`. No API key is required.
- **Arizona**: The US state with FIPS code `04`, which is the initial geographic scope for both portals.
- **Constituent_Profile**: The structured data object produced by the Candidate_Portal that summarizes demographic, economic, education, housing, labor market, language access, commute, health coverage, veteran status, disability status, broadband access, and household composition data for a given Arizona geography.
- **District**: An Arizona congressional or state legislative district identified by a FIPS-compatible geographic code.
- **County_Scope**: An Arizona county-level geographic scope expressed as `county:*&in=state:04` in ACS_API and PEP_API requests.
- **National_Average**: The US national value for a given ACS variable, used as the baseline comparison for all Constituent_Profile metrics.
- **Measurement_Entry**: A single data point in the Constituent_Profile or Key_Issues_Context, consisting of: metric name, local value, National_Average, and data source citation — with no characterization of the value as a problem, challenge, or opportunity.
- **Live_Data**: Data retrieved at request time from a public API, as opposed to static stub data.
- **Data_Gap**: A structured response indicating that a requested data point is unavailable, including guidance on where the user can find it directly.
- **API_Key**: A credential string required to authenticate requests to the OpenFEC_API, supplied via environment variable `OPEN_FEC_API_KEY`.

---

## Requirements

### Requirement 1: Replace Stub Data with Live Census and FEC Data

**User Story:** As a developer, I want the DataFetcher to retrieve real data from public APIs instead of returning hardcoded stubs, so that both portals present accurate, current information to users.

#### Acceptance Criteria

1. THE Census_Client SHALL fetch demographic, economic, and education variables from the ACS_API for Arizona (state FIPS `04`) using HTTP GET requests with no API key.
2. THE FEC_Client SHALL fetch candidate finance data from the OpenFEC_API using the API key stored in the `OPEN_FEC_API_KEY` environment variable.
3. WHEN the `OPEN_FEC_API_KEY` environment variable is not set, THE FEC_Client SHALL return a Data_Gap response describing the missing credential and listing `api.data.gov` as the registration source.
4. THE Census_Client SHALL fetch population estimates from the PEP_API for Arizona using HTTP GET requests with no API key.
5. WHEN an API request to the ACS_API, PEP_API, or OpenFEC_API returns an HTTP status code outside the 200–299 range, THE Census_Client or FEC_Client SHALL return a Data_Gap response that includes the HTTP status code and the URL that was requested.
6. WHEN an API request times out after 10 seconds, THE Census_Client or FEC_Client SHALL return a Data_Gap response indicating a timeout and the URL that was requested.
7. FOR ALL valid API responses, parsing the response body then serializing it back to the wire format then parsing again SHALL produce an equivalent data object (round-trip property).

---

### Requirement 2: Census Data — Demographics

**User Story:** As a user of either portal, I want to see accurate demographic data for Arizona, so that I can understand the population composition of the state or district.

#### Acceptance Criteria

1. WHEN demographic data is requested for Arizona, THE Census_Client SHALL retrieve age distribution (population counts for age brackets: under 18, 18–34, 35–54, 55–64, 65 and over) from the ACS_API variable group `B01001`.
2. WHEN demographic data is requested for Arizona, THE Census_Client SHALL retrieve race and ethnicity breakdown (White alone, Black or African American alone, American Indian and Alaska Native alone, Asian alone, Hispanic or Latino of any race, Two or more races) from ACS_API variable groups `B02001` and `B03003`.
3. WHEN demographic data is requested for Arizona, THE Census_Client SHALL retrieve median age from ACS_API variable `B01002_001E`.
4. IF the ACS_API returns a null or missing value for any demographic variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.
5. THE Census_Client SHALL express all population counts as both raw numbers and percentages of the total population retrieved in the same API response.

---

### Requirement 3: Census Data — Economic Profile

**User Story:** As a user of either portal, I want to see economic data for Arizona, so that I can understand the financial conditions of the population.

#### Acceptance Criteria

1. WHEN economic data is requested for Arizona, THE Census_Client SHALL retrieve median household income from ACS_API variable `B19013_001E`.
2. WHEN economic data is requested for Arizona, THE Census_Client SHALL retrieve per capita income from ACS_API variable `B19301_001E`.
3. WHEN economic data is requested for Arizona, THE Census_Client SHALL retrieve the poverty rate as the percentage of the population for whom poverty status is determined that falls below the poverty level, derived from ACS_API variable group `B17001`.
4. IF the ACS_API returns a null or missing value for any economic variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.

---

### Requirement 4: Census Data — Education Levels

**User Story:** As a user of either portal, I want to see education attainment data for Arizona, so that I can understand the educational background of the population.

#### Acceptance Criteria

1. WHEN education data is requested for Arizona, THE Census_Client SHALL retrieve the high school graduation rate (percentage of the population 25 and over with at least a high school diploma or equivalent) from ACS_API variable group `B15003`.
2. WHEN education data is requested for Arizona, THE Census_Client SHALL retrieve the bachelor's degree attainment rate (percentage of the population 25 and over with at least a bachelor's degree) from ACS_API variable group `B15003`.
3. IF the ACS_API returns a null or missing value for any education variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.

---

### Requirement 5: Census Data — Housing

**User Story:** As a candidate portal user, I want to see housing data for Arizona, so that I can understand the housing conditions of my constituents.

#### Acceptance Criteria

1. WHEN housing data is requested for Arizona, THE Census_Client SHALL retrieve median home value from ACS_API variable `B25077_001E`.
2. WHEN housing data is requested for Arizona, THE Census_Client SHALL retrieve the owner-occupied housing rate and renter-occupied housing rate as percentages of total occupied housing units, derived from ACS_API variable group `B25003`.
3. IF the ACS_API returns a null or missing value for any housing variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.

---

### Requirement 6: FEC Data — Arizona Candidate Finance

**User Story:** As a voter portal user, I want to see real campaign finance data for Arizona candidates, so that I can apply the Funding Lens to actual financial disclosures.

#### Acceptance Criteria

1. WHEN finance data is requested for an Arizona candidate, THE FEC_Client SHALL query the OpenFEC_API `/candidates/` endpoint filtered to state `AZ` and return a list of matching candidates with their FEC candidate IDs.
2. WHEN a specific FEC candidate ID is provided, THE FEC_Client SHALL query the OpenFEC_API `/candidate/{candidate_id}/totals/` endpoint and return a FinanceRecord populated with total raised, total spent, and the most recent reporting period.
3. WHEN the OpenFEC_API returns an empty results array for an Arizona candidate query, THE FEC_Client SHALL return a Data_Gap response indicating no FEC records were found for the given query parameters.
4. THE FEC_Client SHALL include the `api_key` query parameter in every OpenFEC_API request using the value from the `OPEN_FEC_API_KEY` environment variable.
5. WHEN the OpenFEC_API returns a rate-limit error (HTTP 429), THE FEC_Client SHALL return a Data_Gap response indicating the rate limit was reached and advising the user to retry after 60 seconds.

---

### Requirement 7: Voter Portal

**User Story:** As an Arizona voter, I want to access the full Hexagon analysis pipeline backed by real Arizona data, so that I can analyze actual legislation, candidate finance records, and political content relevant to my state.

#### Acceptance Criteria

1. THE Voter_Portal SHALL expose all five Hexagon analysis modules (Legislation_Decoder, Funding_Lens, Debate_Analyzer, Track_Record_Explorer, Bias_Framing_Indicator) through a single entry point that accepts a user query and a conversation history.
2. WHEN a Voter_Portal request involves campaign finance data, THE Voter_Portal SHALL use the FEC_Client to retrieve Live_Data from the OpenFEC_API rather than returning stub data.
3. WHEN a Voter_Portal request involves demographic or economic context, THE Voter_Portal SHALL use the Census_Client to retrieve Live_Data from the ACS_API.
4. THE Voter_Portal SHALL pass all responses through the existing Agency Guardrail Enforcer, Scaffolded Understanding Layer, and Multi-Perspective Layer before returning them to the caller.
5. WHEN a Live_Data fetch returns a Data_Gap, THE Voter_Portal SHALL include the Data_Gap in the response alongside any analysis that can still be performed with available data.
6. IF all required data sources return Data_Gap responses for a given request, THEN THE Voter_Portal SHALL return a response that contains only Data_Gap entries and a message explaining that live data is currently unavailable, without fabricating analysis.

---

### Requirement 8: Candidate Portal — Constituent Profile

**User Story:** As an Arizona political candidate, I want to see a structured profile of my constituents' demographics, economic conditions, education levels, housing situation, labor market, language access, commute patterns, health coverage, veteran status, disability status, broadband access, and household composition, so that I can understand the people I seek to represent without partisan framing.

#### Acceptance Criteria

1. WHEN a candidate requests a Constituent_Profile for Arizona or a specific Arizona District, THE Candidate_Portal SHALL return a Constituent_Profile object containing: demographic data (Requirement 2), economic data (Requirement 3), education data (Requirement 4), housing data (Requirement 5), labor market data (Requirement 12), language access data (Requirement 13), commute and transportation data (Requirement 14), health insurance coverage data (Requirement 15), veteran population data (Requirement 16), disability status data (Requirement 17), broadband access data (Requirement 18), and household composition data (Requirement 19).
2. THE Candidate_Portal SHALL present all numeric values in the Constituent_Profile as Measurement_Entry objects, each containing: the metric name, the local value, the National_Average for that metric, and the ACS variable code and API name used to retrieve the value.
3. WHEN a Constituent_Profile is requested for a specific Arizona District, THE Candidate_Portal SHALL pass the district's FIPS geographic code as the `for` parameter in ACS_API and PEP_API requests.
4. WHEN a Constituent_Profile is requested for the state as a whole, THE Candidate_Portal SHALL use `state:04` as the geographic scope in all API requests.
5. WHEN a Constituent_Profile is requested for an Arizona county or set of counties, THE Candidate_Portal SHALL use `county:*&in=state:04` as the geographic scope in all ACS_API and PEP_API requests.
6. THE Candidate_Portal SHALL include total registered voter count and voter turnout rate from publicly available state election data in the Constituent_Profile, expressed as raw numbers and percentages with source citation, without any breakdown by political party.
7. THE Candidate_Portal SHALL present data for ALL demographic groups present in the retrieved ACS variables with equal depth, without omitting any group returned by the API.
8. THE Candidate_Portal SHALL NOT label any Measurement_Entry or data point as a "problem," "challenge," or "opportunity" — each entry SHALL be presented solely as a measurement.
9. THE Candidate_Portal SHALL use the same National_Average baseline for every metric in the Constituent_Profile, so that all comparisons are made on equivalent terms.
10. THE Candidate_Portal SHALL NOT pass Constituent_Profile data through the Agency Guardrail Enforcer, Scaffolded Understanding Layer, or Multi-Perspective Layer, as the profile presents factual public data rather than political analysis.

---

### Requirement 9: Candidate Portal — Key Issues Context

**User Story:** As an Arizona political candidate, I want the portal to surface factual observations about my constituents' conditions compared to national averages, so that I can understand where local measurements diverge from national norms without being directed toward any policy position.

#### Acceptance Criteria

1. THE Candidate_Portal SHALL derive Key_Issues_Context entries from the Constituent_Profile data by identifying metrics where the local value diverges from the National_Average by a statistically meaningful margin, using a defined threshold for each variable.
2. WHEN a divergence threshold is met, THE Candidate_Portal SHALL include a Measurement_Entry stating: the metric name, the local value, the National_Average, and the ACS variable code and API name — with no policy label, no characterization of the divergence as a problem or opportunity, and no suggestion of how the candidate should respond.
3. THE Candidate_Portal SHALL include at most 5 Key_Issues_Context entries per Constituent_Profile, ordered by the absolute magnitude of the divergence from the National_Average.
4. THE Candidate_Portal SHALL NOT include policy labels (e.g., "healthcare reform," "immigration policy," "housing crisis") in any Key_Issues_Context entry.
5. THE Candidate_Portal SHALL NOT suggest that the candidate should "focus their platform" on, "address," or "prioritize" any Key_Issues_Context entry.
6. FOR ALL valid Constituent_Profile objects, the number of Key_Issues_Context entries SHALL be between 0 and 5 inclusive (invariant).

---

### Requirement 10: Data Freshness and Caching

**User Story:** As a developer, I want API responses to be cached for a reasonable period so that repeated requests do not exhaust rate limits or degrade performance.

#### Acceptance Criteria

1. THE Census_Client SHALL cache ACS_API and PEP_API responses in memory for a minimum of 1 hour per unique request URL.
2. THE FEC_Client SHALL cache OpenFEC_API responses in memory for a minimum of 15 minutes per unique request URL.
3. WHEN a cached response is returned, THE Census_Client or FEC_Client SHALL include a `cachedAt` timestamp in the response metadata indicating when the data was originally fetched.
4. WHEN the in-memory cache is cleared or the process restarts, THE Census_Client and FEC_Client SHALL fetch fresh data from the respective APIs on the next request.
5. FOR ALL cache entries, retrieving a cached value immediately after storing it SHALL return an equivalent object (round-trip property).

---

### Requirement 11: API Response Parsing

**User Story:** As a developer, I want API responses to be parsed into typed domain objects so that downstream modules receive well-structured data.

#### Acceptance Criteria

1. THE Census_Client SHALL parse ACS_API JSON array responses (where the first row is a header array and subsequent rows are data arrays) into named key-value objects before returning them to callers.
2. THE FEC_Client SHALL parse OpenFEC_API JSON responses into typed FinanceRecord objects before returning them to callers.
3. WHEN an API response body cannot be parsed as valid JSON, THE Census_Client or FEC_Client SHALL return a Data_Gap response indicating a parse failure and including the first 200 characters of the raw response body for diagnostic purposes.
4. FOR ALL valid ACS_API responses, parsing the JSON array format into named objects then serializing back to the array format then parsing again SHALL produce an equivalent named object (round-trip property).
5. FOR ALL valid OpenFEC_API responses, parsing the response into a FinanceRecord then serializing the FinanceRecord to JSON then parsing again SHALL produce an equivalent FinanceRecord (round-trip property).

---

### Requirement 12: Census Data — Labor Market

**User Story:** As a candidate portal user, I want to see labor market data for my constituents, so that I can understand what industries and occupations they work in.

#### Acceptance Criteria

1. WHEN labor market data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve the unemployment rate as the percentage of the civilian labor force that is unemployed, derived from ACS_API variable group `B23025`.
2. WHEN labor market data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve the top employment sectors by share of civilian employed population (16 and over) from ACS_API variable group `C24050`, expressed as percentages of total employed population.
3. WHEN labor market data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve median earnings by occupation group from ACS_API variable group `C24010`, expressed in dollars.
4. IF the ACS_API returns a null or missing value for any labor market variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.
5. THE Census_Client SHALL express all labor market counts as both raw numbers and percentages of the relevant labor force population retrieved in the same API response.

---

### Requirement 13: Census Data — Language Access

**User Story:** As a candidate portal user, I want to see language access data for my constituents, so that I can understand the linguistic diversity of the population I seek to represent.

#### Acceptance Criteria

1. WHEN language access data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve the percentage of households where a language other than English is spoken at home from ACS_API variable group `B16002`.
2. WHEN language access data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve the percentage of the population with limited English proficiency (speaks English less than "very well") from ACS_API variable group `B16004`.
3. IF the ACS_API returns a null or missing value for any language access variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.
4. THE Census_Client SHALL express all language access values as percentages of the relevant household or population total retrieved in the same API response.

---

### Requirement 14: Census Data — Commute and Transportation

**User Story:** As a candidate portal user, I want to see commute and transportation data for my constituents, so that I can understand how they travel to work.

#### Acceptance Criteria

1. WHEN commute data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve mean travel time to work in minutes from ACS_API variable `B08136_001E` divided by the count of workers with a commute from `B08136`.
2. WHEN commute data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve the percentage of workers 16 and over who drive alone to work and the percentage who use public transportation, derived from ACS_API variable group `B08301`.
3. IF the ACS_API returns a null or missing value for any commute variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.
4. THE Census_Client SHALL express all commute mode values as percentages of total workers 16 and over retrieved in the same API response.

---

### Requirement 15: Census Data — Health Insurance Coverage

**User Story:** As a candidate portal user, I want to see health insurance coverage data for my constituents, so that I can understand the health coverage landscape of the population.

#### Acceptance Criteria

1. WHEN health insurance data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve the percentage of the civilian noninstitutionalized population with no health insurance coverage from ACS_API variable group `B27001`.
2. IF the ACS_API returns a null or missing value for any health insurance variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.
3. THE Census_Client SHALL express the uninsured rate as a percentage of the total civilian noninstitutionalized population retrieved in the same API response.

---

### Requirement 16: Census Data — Veteran Population

**User Story:** As a candidate portal user, I want to see veteran population data for my constituents, so that I can understand the share of the population that has served in the military.

#### Acceptance Criteria

1. WHEN veteran data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve the percentage of the civilian population 18 and over that are veterans from ACS_API variable group `B21001`.
2. IF the ACS_API returns a null or missing value for any veteran variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.
3. THE Census_Client SHALL express the veteran percentage as a share of the total civilian population 18 and over retrieved in the same API response.

---

### Requirement 17: Census Data — Disability Status

**User Story:** As a candidate portal user, I want to see disability status data for my constituents, so that I can understand the share of the population living with a disability.

#### Acceptance Criteria

1. WHEN disability data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve the percentage of the civilian noninstitutionalized population under 65 with a disability from ACS_API variable group `B18101`.
2. IF the ACS_API returns a null or missing value for any disability variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.
3. THE Census_Client SHALL express the disability percentage as a share of the total civilian noninstitutionalized population under 65 retrieved in the same API response.

---

### Requirement 18: Census Data — Broadband Access

**User Story:** As a candidate portal user, I want to see broadband access data for my constituents, so that I can understand the level of internet connectivity in the population.

#### Acceptance Criteria

1. WHEN broadband data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve the percentage of households with a broadband internet subscription from ACS_API variable group `B28002`.
2. IF the ACS_API returns a null or missing value for any broadband variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.
3. THE Census_Client SHALL express the broadband subscription rate as a percentage of total households retrieved in the same API response.

---

### Requirement 19: Census Data — Household Composition

**User Story:** As a candidate portal user, I want to see household composition data for my constituents, so that I can understand the family and living arrangements of the population.

#### Acceptance Criteria

1. WHEN household composition data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve average household size from ACS_API variable `B25010_001E`.
2. WHEN household composition data is requested for Arizona or an Arizona county, THE Census_Client SHALL retrieve the percentage of family households that are single-parent households (male householder no spouse present and female householder no spouse present) from ACS_API variable group `B11012`.
3. IF the ACS_API returns a null or missing value for any household composition variable, THEN THE Census_Client SHALL substitute a Data_Gap entry for that variable rather than propagating a null into the Constituent_Profile.
4. THE Census_Client SHALL express single-parent household percentages as a share of total family households retrieved in the same API response.

---

### Requirement 20: Candidate Portal — FEC Finance Summary

**User Story:** As an Arizona political candidate, I want to see my own FEC finance totals and the aggregate finance totals for all candidates running in the same race, so that I can understand the financial landscape of my race using factual public data.

#### Acceptance Criteria

1. WHEN a candidate with a known FEC candidate ID requests a Constituent_Profile, THE Candidate_Portal SHALL query the OpenFEC_API `/candidate/{candidate_id}/totals/` endpoint and include the candidate's total raised, total spent, and most recent reporting period in the Constituent_Profile as a Measurement_Entry.
2. WHEN a candidate requests a Constituent_Profile, THE Candidate_Portal SHALL query the OpenFEC_API `/candidates/` endpoint filtered to the same office, state, and district to retrieve aggregate finance totals for all candidates running in the same race, and include those totals in the Constituent_Profile as Measurement_Entry objects.
3. THE Candidate_Portal SHALL present all FEC finance values as raw dollar amounts with source citation (OpenFEC_API, reporting period), without characterizing any amount as large, small, adequate, or otherwise.
4. WHEN the `OPEN_FEC_API_KEY` environment variable is not set, THE Candidate_Portal SHALL include a Data_Gap entry for the FEC finance section of the Constituent_Profile and continue returning all other sections.
5. WHEN the OpenFEC_API returns no records for the candidate's race, THE Candidate_Portal SHALL include a Data_Gap entry for the FEC finance section indicating no FEC records were found for the given race parameters.
6. THE Candidate_Portal SHALL NOT characterize any candidate's finance totals relative to another candidate's totals in terms of advantage, disadvantage, or competitive standing.
