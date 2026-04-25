/**
 * Dataset Chat Engine — routes natural language questions to MCP tools,
 * with Gemini AI as an intelligent fallback for questions that don't
 * map to a specific dataset.
 *
 * Priority order:
 *   1. Keyword-matched dataset tool → real Census/FEC/Congress data
 *   2. Gemini AI → knowledgeable civic literacy answers
 *   3. Static fallback → help text (only if Gemini is unavailable)
 */

import type { McpTool, ToolParams, ToolResult } from './tools.js';
import type { GeoScope } from '../types/index.js';
import { askGemini } from './geminiClient.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolUsed?: string;
  data?: ToolResult;
}

export class DatasetChatEngine {
  constructor(private tools: McpTool[]) {}

  /**
   * Process a user question:
   *   0. Check for recommendation/endorsement requests → guardrail block
   *   1. Try to match a dataset tool via keywords
   *   2. If matched → execute tool, return real data with citations
   *   3. If no match → ask Gemini for an AI-powered answer
   *   4. If Gemini unavailable → return static help text
   */
  async chat(
    question: string,
    geoScope: GeoScope,
    entityId?: string,
  ): Promise<ChatMessage> {
    const q = question.toLowerCase().trim();

    // ── Step 0: Agency Guardrail — block recommendation requests ────────────
    const guardrailResponse = this.checkGuardrail(q);
    if (guardrailResponse) {
      return guardrailResponse;
    }

    // ── Step 1: Try keyword-matched dataset tool ────────────────────────────
    const tool = this.matchTool(q);

    if (tool) {
      const params: ToolParams = { query: q, geoScope, entityId };
      const result = await tool.execute(params);

      let content = result.narrative;
      if (result.dataGaps.length > 0) {
        content += '\n\nNote: ' + result.dataGaps.map(g => g.description).join('. ');
      }
      content += `\n\nSource: ${result.sources.join(', ')}`;

      return {
        role: 'assistant',
        content,
        toolUsed: tool.name,
        data: result,
      };
    }

    // ── Step 2: Ask Gemini AI ───────────────────────────────────────────────
    const geminiResult = await askGemini(question);

    if (geminiResult.content) {
      return {
        role: 'assistant',
        content: geminiResult.content,
        toolUsed: 'gemini-ai',
      };
    }

    // ── Step 3: Static fallback (Gemini unavailable) ────────────────────────
    if (geminiResult.error) {
      // If it's a config issue, include the error so the user/dev knows
      const isConfigError = geminiResult.error.includes('not configured');
      if (isConfigError) {
        return {
          role: 'assistant',
          content: this.buildFallbackResponse(q) + '\n\n⚠️ ' + geminiResult.error,
        };
      }
    }

    return {
      role: 'assistant',
      content: this.buildFallbackResponse(q),
    };
  }

  /**
   * Agency Guardrail — detects requests for endorsements, recommendations,
   * or opinions on who to vote for. Returns a guardrail message if triggered,
   * or null if the question is safe to process.
   */
  private checkGuardrail(question: string): ChatMessage | null {
    const GUARDRAIL_PATTERNS = [
      /who\s+should\s+i\s+vote\s+for/,
      /who\s+do\s+you\s+recommend/,
      /who\s+would\s+you\s+vote\s+for/,
      /who\s+is\s+the\s+best\s+candidate/,
      /which\s+candidate\s+should/,
      /which\s+party\s+should/,
      /should\s+i\s+vote\s+(for|republican|democrat|independent)/,
      /tell\s+me\s+who\s+to\s+vote/,
      /recommend\s+(me\s+)?a\s+candidate/,
      /who\s+is\s+better/,
      /who\s+deserves\s+my\s+vote/,
      /endorse/,
      /pick\s+a\s+(candidate|side|party)/,
      /who\s+to\s+support/,
      /should\s+i\s+support/,
    ];

    const triggered = GUARDRAIL_PATTERNS.some(p => p.test(question));
    if (!triggered) return null;

    return {
      role: 'assistant',
      content:
        "I can't make that decision for you. Hexagon is designed to provide you with real, verified data " +
        "so you can make your own informed choice.\n\n" +
        "Here's what I can do instead:\n\n" +
        "• Show you each candidate's voting record from Congress.gov\n" +
        "• Break down their campaign finance sources from FEC data\n" +
        "• Compare candidates side-by-side on real metrics\n" +
        "• Pull demographic and economic data for your area\n\n" +
        "The data is here. The decision is yours.",
      toolUsed: 'guardrail',
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
          score += keyword.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestTool = tool;
      }
    }

    if (bestScore >= 3) return bestTool;

    // Secondary routing for common civic terms
    const SECONDARY_ROUTES: Record<string, string> = {
      infrastructure: 'labor_market',
      road: 'labor_market',
      transit: 'labor_market',
      transportation: 'labor_market',
      construction: 'labor_market',
      bridge: 'labor_market',
      crime: 'health_community',
      safety: 'health_community',
      hospital: 'health_community',
      doctor: 'health_community',
      medical: 'health_community',
      student: 'education_data',
      teacher: 'education_data',
      tuition: 'education_data',
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

    // No match — return null so Gemini handles it
    return null;
  }

  /**
   * Static fallback when both tools and Gemini are unavailable.
   */
  private buildFallbackResponse(question: string): string {
    return (
      `I wasn't able to find a dataset that directly answers "${question}". ` +
      'I can pull real data from the Census Bureau and FEC for Arizona. Try asking about:\n\n' +
      '• Demographics — "What is the population of Arizona?"\n' +
      '• Income & poverty — "What is the median household income?"\n' +
      '• Education — "What is the high school graduation rate?"\n' +
      '• Housing — "What is the median home value?"\n' +
      '• Health — "What percentage of residents are uninsured?"\n' +
      '• Jobs & labor — "What is the unemployment rate?"\n' +
      '• Community — "What is the veteran rate?" or "How many have broadband?"\n' +
      '• Campaign finance — "Show FEC data for Arizona candidates"\n' +
      '• Candidates — "Who is running for Senate in Arizona?"'
    );
  }

  /**
   * Returns the list of available tools for display in the UI.
   */
  getAvailableTools(): Array<{ name: string; description: string }> {
    return this.tools.map(t => ({ name: t.name, description: t.description }));
  }
}
