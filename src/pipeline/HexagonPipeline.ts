import type { Turn, FinalResponse } from '../types/index.js';
import { RequestRouter } from './RequestRouter.js';
import { AgencyGuardrailEnforcer } from './AgencyGuardrailEnforcer.js';
import { ScaffoldedUnderstandingLayer } from './ScaffoldedUnderstandingLayer.js';
import { MultiPerspectiveLayer } from './MultiPerspectiveLayer.js';
import { LegislationDecoderModule } from '../modules/LegislationDecoderModule.js';
import { FundingLensModule } from '../modules/FundingLensModule.js';
import { DebateAnalyzerModule } from '../modules/DebateAnalyzerModule.js';
import { TrackRecordExplorerModule } from '../modules/TrackRecordExplorerModule.js';
import { BiasFramingIndicatorModule } from '../modules/BiasFramingIndicatorModule.js';
import type { AnalysisModule, RoutedRequest } from '../types/index.js';

const MODULE_MAP: Record<RoutedRequest['moduleId'], AnalysisModule> = {
  legislation: new LegislationDecoderModule(),
  funding: new FundingLensModule(),
  debate: new DebateAnalyzerModule(),
  trackrecord: new TrackRecordExplorerModule(),
  framing: new BiasFramingIndicatorModule(),
};

export class HexagonPipeline {
  private router = new RequestRouter();
  private guardrail = new AgencyGuardrailEnforcer();
  private scaffolder = new ScaffoldedUnderstandingLayer();
  private perspectives = new MultiPerspectiveLayer();

  async process(
    userInput: string,
    history: Turn[]
  ): Promise<FinalResponse | { scopeBoundaryMessage: string }> {
    // Thread conversation history: append user turn
    const updatedHistory: Turn[] = [...history, { role: 'user', content: userInput }];

    // 1. Route the request
    const routed = this.router.route(userInput, updatedHistory);

    // 2. Build follow-up context when history is non-empty
    if (history.length > 0) {
      const followUpNote =
        '\n\n[Context: This is a follow-up question. Previously covered material should not be repeated.]';
      routed.sourceText = (routed.sourceText ?? '') + followUpNote;
    }

    // 3. Dispatch to the appropriate module
    const module = MODULE_MAP[routed.moduleId];
    const rawAnalysis = await module.analyze(routed);

    // 4. Run guardrail enforcement
    const guardrailResult = this.guardrail.enforce(rawAnalysis);

    if (!guardrailResult.passed) {
      return { scopeBoundaryMessage: guardrailResult.scopeBoundaryMessage! };
    }

    // 5. Scaffold the sanitized analysis
    const scaffolded = this.scaffolder.apply(guardrailResult.sanitizedAnalysis!);

    // 6. Apply multi-perspective layer
    const finalResponse = this.perspectives.apply(scaffolded);

    // 7. Append assistant turn to history (mutate the passed-in array for caller awareness)
    const assistantContent = scaffolded.analysis.sections
      .map((s) => `${s.title}: ${s.content}`)
      .join('\n\n');
    updatedHistory.push({ role: 'assistant', content: assistantContent, moduleId: routed.moduleId });

    return finalResponse;
  }
}
