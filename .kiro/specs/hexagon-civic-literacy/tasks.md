# Implementation Plan: Hexagon Civic Literacy

## Overview

Implement Hexagon as a TypeScript pipeline: shared interfaces and data models first, then the five analytical modules, then the cross-cutting pipeline layers (Agency Guardrail, Scaffolded Understanding, Multi-Perspective), and finally the Request Router and Data Fetcher that wire everything together.

## Tasks

- [x] 1. Set up project structure, shared interfaces, and data models
  - Create directory structure (`src/modules`, `src/pipeline`, `src/data`, `src/types`)
  - Define all shared TypeScript interfaces: `RoutedRequest`, `AnalysisModule`, `RawAnalysis`, `AnalysisSection`, `FactualClaim`, `Perspective`, `DataGap`, `Turn`
  - Define all data model interfaces: `LegislationRecord`, `Provision`, `GlossaryEntry`, `ProceduralStage`, `FinanceRecord`, `Contribution`, `FinanceBenchmark`, `DateRange`, `VotingRecord`, `VoteEntry`, `PublicStatement`, `DebateAnalysis`, `ArgumentStructure`, `RhetoricalTechnique`, `FramingAnalysis`, `LoadedPhrase`, `StructuralChoice`
  - Define pipeline interfaces: `GuardrailResult`, `GuardrailViolation`, `ScaffoldedResponse`, `FinalResponse`
  - Set up testing framework (e.g., Vitest + fast-check)
  - _Requirements: 1.4, 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 2. Implement the Agency Guardrail Enforcer
  - [x] 2.1 Implement `AgencyGuardrailEnforcer` class
    - Define the prohibited language pattern set (endorsements, normative language, corruption characterizations, debate winner declarations, intentional bias labels)
    - Implement `enforce(analysis: RawAnalysis): GuardrailResult` — scan each `AnalysisSection.content` against patterns, collect `GuardrailViolation` objects, return sanitized analysis or `scopeBoundaryMessage`
    - Implement scope-boundary message generation: inform user the question is out of scope, offer neutral reframing, do not answer the original question
    - _Requirements: 1.1, 1.2, 1.5, 3.3, 4.4, 5.2, 6.2_

  - [x] 2.2 Write property test for Guardrail Output Cleanliness (Property 1)
    - **Property 1: Guardrail Output Cleanliness**
    - Generate varied political queries across topics, tones, and phrasing styles; assert final response contains none of the prohibited language patterns
    - **Validates: Requirements 1.1, 1.2, 3.3, 4.4, 5.2, 6.2**
    - Tag: `Feature: hexagon-civic-literacy, Property 1: Guardrail Output Cleanliness`

  - [x] 2.3 Write property test for Redirect to Framework (Property 2)
    - **Property 2: Redirect to Framework**
    - Generate queries requesting political recommendations or summary judgments; assert response contains a named `Analytical_Framework` and at least one open-ended question, and contains no recommendation or conclusory assertion
    - **Validates: Requirements 1.3, 7.2**
    - Tag: `Feature: hexagon-civic-literacy, Property 2: Redirect to Framework`

  - [x] 2.4 Write unit tests for scope-boundary message
    - Test that a query that cannot be answered neutrally returns a `scopeBoundaryMessage` with neutral reframing and no answer
    - _Requirements: 1.5_

- [x] 3. Implement the Scaffolded Understanding Layer
  - [x] 3.1 Implement `ScaffoldedUnderstandingLayer` class
    - Implement `apply(analysis: RawAnalysis): ScaffoldedResponse` — extract `frameworkLabel` from `frameworksApplied`, append at least one open-ended `closingQuestion`, optionally populate `alternativeFrameworks`
    - _Requirements: 7.1, 7.3, 7.5_

  - [x] 3.2 Write property test for Scaffolded Output Structure (Property 11)
    - **Property 11: Scaffolded Output Structure**
    - For any module output, assert `ScaffoldedResponse` has non-empty `frameworkLabel` and at least one entry in `closingQuestions`
    - **Validates: Requirements 7.1, 7.3**
    - Tag: `Feature: hexagon-civic-literacy, Property 11: Scaffolded Output Structure`

- [x] 4. Implement the Multi-Perspective Layer
  - [x] 4.1 Implement `MultiPerspectiveLayer` class
    - Implement `apply(scaffolded: ScaffoldedResponse): FinalResponse` — verify `perspectives` array has ≥2 entries with distinct `stakeholderGroup` values; if only one credible perspective exists, mark as factual consensus; intercept one-sided requests and explain multi-perspective commitment
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 4.2 Write property test for Multi-Perspective Coverage and Balance (Property 13)
    - **Property 13: Multi-Perspective Coverage and Balance**
    - For any contested political topic analysis, assert `perspectives` has ≥2 entries with distinct `stakeholderGroup`, each with non-empty content, and no perspective's content length exceeds twice any other's
    - **Validates: Requirements 8.1, 8.2, 8.3, 2.4**
    - Tag: `Feature: hexagon-civic-literacy, Property 13: Multi-Perspective Coverage and Balance`

  - [x] 4.3 Write unit test for one-sided request handling
    - Test that a request for only one side triggers the multi-perspective explanation and offers the requested perspective alongside at least one alternative
    - _Requirements: 8.5_

