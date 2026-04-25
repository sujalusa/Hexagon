/**
 * Dataset Chat Engine — routes natural language questions to MCP tools.
 * No external LLM needed. Uses keyword matching + dataset tools.
 * Always responds with real data and source citations.
 */

import type { McpTool, ToolParams, ToolResult } from './tools.js';
import type { GeoScope } from '../types/index.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolUsed?: string;
  data?: ToolResult;
}

export class DatasetChatEngine {
  constructor(private tools: McpTool[]) {}

  /**
   * Process a user question by matching it to the best tool,
   * executing the tool against real datasets, and formatting
   * a response with citations.
   */
  async chat(
    question: string,
    geoScope: GeoScope,
    entityId?: string,
  ): Promise<ChatMessage> {
    const q = question.toLowerCase().trim();

    // ── Match question to best tool ─────────────────────────────────────────
    const tool = this.matchTool(q);

    if (!tool) {
      return {
        role: 'assistant',
        content: this.buildFallbackResponse(q),
      };
    }

    // ── Execute tool against real data ──────────────────────────────────────
    const params: ToolParams = { query: q, geoScope, entityId };
    const result = await tool.execute(params);

    // ── Format response ─────────────────────────────────────────────────────
    let content = result.narrative;

    // Add data gap notes
    if (result.dataGaps.length > 0) {
      content += '\n\nNote: ' + result.dataGaps.map(g => g.description).join('. ');
    }

    // Add source citation
    content += `\n\nSource: ${result.sources.join(', ')}`;

    return {
      role: 'assistant',
      content,
      toolUsed: tool.name,
      data: result,
    };
  }

  /**
   * Matches a question to the best tool using keyword scoring.
   * Falls back to a secondary political-keyword map so questions about
   * senators, representatives, infrastructure, etc. still route somewhere.
   */
  private matchTool(question: string): McpTool | null {
    let bestTool: McpTool | null = null;
    let bestScore = 0;

    for (const tool of this.tools) {
      let score = 0;
      for (const keyword of tool.keywords) {
        if (question.includes(keyword.toLowerCase())) {
          // Longer keyword matches are worth more
          score += keyword.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestTool = tool;
      }
    }

    if (bestScore >= 3) return bestTool;

    // Secondary routing: map common political/civic terms to the most
    // relevant dataset tool so users don't hit the fallback wall.
    const SECONDARY_ROUTES: Record<string, string> = {
      // People / offices → current representatives (Congress.gov)
      senator: 'current_representatives',
      senate: 'current_representatives',
      representative: 'current_representatives',
      congressman: 'current_representatives',
      congresswoman: 'current_representatives',
      politician: 'current_representatives',
      elected: 'current_representatives',
      incumbent: 'current_representatives',
      // Campaign / election → FEC finance
      candidate: 'fec_finance',
      election: 'fec_finance',
      running: 'fec_finance',
      donor: 'fec_finance',
      // Infrastructure / policy topics → labor or economic data
      infrastructure: 'labor_market',
      road: 'labor_market',
      transit: 'labor_market',
      transportation: 'labor_market',
      construction: 'labor_market',
      bridge: 'labor_market',
      // Social topics → health/community
      crime: 'health_community',
      safety: 'health_community',
      hospital: 'health_community',
      doctor: 'health_community',
      medical: 'health_community',
      // Education-adjacent
      student: 'education_data',
      teacher: 'education_data',
      tuition: 'education_data',
      // Housing-adjacent
      affordable: 'housing_data',
      homeless: 'housing_data',
      shelter: 'housing_data',
    };

    for (const [keyword, toolName] of Object.entries(SECONDARY_ROUTES)) {
      if (question.includes(keyword)) {
        const matched = this.tools.find(t => t.name === toolName);
        if (matched) return matched;
      }
    }

    return null;
  }

  /**
   * Fallback when no tool matches.
   */
  private buildFallbackResponse(question: string): string {
    return (
      `I wasn't able to find a dataset that directly answers "${question}". ` +
      'I can pull real data from the Census Bureau and FEC for Arizona. Here are some things I can answer:\n\n' +
      '• Demographics — "What is the population of Arizona?"\n' +
      '• Income & poverty — "What is the median household income?"\n' +
      '• Education — "What is the high school graduation rate?"\n' +
      '• Housing — "What is the median home value?"\n' +
      '• Health — "What percentage of residents are uninsured?"\n' +
      '• Jobs & labor — "What is the unemployment rate?"\n' +
      '• Community — "What is the veteran rate?" or "How many have broadband?"\n' +
      '• Campaign finance — "Show FEC data for Arizona candidates"\n' +
      '• Candidates — "Who is running for Senate in Arizona?"\n\n' +
      'Try rephrasing your question around one of these topics.'
    );
  }

  /**
   * Returns the list of available tools for display in the UI.
   */
  getAvailableTools(): Array<{ name: string; description: string }> {
    return this.tools.map(t => ({ name: t.name, description: t.description }));
  }
}
