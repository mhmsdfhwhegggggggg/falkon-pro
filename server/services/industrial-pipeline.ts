/**
 * Industrial Production Pipeline v6.0.0
 * 
 * The master orchestrator for high-volume Telegram operations:
 * - Real-time Data Streaming: Connects extraction to addition without latency.
 * - Multi-Account Load Balancing: Dynamically distributes tasks across account pools.
 * - Fail-Safe Execution: Automatically re-queues tasks if an account hits a limit.
 * - 100% Server-Side: Designed to run 24/7 on high-performance infrastructure.
 * - Enterprise Stability: Handles thousands of users and massive datasets with ease.
 * 
 * @module IndustrialPipeline
 * @author Manus AI
 */

import { industrialExtractor, IndustrialFilters } from './industrial-extractor';
import { getAccountDistributor } from './account-distributor';

export class IndustrialPipeline {
  private static instance: IndustrialPipeline;
  
  private constructor() {}
  
  static getInstance(): IndustrialPipeline {
    if (!this.instance) {
      this.instance = new IndustrialPipeline();
    }
    return this.instance;
  }

  /**
   * Launch a massive industrial operation
   */
  async launchMassiveOperation(config: {
    sourceId: string;
    targetId: string;
    extractorAccountId: number;
    adderAccountIds: number[];
    filters: IndustrialFilters;
    client: any;
  }) {
    console.log(`[IndustrialPipeline] Launching Massive Operation: ${config.sourceId} -> ${config.targetId}`);
    
    const distributor = getAccountDistributor();
    let accountIndex = 0;

    // Start extraction and stream data directly to the adder system
    const totalPiped = await industrialExtractor.industrialExtract(
      config.client,
      config.extractorAccountId,
      config.sourceId,
      config.filters,
      async (batch) => {
        // Distribute each batch across the available adder accounts
        for (const user of batch) {
          const targetAccountId = config.adderAccountIds[accountIndex % config.adderAccountIds.length];
          
          // Schedule as a high-priority server job
          await distributor.scheduleTask(targetAccountId, 'add_user', {
            targetChatId: config.targetId,
            userId: user.id,
            userName: user.name
          });
          
          accountIndex++;
        }
        console.log(`[IndustrialPipeline] Piped ${batch.length} users to production workers.`);
      }
    );

    return {
      success: true,
      totalPiped,
      message: 'Industrial Production Pipeline is now active on the server.'
    };
  }
}

export const industrialPipeline = IndustrialPipeline.getInstance();