- [x] 5. Checkpoint — Ensure all pipeline layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Content Type Labeling (shared module behavior)
  - [x] 6.1 Add `contentType` validation to `RawAnalysis` construction helpers
    - Implement a helper that ensures every `AnalysisSection` has a non-null `contentType` from `{fact, inference, opinion, framework, prompt}` and that at least one of `{fact, inference}` is present
    - _Requirements: 1.4_

  - [x] 6.2 Write property test for Content Type Labeling (Property 3)
    - **Property 3: Content Type Labeling**
    - For any analysis output, assert every `AnalysisSection.contentType` is non-null and in the allowed set, and the set of types present includes at least one of `{fact, inference}`
    - **Validates: Requirements 1.4**
    - Tag: `Feature: hexagon-civic-literacy, Property 3: Content Type Labeling`

- [x] 7. Implement the External Data Fetcher
  - [x] 7.1 Implement `DataFetcher` class with mocked/stub implementations
    - Implement `fetchLegislation(billId)`, `fetchFinanceData(entityId)`, `fetchVotingRecord(politicianId)` returning typed records or `null`
    - Implement `DataGap` responses for unavailable data, including `primarySources` lists (e.g., FEC.gov, OpenSecrets, congressional records)
    - _Requirements: 3.6, 5.5_

  - [x] 7.2 Write unit tests for unavailable data responses
    - Test that `null` returns from each fetcher method produce correctly structured `DataGap` responses with non-empty `primarySources`
    - _Requirements: 3.6, 5.5_

- [x] 8. Implement the Legislation Decoder module
  - [x] 8.1 Implement `LegislationDecoderModule` implementing `AnalysisModule`
    - Implement `analyze(request)`: validate input is a recognizable legislative document; extract `statedPurpose`, `keyProvisions`, `affectedParties`, `proceduralStage`; define inline glossary for legal jargon; include a "What to look for" section with at least one question; populate `perspectives` with ≥2 stakeholder viewpoints
    - Return `DataGap` response for non-legislative input
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 8.2 Write property test for Legislation Structured Output (Property 4)
    - **Property 4: Legislation Structured Output**
    - For any valid legislative input, assert output has non-empty `statedPurpose`, ≥1 `Provision`, ≥1 `affectedParties` entry, valid `ProceduralStage` with explanation, non-empty `glossaryTerms` when jargon present, and "What to look for" section containing ≥1 question
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
    - Tag: `Feature: hexagon-civic-literacy, Property 4: Legislation Structured Output`

  - [x] 8.3 Write unit test for non-legislative input rejection
    - Test that submitting non-legislative text returns a `DataGap` notification requesting a valid legislative source
    - _Requirements: 2.6_

- [x] 9. Implement the Funding Lens module
  - [x] 9.1 Implement `FundingLensModule` implementing `AnalysisModule`
    - Implement `analyze(request)`: retrieve `FinanceRecord` via `DataFetcher`; organize contributions by `donorCategory`, `amount`, `date`; populate `benchmarks` with contextual comparisons and legal contribution limits; populate `legalContext` with campaign finance law explanation; present incentive-mapping framework for donor relationships without asserting conclusions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 9.2 Write property test for Finance Structured Output (Property 5)
    - **Property 5: Finance Structured Output**
    - For any valid finance request, assert output has contributions with `donorCategory`, `amount`, `date` populated; non-empty `benchmarks`; non-empty `legalContext`
    - **Validates: Requirements 3.1, 3.2, 3.4**
    - Tag: `Feature: hexagon-civic-literacy, Property 5: Finance Structured Output`

- [x] 10. Implement the Debate Analyzer module
  - [x] 10.1 Implement `DebateAnalyzerModule` implementing `AnalysisModule`
    - Implement `analyze(request)`: reject input < 100 words with notification; identify `ArgumentStructure` per speaker (claim, evidence, warrant, `charitableInterpretation`, `logicalGaps`); identify `RhetoricalTechnique` objects with function descriptions; flag `FactualClaim` objects with `verifiable` and `evidenceProvided`; when asked who "won", present evaluative criteria without declaring a winner
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 10.2 Write property test for Debate Structured Output (Property 6)
    - **Property 6: Debate Structured Output**
    - For any input ≥100 words, assert ≥1 `ArgumentStructure` with non-empty `claim` and `charitableInterpretation`; ≥1 `RhetoricalTechnique` with non-empty `function`; ≥1 `FactualClaim` with `verifiable` and `evidenceProvided` set
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Tag: `Feature: hexagon-civic-literacy, Property 6: Debate Structured Output`

  - [x] 10.3 Write property test for Short Input Rejection (Property 7)
    - **Property 7: Short Input Rejection**
    - For any input with word count < 100, assert module returns a notification response (not an analysis output)
    - **Validates: Requirements 4.6**
    - Tag: `Feature: hexagon-civic-literacy, Property 7: Short Input Rejection`

