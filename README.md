# 🛡 HEXAGON — Shield for American Democracy

> **HEXAGON does not tell voters who to trust. It shows them why something can be trusted.**

Hexagon is an AI-powered civic literacy platform built for the **Education** challenge frame under the **Agency Guardrail** constraint. The AI is the scaffolding, not the solution — it empowers voters and candidates to understand political information independently, without doing the thinking for them.

**Live demo:** `npm run server` → http://localhost:3001

---

## The Problem

Voters are overwhelmed by political information — campaign ads, news coverage, social media claims — but lack the tools to verify, contextualize, and critically evaluate what they see. Most political tools either tell users what to think (violating agency) or dump raw data without context (useless to non-experts).

## The Solution

Hexagon sits in the middle: it pulls **real, verified data** from government APIs and presents it through **analytical frameworks** that teach users how to think about political information — without ever telling them what to conclude.

The AI scaffolds understanding by:
- Naming the analytical framework being applied (e.g., "Incentive Mapping Framework")
- Presenting multiple stakeholder perspectives with equal depth
- Ending every analysis with open-ended questions, not conclusions
- Blocking any attempt to get endorsements or recommendations (Agency Guardrail)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (3 pages)                    │
│  index.html (onboarding) → voter.html / candidate.html      │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────┐
│                     Express Server                           │
│  /api/voter/query    /api/candidate/profile    /api/chat     │
└──────┬───────────────────┬─────────────────────┬────────────┘
       │                   │                     │
┌──────▼──────┐  ┌────────▼────────┐  ┌─────────▼──────────┐
│ VoterPortal │  │ CandidatePortal │  │  MCP Chat Engine   │
│             │  │                 │  │  ┌──────────────┐  │
│ Hexagon     │  │ 12 parallel     │  │  │ 8 Dataset    │  │
│ Pipeline    │  │ Census fetches  │  │  │ Tools        │  │
│ ┌─────────┐ │  │ + FEC finance   │  │  ├──────────────┤  │
│ │ Router  │ │  │ + ProfileBuilder│  │  │ Gemini AI    │  │
│ │ 5 Mods  │ │  │                 │  │  │ Fallback     │  │
│ │Guardrail│ │  │ No pipeline     │  │  ├──────────────┤  │
│ │Scaffold │ │  │ (factual data   │  │  │ Agency       │  │
│ │MultiPerp│ │  │  only)          │  │  │ Guardrail    │  │
│ └─────────┘ │  │                 │  │  └──────────────┘  │
└──────┬──────┘  └────────┬────────┘  └─────────┬──────────┘
       │                  │                      │
┌──────▼──────────────────▼──────────────────────▼────────────┐
│                      Data Layer                              │
│  CensusClient (ACS API)  │  FecClient (OpenFEC)             │
│  DataFetcher (Congress.gov) │  Gemini Client (optional)      │
└──────┬──────────────────────┬───────────────────┬───────────┘
       │                      │                   │
   Census Bureau          FEC.gov           Congress.gov
   api.census.gov     api.open.fec.gov    api.congress.gov
