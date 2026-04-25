import express from 'express';
import { VoterPortal } from '../portals/VoterPortal.js';
import { CandidatePortal } from '../portals/CandidatePortal.js';
import { CensusClient } from '../data/CensusClient.js';
import { FecClient } from '../data/FecClient.js';
import type { FinalResponse, ConstituentProfileRequest } from '../types/index.js';

const app = express();
app.use(express.json());
app.use(express.static('src/server/public'));

const censusClient = new CensusClient();
const fecClient = new FecClient();
const voterPortal = new VoterPortal(censusClient, fecClient);
const candidatePortal = new CandidatePortal(censusClient, fecClient);

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

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`\n🔷 Hexagon server running at http://localhost:${PORT}`);
  console.log(`   Voter Portal  → http://localhost:${PORT}/voter.html`);
  console.log(`   Candidate Portal → http://localhost:${PORT}/candidate.html\n`);
});
