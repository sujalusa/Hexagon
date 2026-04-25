/**
 * Hexagon MCP Server — exposes Census/FEC datasets as MCP tools.
 * Runs as a stdio MCP server that Kiro can connect to.
 * 
 * Tools:
 *   census_query    — Fetch any ACS variable for Arizona
 *   fec_candidates  — List FEC candidates for Arizona
 *   fec_totals      — Get finance totals for a candidate
 *   compare_metric  — Compare a local value to the national average
 */

import { CensusClient } from '../data/CensusClient.js';
import { FecClient } from '../data/FecClient.js';
import { NATIONAL_AVERAGES } from '../types/index.js';
import type { GeoScope } from '../types/index.js';

const census = new CensusClient();
const fec = new FecClient();

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'census_query',
    description: 'Fetch a Census ACS variable or group for Arizona. Returns real data from api.census.gov.',
    inputSchema: {
      type: 'object',
      properties: {
        variable: { type: 'string', description: 'ACS variable code (e.g. B19013_001E) or group (e.g. B01001)' },
        geoType: { type: 'string', enum: ['state', 'county'], description: 'Geographic scope' },
        countyFips: { type: 'string', description: 'County FIPS code (only for county geoType)' },
      },
      required: ['variable'],
    },
  },
  {
    name: 'fec_candidates',
    description: 'List FEC-registered candidates for Arizona. Returns real data from api.open.fec.gov.',
    inputSchema: {
      type: 'object',
      properties: {
        office: { type: 'string', enum: ['H', 'S', 'P'], description: 'Office type: H=House, S=Senate, P=President' },
        district: { type: 'string', description: 'Congressional district number' },
      },
    },
  },
  {
    name: 'fec_totals',
    description: 'Get campaign finance totals for a specific FEC candidate ID.',
    inputSchema: {
      type: 'object',
      properties: {
        candidateId: { type: 'string', description: 'FEC candidate ID (e.g. H0AZ01234)' },
      },
      required: ['candidateId'],
    },
  },
  {
    name: 'compare_metric',
    description: 'Compare a local Arizona metric value to the US national average.',
    inputSchema: {
      type: 'object',
      properties: {
        metricKey: {
          type: 'string',
          description: 'Key from NATIONAL_AVERAGES (e.g. medianHouseholdIncome, povertyRate, uninsuredRate)',
        },
        localValue: { type: 'number', description: 'The local value to compare' },
      },
      required: ['metricKey', 'localValue'],
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'census_query') {
    const variable = String(args.variable || '');
    const geoType = String(args.geoType || 'state');
    const countyFips = args.countyFips ? String(args.countyFips) : undefined;

    const geoScope: GeoScope = geoType === 'county'
      ? { type: 'county', stateFips: '04', countyFips }
      : { type: 'state', fips: '04' };

    // Detect if it's a group or single variable
    if (variable.includes('_')) {
      // Single variable (e.g. B19013_001E)
      const result = await census.fetchVariable(variable, geoScope);
      if (typeof result === 'string') {
        return { variable, value: result, source: 'ACS 5-Year Estimates 2023' };
      }
      return { error: result.description, sources: result.primarySources };
    } else {
      // Group (e.g. B01001)
      const result = await census.fetchGroup(variable, geoScope);
      if (Array.isArray(result)) {
        return { group: variable, rows: result.slice(0, 3), rowCount: result.length, source: 'ACS 5-Year Estimates 2023' };
      }
      return { error: result.description, sources: result.primarySources };
    }
  }

  if (name === 'fec_candidates') {
    const office = args.office ? String(args.office) : undefined;
    const district = args.district ? String(args.district) : undefined;
    const result = await fec.fetchCandidates('AZ', office, district);
    if ('description' in result) {
      return { error: result.description, sources: result.primarySources };
    }
    return { candidates: result.results, count: result.pagination.count, source: 'OpenFEC API' };
  }

  if (name === 'fec_totals') {
    const candidateId = String(args.candidateId || '');
    const result = await fec.fetchCandidateTotals(candidateId);
    if ('description' in result) {
      return { error: result.description, sources: result.primarySources };
    }
    return {
      candidateId: result.entityId,
      name: result.entityName,
      totalRaised: result.totalRaised,
      period: result.reportingPeriod,
      source: 'OpenFEC API',
    };
  }

  if (name === 'compare_metric') {
    const metricKey = String(args.metricKey || '');
    const localValue = Number(args.localValue);
    const national = (NATIONAL_AVERAGES as Record<string, number>)[metricKey];
    if (national === undefined) {
      return { error: `Unknown metric key: ${metricKey}. Available: ${Object.keys(NATIONAL_AVERAGES).join(', ')}` };
    }
    const diff = localValue - national;
    const pctDiff = ((diff / national) * 100).toFixed(1);
    return {
      metricKey,
      localValue,
      nationalAverage: national,
      difference: diff,
      percentDifference: `${pctDiff}%`,
      direction: diff > 0 ? 'above' : diff < 0 ? 'below' : 'equal',
    };
  }

  return { error: `Unknown tool: ${name}` };
}

// ─── MCP stdio protocol ──────────────────────────────────────────────────────

let buffer = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  processBuffer();
});

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + contentLength) return;

    const body = buffer.slice(bodyStart, bodyStart + contentLength);
    buffer = buffer.slice(bodyStart + contentLength);

    try {
      const msg = JSON.parse(body);
      handleMessage(msg);
    } catch {
      // skip malformed messages
    }
  }
}

function send(msg: unknown) {
  const body = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  process.stdout.write(header + body);
}

async function handleMessage(msg: { id?: number; method?: string; params?: Record<string, unknown> }) {
  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'hexagon-datasets', version: '1.0.0' },
      },
    });
    return;
  }

  if (msg.method === 'notifications/initialized') {
    return; // no response needed
  }

  if (msg.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: { tools: TOOLS },
    });
    return;
  }

  if (msg.method === 'tools/call') {
    const toolName = String(msg.params?.name || '');
    const args = (msg.params?.arguments || {}) as Record<string, unknown>;
    try {
      const result = await executeTool(toolName, args);
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        },
      });
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: `Error: ${String(err)}` }],
          isError: true,
        },
      });
    }
    return;
  }

  // Unknown method
  if (msg.id !== undefined) {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      error: { code: -32601, message: `Method not found: ${msg.method}` },
    });
  }
}