```

---

## Spec-Driven Development

This project was built using **Kiro's spec-driven development** workflow. Every feature was specified as requirements → design → implementation tasks before any code was written.

### Spec 1: Hexagon Civic Literacy (Core Pipeline)

| Document | Path | What it covers |
|----------|------|----------------|
| **Requirements** | `.kiro/specs/hexagon-civic-literacy/requirements.md` | 8 requirements with 40+ acceptance criteria covering the Agency Guardrail, 5 analysis modules, scaffolded understanding, and multi-perspective context |
| **Design** | `.kiro/specs/hexagon-civic-literacy/design.md` | Pipeline architecture, component interfaces, data models, 13 correctness properties, error handling, and testing strategy |
| **Tasks** | `.kiro/specs/hexagon-civic-literacy/tasks.md` | 16 implementation tasks with requirement traceability, all completed ✅ |

### Spec 2: Hexagon Portals (Live Data)

| Document | Path | What it covers |
|----------|------|----------------|
| **Requirements** | `.kiro/specs/hexagon-portals/requirements.md` | 20 requirements covering Census ACS integration, FEC OpenFEC integration, Voter Portal, Candidate Portal, caching, and API response parsing |
| **Design** | `.kiro/specs/hexagon-portals/design.md` | Portal architecture, data flow diagrams (Mermaid), 9 correctness properties, error handling for every failure mode, and testing strategy |
| **Tasks** | `.kiro/specs/hexagon-portals/tasks.md` | 8 major tasks with subtasks, property test specifications, all completed ✅ |

### Correctness Properties

The specs define **22 formal correctness properties** that are verified by property-based tests using `fast-check` (100+ iterations each):

| # | Property | What it guarantees |
|---|----------|--------------------|
| 1 | Guardrail Output Cleanliness | No endorsements, normative language, or corruption characterizations in any output |
| 2 | Redirect to Framework | Recommendation requests get frameworks + questions, never answers |
| 3 | Content Type Labeling | Every section is labeled as fact/inference/opinion/framework/prompt |
| 4 | Legislation Structured Output | Bills produce purpose, provisions, parties, stage, glossary, and prompts |
| 5 | Finance Structured Output | Finance data includes contributions, benchmarks, and legal context |
| 6 | Debate Structured Output | Debates produce arguments, rhetoric, claims, and charitable interpretations |
| 7 | Short Input Rejection | Texts under 100 words are rejected with a request for more content |
| 8 | Track Record Structured Output | Voting records include policy areas, divergences, and pattern prompts |
| 9 | Framing Analysis Output | Loaded phrases get neutral alternatives; structural choices are identified |
| 10 | Framing Consistency | Same framing patterns get equivalent analysis regardless of political orientation |
| 11 | Scaffolded Output Structure | Every response names its framework and ends with questions |
| 12 | No Verbatim Repetition | Follow-up responses don't repeat previous content verbatim |
| 13 | Multi-Perspective Balance | At least 2 perspectives, no perspective 2x longer than another |
| A | MeasurementEntry Completeness | Every data point has name, value, unit, and source |
| B | KeyIssuesContext Count | 0–5 key issues per profile |
| C | KeyIssuesContext Ordering | Sorted by divergence magnitude (descending) |
| D | No Characterization Labels | No "problem", "crisis", "opportunity" labels on any data |
| E | Cache Round-Trip | Cached values are identical when retrieved |
| F | ACS Parse Round-Trip | Census data survives parse → serialize → parse |
| G | FEC Parse Round-Trip | FEC data survives parse → serialize → parse |
| H | Null → DataGap Substitution | Missing Census values become DataGaps, never nulls |
| I | Voter Portal Pass-Through | Every voter response passes through all pipeline layers |

---

## Features

### Voter Portal (`/voter.html`)
- **Candidate Grid** — Every federal candidate registered in Arizona via FEC OpenFEC API
- **Candidate Dossier** — Per-candidate deep dive with:
  - Live FEC finance (total raised, spent, cash on hand, debt, source-of-funds mix, top employers, contribution sizes)
  - Live Congress.gov voting record with party-line alignment
  - Promise tracker, language drift detection, ethics flags (demo data, clearly labeled)
- **Side-by-Side Comparison** — Compare up to 4 candidates
- **MCP Chat Panel** — Ask questions answered by real data:
  - 8 dataset tools (demographics, economic, housing, health, education, FEC, labor, current representatives)
  - Gemini AI fallback for political knowledge questions
  - Agency Guardrail blocks recommendation requests

### Candidate Portal (`/candidate.html`)
- **Constituent Profile** — 12 data categories from Census ACS 2023:
  - Demographics, economic, education, housing, labor market, language access, commute, health insurance, veterans, disability, broadband, household composition
- **National Average Comparisons** — Every metric compared to US averages
- **Key Issues Context** — Top 5 metrics where local values diverge most from national norms (no policy labels)
- **FEC Finance Summary** — Candidate's own totals + race totals

### Analysis Pipeline (5 Modules)
| Module | What it does | Data source |
|--------|-------------|-------------|
| Legislation Decoder | Explains bills: purpose, provisions, parties, stage, glossary | Congress.gov API |
| Funding Lens | Contextualizes campaign finance with benchmarks and legal context | FEC OpenFEC API |
| Debate Analyzer | Breaks down arguments, rhetoric, and factual claims | User-submitted text |
| Track Record Explorer | Organizes voting history with divergence detection | Congress.gov API |
| Bias & Framing Indicator | Identifies loaded language and structural framing choices | User-submitted text |

### Agency Guardrail (enforced everywhere)
- Blocks endorsements, normative language, corruption characterizations
- Blocks debate winner declarations and intentional bias labels
- Chat guardrail catches "Who should I vote for?" and 15+ variations
- Returns: "I can't make that decision for you. The data is here. The decision is yours."

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript (ES2022) |
| Server | Express 4 |
| Build | tsx (no compile step needed) |
| Testing | Vitest + fast-check (property-based) |
| AI Fallback | Google Gemini 2.0 Flash (optional) |
| APIs | Census ACS 2023, FEC OpenFEC, Congress.gov v3 |
| Dev Tool | Kiro (spec-driven development, hooks, steering, MCP) |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure API keys in .env
#    CONGRESS_API_KEY — free from api.congress.gov/sign-up
#    OPEN_FEC_API_KEY — free from api.data.gov/signup
#    GEMINI_API_KEY   — free from aistudio.google.com/apikey (optional)

# 3. Start the server
npm run server

# 4. Open in browser
#    http://localhost:3001          — Onboarding
#    http://localhost:3001/voter.html     — Voter Portal
#    http://localhost:3001/candidate.html — Candidate Portal

# 5. Run tests
npm test

# 6. Type check
npm run typecheck
```

