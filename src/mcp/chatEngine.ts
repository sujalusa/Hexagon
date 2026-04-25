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

    // Require a minimum match score
    return bestScore >= 3 ? bestTool : null;
  }

  /**
   * Fallback when no tool matches.
   */
  private buildFallbackResponse(question: string): string {
    return (
      'I can answer questions about Arizona using real Census Bureau and FEC data. ' +
      'Try asking about:\n\n' +
      '• Demographics — "What is the population of Arizona?"\n' +
      '• Income & poverty — "What is the median household income?"\n' +
      '• Education — "What is the high school graduation rate?"\n' +
      '• Housing — "What is the median home value?"\n' +
      '• Health — "What percentage of residents are uninsured?"\n' +
      '• Jobs — "What is the unemployment rate?"\n' +
      '• Community — "What is the veteran rate?" or "How many have broadband?"\n' +
      '• Campaign finance — "Show FEC data for Arizona candidates"\n\n' +
      'All answers come from real public datasets with source citations.'
    );
  }

  /**
   * Returns the list of available tools for display in the UI.
   */
  getAvailableTools(): Array<{ name: string; description: string }> {
    return this.tools.map(t => ({ name: t.name, description: t.description }));
  }
}
