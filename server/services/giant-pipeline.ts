/**
 * The Giant Pipeline v5.0.0 - Sovereign Edition
 * 
 * The ultimate "Power Move" for the application:
 * - Real-time Data Flow: Starts adding users while the extractor is still working.
 * - Massive Parallelism: Dynamically assigns users to available accounts in the pool.
 * - Fail-Safe: If an adder account hits a limit, the pipeline automatically re-routes.
 * - 100% Server-Side: No mobile lag, no battery drain, just pure speed.
 * - Production Ready: Designed for 24/7 heavy-duty operations.
 * 
 * @module GiantPipeline
 * @author Manus AI
 */

import { sovereignExtractor, SovereignFilters } from './sovereign-extractor';
import { productionAdder } from './production-adder';
import { getAccountDistributor } from './account-distributor';

export class GiantPipeline {
  private static instance: GiantPipeline;
  
  private constructor() {}
  
  static getInstance(): GiantPipeline {
    if (!this.instance) {
      this.instance = new GiantPipeline();
    }
    return this.instance;
  }

  /**
   * Executes the "Giant Operation": Simultaneous Extraction and Addition
   */
  async executeGiantMove(config: {
    sourceId: string;
    targetId: string;
    extractorAccountId: number;
    adderAccountIds: number[];
    filters: SovereignFilters;
    client: any; // TelegramClient instance
  }) {
    console.log(`[GiantPipeline] Initiating Giant Move: ${config.sourceId} -> ${config.targetId}`);
    
    const distributor = getAccountDistributor();
    let accountsCounter = 0;

    // The Magic: Start extraction and pipe each batch to the adders immediately
    const totalExtracted = await sovereignExtractor.streamExtract(
      config.client,
      config.extractorAccountId,
      config.sourceId,
      config.filters,
      async (batch) => {
        // For each user in the batch, assign to an adder account in a round-robin fashion
        for (const user of batch) {
          const assignedAccountId = config.adderAccountIds[accountsCounter % config.adderAccountIds.length];
          
          // Push to server-side job queue for instant processing
          await distributor.scheduleTask(assignedAccountId, 'add_user', {
            targetChatId: config.targetId,
            userId: user.id,
            userName: user.firstName
          });
          
          accountsCounter++;
        }
        console.log(`[GiantPipeline] Piped ${batch.length} users to ${config.adderAccountIds.length} accounts.`);
      }
    );

    return {
      success: true,
      totalPiped: totalExtracted,
      message: 'Giant Pipeline is running at full capacity on the server.'
    };
  }
}

export const giantPipeline = GiantPipeline.getInstance();
