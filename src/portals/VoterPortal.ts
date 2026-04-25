import type { Turn, FinalResponse } from '../types/index.js';
import { HexagonPipeline } from '../pipeline/HexagonPipeline.js';
import type { CensusClient } from '../data/CensusClient.js';
import type { FecClient } from '../data/FecClient.js';

export class VoterPortal {
  private pipeline: HexagonPipeline;

  constructor(
    private censusClient: CensusClient,
    private fecClient: FecClient,
  ) {
    // HexagonPipeline uses its own internal module instances.
    // The injected clients are available for direct module use when needed.
    this.pipeline = new HexagonPipeline();
  }

  async process(
    userInput: string,
    history: Turn[],
  ): Promise<FinalResponse | { scopeBoundaryMessage: string }> {
    return this.pipeline.process(userInput, history);
  }
}