---

## Project Structure

```
src/
├── data/                    # API clients
│   ├── CensusClient.ts      # Census ACS API (1hr cache)
│   ├── FecClient.ts         # FEC OpenFEC API (15min cache)
│   └── DataFetcher.ts       # Congress.gov API
├── mcp/                     # MCP + Chat
│   ├── chatEngine.ts        # Hybrid: tools → Gemini → fallback
│   ├── geminiClient.ts      # Gemini 2.0 Flash REST client
│   ├── mcpServer.ts         # MCP stdio server (4 tools)
│   └── tools.ts             # 8 dataset tools for chat
├── modules/                 # 5 analysis modules
│   ├── LegislationDecoderModule.ts
│   ├── FundingLensModule.ts
│   ├── DebateAnalyzerModule.ts
│   ├── TrackRecordExplorerModule.ts
│   └── BiasFramingIndicatorModule.ts
├── pipeline/                # Processing layers
│   ├── RequestRouter.ts
│   ├── HexagonPipeline.ts
│   ├── AgencyGuardrailEnforcer.ts
│   ├── ScaffoldedUnderstandingLayer.ts
│   ├── MultiPerspectiveLayer.ts
│   └── analysisHelpers.ts
├── portals/                 # Portal orchestrators
│   ├── VoterPortal.ts
│   ├── CandidatePortal.ts
│   ├── CandidateBreakdown.ts
│   └── ProfileBuilder.ts
├── server/
│   ├── index.ts             # Express server (6 endpoints)
│   └── public/              # Frontend HTML
│       ├── index.html        # Onboarding wizard
│       ├── voter.html        # Voter Portal
│       └── candidate.html    # Candidate Portal
└── types/
    └── index.ts             # 50+ TypeScript interfaces

.kiro/
├── specs/
│   ├── hexagon-civic-literacy/   # Core pipeline spec
│   │   ├── requirements.md       # 8 requirements, 40+ acceptance criteria
│   │   ├── design.md             # Architecture, 13 properties
│   │   └── tasks.md              # 16 tasks (all ✅)
│   └── hexagon-portals/          # Live data portals spec
│       ├── requirements.md       # 20 requirements
│       ├── design.md             # Architecture, 9 properties
│       └── tasks.md              # 8 tasks (all ✅)
└── settings/
    └── mcp.json                  # MCP server config
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/voter/query` | Voter pipeline query (legislation, funding, debate, track record, framing) |
| GET | `/api/voter/az-candidates` | List AZ candidates from FEC (filterable by office) |
| GET | `/api/voter/candidate-digest/:id` | Full candidate dossier (finance + voting + demo) |
| POST | `/api/candidate/profile` | Constituent demographic profile from Census ACS |
| POST | `/api/chat` | MCP chat — dataset tools + Gemini AI + guardrail |
| GET | `/api/chat/tools` | List available MCP tools |

---

## Test Suite

22 test files covering unit tests, integration tests, and property-based tests:

```bash
npm test          # Run all tests (single execution)
npm run test:watch  # Watch mode
```

| Category | Files | Coverage |
|----------|-------|----------|
| Data layer | 5 | Census parsing, FEC parsing, round-trips, error paths |
| Modules | 7 | All 5 modules + property tests for structured output |
| Pipeline | 9 | Guardrail, scaffolding, multi-perspective, routing, content types |
| Portals | 6 | Voter pass-through, candidate profiles, key issues |

---

## License

Built for the ASU + Amazon Kiro Hackathon 2025 — Education frame, Agency Guardrail constraint.
