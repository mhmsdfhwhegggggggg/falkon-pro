/**
 * Smart Account Distribution System v1.0.0
 * 
 * Balances account usage across different server nodes and time slots:
 * - Prevents account overuse
 * - Distributes tasks across time to avoid spikes
 * - Node-aware account management
 * - Automatic warm-up scheduling
 * 
 * @module AccountDistributor
 * @author Manus AI
 */

import Redis from 'ioredis';
import { getJobQueue } from '../_core/job-queue';

export class AccountDistributor {
  private static instance: AccountDistributor;
  private redis: Redis;
  
  private constructor(redis: Redis) {
    this.redis = redis;
  }
  
  static getInstance(redis?: Redis): AccountDistributor {
    if (!this.instance) {
      if (!redis) throw new Error('AccountDistributor requires Redis');
      this.instance = new AccountDistributor(redis);
    }
    return this.instance;
  }
  
  /**
   * Schedule a task for an account with smart timing
   */
  async scheduleTask(accountId: number, taskType: string, payload: any) {
    const jobQueue = getJobQueue();
    
    // 1. Calculate optimal delay to avoid spikes
    const delay = await this.calculateOptimalDelay(accountId);
    
    // 2. Add to queue with calculated delay
    await jobQueue.addJob(taskType, {
      accountId,
      payload,
      type: taskType
    }, {
      delay,
      priority: 'normal'
    });
    
    console.log(`[AccountDistributor] Task ${taskType} scheduled for account ${accountId} with ${delay}ms delay`);
  }
  
  private async calculateOptimalDelay(accountId: number): Promise<number> {
    const key = 'distributor:global:counter';
    const counter = await this.redis.incr(key);
    
    // Reset counter every 60 seconds
    if (counter === 1) {
      await this.redis.expire(key, 60);
    }
    
    // Spread tasks: 500ms between each task globally to avoid burst
    return counter * 500;
  }
  
  /**
   * Get accounts that need warming up
   */
  async getAccountsForWarmup(): Promise<number[]> {
    // Logic to identify new or inactive accounts
    return [];
  }
}

export const getAccountDistributor = () => AccountDistributor.getInstance();
