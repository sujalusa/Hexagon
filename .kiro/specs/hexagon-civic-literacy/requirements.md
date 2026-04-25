# Requirements Document

## Introduction

Hexagon is an AI-powered civic literacy tool designed to help users read, interpret, and contextualize political information — including legislation, campaign finance records, debate transcripts, and public statements — in the manner of a trained political scientist. Hexagon operates under a strict Agency Guardrail: it never tells users what to think, who to support, or what conclusions to draw. Instead, it equips users with analytical frameworks and structured explanations so they can form independent, informed judgments.

The system surfaces five core capabilities: a Legislation Decoder, a Funding Lens, a Debate Analyzer, a Track Record Explorer, and a Bias & Framing Indicator. All features share a common commitment to neutrality, multi-perspective context, and user agency.

## Glossary

- **Hexagon**: The AI civic literacy system described in this document.
- **Agency_Guardrail**: The system-wide constraint that prohibits Hexagon from making endorsements, recommendations, or normative political judgments.
- **Legislation_Decoder**: The Hexagon feature that explains the content, structure, and implications of legislative bills.
- **Funding_Lens**: The Hexagon feature that presents and contextualizes campaign finance data.
- **Debate_Analyzer**: The Hexagon feature that breaks down arguments, rhetoric, and framing techniques in political debates and speeches.
- **Track_Record_Explorer**: The Hexagon feature that organizes a politician's voting history and public actions into readable patterns.
- **Bias_Framing_Indicator**: The Hexagon feature that identifies language patterns and potential framing effects in political text.
- **Analytical_Framework**: A structured method for interpreting political data (e.g., incentive analysis, stakeholder mapping, historical pattern recognition).
- **User**: A person interacting with Hexagon to improve their civic understanding.
- **Source_Text**: Any political document, transcript, record, or statement submitted to or retrieved by Hexagon for analysis.
- **Inference**: A conclusion drawn from evidence that is not directly stated; distinct from verified fact.
- **Framing_Effect**: The influence that word choice, emphasis, or structure has on how information is perceived.

---

## Requirements

### Requirement 1: Agency Guardrail Enforcement

**User Story:** As a user, I want Hexagon to help me understand political information without steering my conclusions, so that I can form my own independent political judgments.

#### Acceptance Criteria

1. THE Hexagon SHALL refrain from recommending candidates, political parties, or policy positions in any response.
2. THE Hexagon SHALL refrain from using normative or prescriptive language (e.g., "you should support", "the right choice is") when presenting political analysis.
3. WHEN a user asks Hexagon for a political recommendation or opinion, THE Hexagon SHALL redirect the user toward relevant analytical frameworks and factual context without providing a recommendation.
4. WHEN generating any analysis, THE Hexagon SHALL distinguish explicitly between verified fact, inference, and opinion within the response.
5. IF a response cannot be generated without expressing a normative political judgment, THEN THE Hexagon SHALL inform the user that the question falls outside its scope and offer a neutral reframing of the inquiry.

---

### Requirement 2: Legislation Decoder

**User Story:** As a user, I want to understand what a legislative bill does and how to read it, so that I can evaluate it on my own terms.

#### Acceptance Criteria

1. WHEN a user submits a bill identifier or Source_Text of a legislative document, THE Legislation_Decoder SHALL produce a structured summary that explains the bill's stated purpose, key provisions, and affected parties.
2. WHEN a bill contains legal or legislative jargon, THE Legislation_Decoder SHALL define each term inline or in a glossary section of the response.
3. THE Legislation_Decoder SHALL explain the procedural stage of the bill (e.g., committee review, floor vote, signed into law) and what that stage means for the bill's status.
4. WHEN presenting a bill's potential impacts, THE Legislation_Decoder SHALL present at least two distinct interpretive perspectives drawn from identifiable stakeholder groups.
5. THE Legislation_Decoder SHALL include a "What to look for" section that prompts the user with analytical questions rather than conclusions (e.g., "Who are the named beneficiaries?" "What enforcement mechanisms are specified?").
6. IF a submitted Source_Text is not a recognizable legislative document, THEN THE Legislation_Decoder SHALL notify the user and request a valid legislative source.

---

### Requirement 3: Funding Lens

**User Story:** As a user, I want to understand how to interpret campaign finance data, so that I can draw my own conclusions about funding relationships without being led to assume intent or corruption.

#### Acceptance Criteria

1. WHEN a user requests campaign finance information for a candidate or political entity, THE Funding_Lens SHALL retrieve and display contribution data organized by donor category, amount, and time period.
2. THE Funding_Lens SHALL present contribution data alongside contextual benchmarks (e.g., average fundraising totals for comparable races, legal contribution limits) to support proportional interpretation.
3. WHEN displaying funding data, THE Funding_Lens SHALL refrain from characterizing any contribution or funding pattern as evidence of corruption, undue influence, or improper intent.
4. THE Funding_Lens SHALL include an explanation of how campaign finance law governs the displayed data, including relevant disclosure requirements.
5. WHEN a user asks what a funding relationship "means," THE Funding_Lens SHALL present the Analytical_Framework for interpreting donor relationships (e.g., alignment of interests, historical voting correlation) without asserting a conclusion.
6. IF campaign finance data for a requested entity is unavailable or incomplete, THEN THE Funding_Lens SHALL inform the user of the data gap and explain what public records sources the user could consult directly.

---

### Requirement 4: Debate Analyzer

**User Story:** As a user, I want to understand the structure and rhetorical techniques in a political debate or speech, so that I can evaluate arguments independently.

#### Acceptance Criteria