- [x] 11. Implement the Track Record Explorer module
  - [x] 11.1 Implement `TrackRecordExplorerModule` implementing `AnalysisModule`
    - Implement `analyze(request)`: retrieve `VotingRecord` via `DataFetcher`; organize `VoteEntry` objects by `policyArea`, `date`, `finalOutcome`; surface statement/vote divergences presenting both without characterizing as hypocrisy; include legislative context per vote; include pattern-identification prompt in question form; support comparison view for a second political figure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 11.2 Write property test for Track Record Structured Output (Property 8)
    - **Property 8: Track Record Structured Output**
    - For any valid track record request, assert `VoteEntry` objects have non-empty `policyArea`, `date`, `finalOutcome`; divergences are surfaced for conflicting statement/vote pairs; pattern-identification prompt contains '?'
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
    - Tag: `Feature: hexagon-civic-literacy, Property 8: Track Record Structured Output`

  - [x] 11.3 Write unit test for comparison view availability
    - Test that a track record response includes a comparison view structure when a second figure is specified
    - _Requirements: 5.6_

- [x] 12. Implement the Bias & Framing Indicator module
  - [x] 12.1 Implement `BiasFramingIndicatorModule` implementing `AnalysisModule`
    - Implement `analyze(request)`: identify `LoadedPhrase` objects with `connotativeWeight`, `framingEffect`, `neutralAlternative`; identify `StructuralChoice` objects (ordering, omission, passive voice, emphasis); apply analysis consistently regardless of political orientation; when asked if source is "biased", present framing spectrum and evaluative questions; return `framingPatternsDetected: false` with `criteriaApplied` when no patterns found
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 12.2 Write property test for Framing Analysis Structured Output (Property 9)
    - **Property 9: Framing Analysis Structured Output**
    - For any source text with identifiable loaded language, assert ≥1 `LoadedPhrase` with non-empty `framingEffect` and `neutralAlternative`; ≥1 `StructuralChoice` when structural patterns present
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Tag: `Feature: hexagon-civic-literacy, Property 9: Framing Analysis Structured Output`

  - [x] 12.3 Write property test for Framing Consistency Across Political Orientations (Property 10)
    - **Property 10: Framing Consistency Across Political Orientations**
    - Generate matched pairs of texts with equivalent framing patterns but different political orientations; assert identified `LoadedPhrases` and `StructuralChoices` counts are within ±1 of each other
    - **Validates: Requirements 6.4**
    - Tag: `Feature: hexagon-civic-literacy, Property 10: Framing Consistency Across Political Orientations`

  - [x] 12.4 Write unit test for no-framing-patterns response
    - Test that neutral text returns `framingPatternsDetected: false` with non-empty `criteriaApplied`
    - _Requirements: 6.6_

- [x] 13. Checkpoint — Ensure all module tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement the Request Router
  - [x] 14.1 Implement `RequestRouter` class
    - Implement `route(userInput: string, history: Turn[]): RoutedRequest` — classify input to one of `{legislation, funding, debate, trackrecord, framing}`; extract `sourceText` and `entityId` where applicable; handle ambiguous requests by generating a clarification prompt
    - _Requirements: 2.1, 3.1, 4.1, 5.1, 6.1_

  - [x] 14.2 Write unit tests for routing classification
    - Test that representative inputs for each module are routed correctly
    - Test that ambiguous input produces a clarification prompt rather than a module dispatch

- [x] 15. Wire the full pipeline together
  - [x] 15.1 Implement `HexagonPipeline` class
    - Compose `RequestRouter` → module dispatch → `AgencyGuardrailEnforcer` → `ScaffoldedUnderstandingLayer` → `MultiPerspectiveLayer` → `FinalResponse`
    - Thread `conversationHistory` through each turn; implement follow-up context building without repeating previously covered material
    - _Requirements: 1.1, 1.2, 1.3, 7.4, 8.1_

  - [x] 15.2 Write property test for No Verbatim Repetition in Follow-Ups (Property 12)
    - **Property 12: No Verbatim Repetition in Follow-Ups**
    - Generate multi-turn conversation histories; assert no verbatim sequence of ≥10 consecutive words from the immediately preceding assistant response appears in the follow-up response
    - **Validates: Requirements 7.4**
    - Tag: `Feature: hexagon-civic-literacy, Property 12: No Verbatim Repetition in Follow-Ups`

  - [x] 15.3 Write integration tests for the full pipeline
    - Test end-to-end flow from user query through all layers to `FinalResponse` for each module type
    - Test conversation history threading across multiple turns
    - _Requirements: 1.1, 7.4, 8.1_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests must run a minimum of 100 iterations each using `fast-check`
- Checkpoints ensure incremental validation at each major phase boundary
- The guardrail and cross-cutting layers (tasks 2–4) are implemented before modules so modules can be tested through the full pipeline from the start
