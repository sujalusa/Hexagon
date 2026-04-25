/**
 * Lightweight Gemini API client for the Hexagon chat fallback.
 *
 * When the keyword-based tool matcher can't route a question to a
 * real dataset, this client sends the question to Gemini with a
 * system prompt that keeps answers grounded in Arizona civic data.
 *
 * Uses the REST API directly — no SDK dependency needed.
 */

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const FETCH_TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT = `You are Hexagon, a civic literacy assistant focused on Arizona politics and public data.

Your job is to help voters and candidates understand political information clearly and factually.

Rules:
- Answer questions about Arizona senators, representatives, elections, legislation, and public policy.
- When you know specific facts (current officeholders, recent election results, policy positions), state them clearly.
- Always note when information may have changed since your training data.
- Never endorse or recommend candidates or parties.
- Never tell the user what to think or how to vote.
- Keep answers concise — 2-4 paragraphs max.
- If the question is about demographic or economic data (population, income, housing, etc.), tell the user to ask the data panel directly since it pulls live Census and FEC numbers.
- If you're unsure about a fact, say so rather than guessing.

Context: The user is on the Hexagon platform which has live data tools for:
- U.S. Census ACS 2023 (demographics, income, housing, education, jobs, health, broadband)
- FEC OpenFEC (campaign finance for Arizona candidates)
- Congress.gov (current members, voting records, legislation)

For data questions, suggest the user ask the data tools directly. For political knowledge questions, answer from your training data.`;

export interface GeminiResponse {
  content: string;
  error?: string;
}

/**
 * Calls the Gemini API with a user question and returns the response text.
 * Returns a graceful error message if the API key is missing or the call fails.
 */
export async function askGemini(question: string): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      content: '',
      error:
        'Gemini API key not configured. Add GEMINI_API_KEY to your .env file. ' +
        'Get a free key at https://aistudio.google.com/apikey',
    };
  }

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: question }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 800,
    },
  };

  let response: Response;
  try {
    response = await globalThis.fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'AbortError' || err.name === 'TimeoutError');
    if (isTimeout) {
      return { content: '', error: 'Gemini request timed out after 15 seconds.' };
    }
    return {
      content: '',
      error: `Network error calling Gemini: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      content: '',
      error: `Gemini API returned HTTP ${response.status}: ${text.slice(0, 200)}`,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { content: '', error: 'Failed to parse Gemini response.' };
  }

  // Extract text from Gemini response structure
  const candidates = (json as Record<string, unknown>).candidates as unknown[];
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { content: '', error: 'Gemini returned no candidates in response.' };
  }

  const firstCandidate = candidates[0] as Record<string, unknown>;
  const contentObj = firstCandidate.content as Record<string, unknown> | undefined;
  const parts = contentObj?.parts as unknown[] | undefined;

  if (!Array.isArray(parts) || parts.length === 0) {
    return { content: '', error: 'Gemini returned empty content.' };
  }

  const text = (parts[0] as Record<string, unknown>).text as string | undefined;
  return { content: text ?? '' };
}