1. WHEN a user submits a debate transcript or speech Source_Text, THE Debate_Analyzer SHALL identify and label the logical structure of each major argument (e.g., claim, evidence, warrant).
2. THE Debate_Analyzer SHALL identify rhetorical techniques present in the Source_Text (e.g., appeal to emotion, appeal to authority, false dichotomy, anecdotal evidence) and explain each technique's function without evaluating whether its use was appropriate.
3. WHEN a factual claim is made in the Source_Text, THE Debate_Analyzer SHALL flag the claim as verifiable and indicate whether supporting evidence was provided within the Source_Text.
4. THE Debate_Analyzer SHALL present the strongest charitable interpretation of each speaker's argument alongside any identified logical gaps, without declaring one speaker's argument superior.
5. WHEN a user asks which speaker "won" a debate, THE Debate_Analyzer SHALL explain that debate outcomes depend on evaluative criteria and present a set of criteria the user can apply independently.
6. IF the submitted Source_Text contains fewer than 100 words or is not recognizable as a political speech or debate excerpt, THEN THE Debate_Analyzer SHALL notify the user and request a more complete source.

---

### Requirement 5: Track Record Explorer

**User Story:** As a user, I want to review a politician's voting history and public actions in an organized way, so that I can identify patterns and form my own assessment.

#### Acceptance Criteria

1. WHEN a user requests a track record for a named political figure, THE Track_Record_Explorer SHALL retrieve and display the figure's voting history organized by policy area, date range, and legislative outcome.
2. THE Track_Record_Explorer SHALL surface instances where a political figure's public statements and voting record diverge, presenting both the statement and the vote without characterizing the divergence as hypocrisy or inconsistency.
3. WHEN displaying a voting record, THE Track_Record_Explorer SHALL provide the legislative context for each vote (e.g., bill title, stated purpose, final outcome) so the user can interpret the vote in context.
4. THE Track_Record_Explorer SHALL include a pattern-identification prompt that invites the user to observe trends (e.g., "Do you notice any consistent alignment with a particular policy area?") rather than asserting a pattern on the user's behalf.
5. IF voting or public record data for a requested political figure is unavailable, THEN THE Track_Record_Explorer SHALL inform the user and provide guidance on primary sources (e.g., official congressional records, public archives) the user can consult.
6. WHILE a user is reviewing a track record, THE Track_Record_Explorer SHALL make available a comparison view that displays the same data categories for a second political figure selected by the user.

---

### Requirement 6: Bias & Framing Indicator

**User Story:** As a user, I want to understand how language and framing in political text may influence perception, so that I can read sources more critically.

#### Acceptance Criteria

1. WHEN a user submits a Source_Text for framing analysis, THE Bias_Framing_Indicator SHALL identify specific words or phrases that carry connotative weight and explain the potential Framing_Effect of each.
2. THE Bias_Framing_Indicator SHALL present neutral alternative phrasings for identified loaded language to illustrate how word choice shapes meaning, without labeling the original framing as biased, misleading, or intentional.
3. WHEN analyzing a Source_Text, THE Bias_Framing_Indicator SHALL identify structural choices (e.g., ordering of information, omission of context, use of passive voice) that may affect how the content is perceived.
4. THE Bias_Framing_Indicator SHALL apply its analysis consistently regardless of the political affiliation or ideological orientation associated with the Source_Text.
5. WHEN a user asks whether a source is "biased," THE Bias_Framing_Indicator SHALL explain that framing exists on a spectrum, present the identified framing patterns, and offer the user a set of questions to evaluate the source independently.
6. IF a submitted Source_Text contains no identifiable framing patterns or loaded language, THEN THE Bias_Framing_Indicator SHALL inform the user that no significant framing indicators were detected and explain what criteria were applied.

---

### Requirement 7: Scaffolded Understanding & User Prompting

**User Story:** As a user, I want Hexagon to guide my thinking with questions and frameworks rather than conclusions, so that I develop my own analytical skills over time.

#### Acceptance Criteria

1. THE Hexagon SHALL conclude each analytical response with at least one open-ended question that invites the user to apply the presented framework to their own interpretation.
2. WHEN a user requests a direct conclusion or summary judgment on a political matter, THE Hexagon SHALL provide the relevant factual context and Analytical_Framework, then prompt the user with a question that supports self-directed reasoning.
3. THE Hexagon SHALL make its Analytical_Framework explicit in each response by naming the interpretive lens being applied (e.g., "This analysis uses an incentive-mapping framework").
4. WHEN a user engages with a follow-up question or deepens an inquiry, THE Hexagon SHALL build on the prior context and introduce a more advanced analytical layer without repeating previously covered material.
5. THE Hexagon SHALL offer the user the option to explore an alternative Analytical_Framework for the same Source_Text when more than one applicable framework exists.

---

### Requirement 8: Multi-Perspective Context

**User Story:** As a user, I want to see multiple interpretations of political information, so that I understand the range of reasonable perspectives before forming my own view.

#### Acceptance Criteria

1. WHEN presenting analysis of any political topic, THE Hexagon SHALL include at least two distinct interpretive perspectives that represent different stakeholder viewpoints or analytical traditions.
2. THE Hexagon SHALL label each perspective with its associated stakeholder group or analytical tradition and explain the reasoning underlying that perspective.
3. THE Hexagon SHALL present perspectives with equivalent depth and clarity, without structuring the response in a way that privileges one perspective over another through ordering, length, or tone.
4. WHEN only one credible perspective exists on a factual matter, THE Hexagon SHALL present that perspective as the factual consensus and distinguish it from matters where reasonable disagreement exists.
5. IF a user requests that Hexagon present only one side of an issue, THEN THE Hexagon SHALL explain its multi-perspective commitment and offer to present the requested perspective alongside at least one alternative.
