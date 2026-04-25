import express from 'express';
import { VoterPortal } from '../portals/VoterPortal.js';
import { CandidatePortal } from '../portals/CandidatePortal.js';
import { CandidateBreakdownService } from '../portals/CandidateBreakdown.js';
import { CensusClient } from '../data/CensusClient.js';
import { FecClient } from '../data/FecClient.js';
import { createToolRegistry } from '../mcp/tools.js';
import { DatasetChatEngine } from '../mcp/chatEngine.js';
import type { FinalResponse, ConstituentProfileRequest, GeoScope } from '../types/index.js';

const app = express();
app.use(express.json());
app.use(express.static('src/server/public'));

const censusClient = new CensusClient();
const fecClient = new FecClient();
const voterPortal = new VoterPortal(censusClient, fecClient);
const candidatePortal = new CandidatePortal(censusClient, fecClient);
const breakdownService = new CandidateBreakdownService(fecClient);

// MCP-powered chat engine
const tools = createToolRegistry(censusClient, fecClient);
const chatEngine = new DatasetChatEngine(tools);

// ── Voter Portal API ──────────────────────────────────────────────────────────

app.post('/api/voter/query', async (req, res) => {
  try {
    const { query, history = [] } = req.body as { query: string; history: unknown[] };
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'query is required' });
      return;
    }
    const result = await voterPortal.process(query, history as never);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Candidate Breakdown API (Arizona) ─────────────────────────────────────────

app.get('/api/voter/az-candidates', async (req, res) => {
  try {
    const office = typeof req.query.office === 'string' ? req.query.office : undefined;
    const result = await breakdownService.listAzCandidates(office);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/voter/candidate-digest/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const name = typeof req.query.name === 'string' ? req.query.name : undefined;
    const office = typeof req.query.office === 'string' ? req.query.office : undefined;
    const district = typeof req.query.district === 'string' ? req.query.district : undefined;
    const digest = await breakdownService.getDigest(id, name, office, district);
    res.json(digest);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Candidate Portal API ──────────────────────────────────────────────────────

app.post('/api/candidate/profile', async (req, res) => {
  try {
    const body = req.body as Partial<ConstituentProfileRequest>;
    const request: ConstituentProfileRequest = {
      geoScope: body.geoScope ?? { type: 'state', fips: '04' },
      candidateFecId: body.candidateFecId,
      officeType: body.officeType,
      district: body.district,
    };
    const profile = await candidatePortal.getConstituentProfile(request);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── MCP Dataset Chat API ──────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  try {
    const { question, geoScope, entityId } = req.body as {
      question: string;
      geoScope?: GeoScope;
      entityId?: string;
    };
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'question is required' });
      return;
    }
    const geo: GeoScope = geoScope ?? { type: 'state', fips: '04' };
    const response = await chatEngine.chat(question, geo, entityId);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/chat/tools', (_req, res) => {
  res.json(chatEngine.getAvailableTools());
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`\n🔷 Hexagon server running at http://localhost:${PORT}`);
  console.log(`   Voter Portal  → http://localhost:${PORT}/voter.html (AZ candidate breakdown)`);
  console.log(`   Candidate Portal → http://localhost:${PORT}/candidate.html`);
  console.log(`   MCP Chat API  → POST http://localhost:${PORT}/api/chat`);
  console.log(`   MCP Tools     → GET  http://localhost:${PORT}/api/chat/tools\n`);
});
