/**
 * Advanced Database Connection Pool
 * 
 * High-performance connection pooling for PostgreSQL with:
 * - Connection reuse and management
 * - Health monitoring
 * - Automatic reconnection
 * - Query timeout handling
 * - Performance metrics
 * 
 * @module DatabasePool
 * @author Manus AI
 * @version 2.0.0
 */

import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { EventEmitter } from 'events';

export interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingRequests: number;
  totalQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  slowQueries: number;
}

export interface QueryOptions {
  timeout?: number;
  retries?: number;
  name?: string;
}

export class DatabasePool extends EventEmitter {
  private static instance: DatabasePool;
  private pool: Pool;
  private metrics: PoolMetrics;
  private queryTimes: number[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly MAX_QUERY_TIMES = 1000; // Keep last 1000 query times

  private constructor(config: PoolConfig) {
    super();

    this.pool = new Pool({
      ...config,

      // Performance settings
      max: config.max || 100,                    // Maximum connections
      min: config.min || 10,                     // Minimum connections
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,    // Close idle after 30s
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000, // Connection timeout

      // Statement timeout (10s default)
      statement_timeout: config.statement_timeout || 10000,

      // Keep-alive
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,

      // Application name for monitoring
      application_name: 'dragon-telegram-pro',
    });

    // Initialize metrics
    this.metrics = {
      totalConnections: 0,
      idleConnections: 0,
      activeConnections: 0,
      waitingRequests: 0,
      totalQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      slowQueries: 0,
    };

    this.setupEventListeners();
    this.startMetricsCollection();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: PoolConfig): DatabasePool {
    if (!this.instance) {
      if (!config) {
        throw new Error('DatabasePool not initialized. Provide config on first call.');
      }
      this.instance = new DatabasePool(config);
    }
    return this.instance;
  }

  /**
   * Initialize pool with config
   */
  static initialize(config: PoolConfig): DatabasePool {
    return this.getInstance(config);
  }

  /**
   * Setup event listeners for monitoring
   */
  private setupEventListeners(): void {
    // Connection events
    this.pool.on('connect', (client: PoolClient) => {
      console.log('[DB Pool] New client connected');
      this.emit('connect', client);
    });

    this.pool.on('acquire', (client: PoolClient) => {
      this.emit('acquire', client);
    });

    this.pool.on('remove', (client: PoolClient) => {
      console.log('[DB Pool] Client removed');
      this.emit('remove', client);
    });

    // Error events
    this.pool.on('error', (err: Error, client: PoolClient) => {
      console.error('[DB Pool] Unexpected error on idle client:', err);
      this.emit('error', err, client);
    });
  }

  /**
   * Start collecting metrics periodically
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics();
    }, 10000); // Every 10 seconds
  }

  /**
   * Update metrics from pool
   */
  private updateMetrics(): void {
    this.metrics.totalConnections = this.pool.totalCount;
    this.metrics.idleConnections = this.pool.idleCount;
    this.metrics.activeConnections = this.pool.totalCount - this.pool.idleCount;
    this.metrics.waitingRequests = this.pool.waitingCount;

    // Calculate average query time
    if (this.queryTimes.length > 0) {
      const sum = this.queryTimes.reduce((a, b) => a + b, 0);
      this.metrics.averageQueryTime = sum / this.queryTimes.length;
    }

    // Emit metrics event
    this.emit('metrics', this.metrics);
  }

  /**
   * Execute a query with automatic retry and timeout
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    values?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const {
      timeout = 10000,
      retries = 2,
      name = 'unnamed',
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now();

        // Execute query with timeout
        const result = await Promise.race([
          this.pool.query<T>(text, values),
          this.createTimeout(timeout),
        ]);

        const queryTime = Date.now() - startTime;

        // Record metrics
        this.metrics.totalQueries++;
        this.queryTimes.push(queryTime);

        // Keep only recent query times
        if (this.queryTimes.length > this.MAX_QUERY_TIMES) {
          this.queryTimes.shift();
        }

        // Check for slow query
        if (queryTime > this.SLOW_QUERY_THRESHOLD) {
          this.metrics.slowQueries++;
          console.warn(`[DB Pool] Slow query detected (${queryTime}ms): ${name}`);
          this.emit('slowQuery', { name, text, queryTime });
        }

        return result as QueryResult<T>;

      } catch (error: any) {
        lastError = error;
        this.metrics.failedQueries++;

        if (attempt < retries) {
          console.warn(`[DB Pool] Query failed (attempt ${attempt + 1}/${retries + 1}):`, error.message);
          // Wait before retry (exponential backoff)
          await this.sleep(Math.pow(2, attempt) * 100);
        }
      }
    }

    // All retries failed
    console.error('[DB Pool] Query failed after all retries:', lastError);
    throw lastError;
  }

  /**
   * Get a client from the pool for transaction
   */
  async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error: any) {
      console.error('[DB Pool] Failed to get client:', error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check pool health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health', [], { timeout: 5000 });
      return result.rows[0].health === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    idle: number;
    active: number;
    waiting: number;
  } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      active: this.pool.totalCount - this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    console.log('[DB Pool] Closing all connections...');
    await this.pool.end();
    console.log('[DB Pool] All connections closed');
  }

  /**
   * Helper: Create timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Helper: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Initialize database pool from environment
 */
export function initializeDatabasePool(): DatabasePool {
  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX || '100'),
    min: parseInt(process.env.DB_POOL_MIN || '10'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '10000'),
  };

  const pool = DatabasePool.initialize(config);

  console.log('[DB Pool] Initialized with config:', {
    max: config.max,
    min: config.min,
    idleTimeout: config.idleTimeoutMillis,
    connectionTimeout: config.connectionTimeoutMillis,
    statementTimeout: config.statement_timeout,
  });

  return pool;
}

// Export singleton getter
export const getPool = () => DatabasePool.getInstance();
