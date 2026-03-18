/**
 * Integrity Checker - Anti-Tampering System
 * 
 * Monitors application files for unauthorized modifications.
 * Calculates and verifies checksums of critical files.
 * Automatically shuts down on tampering detection.
 * 
 * @module IntegrityChecker
 * @author Manus AI
 * @version 2.0.0
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface FileChecksum {
  path: string;
  checksum: string;
  size: number;
  lastModified: number;
}

export interface IntegrityReport {
  valid: boolean;
  checkedFiles: number;
  tamperedFiles: string[];
  missingFiles: string[];
  timestamp: number;
}

export class IntegrityChecker {
  private static checksums: Map<string, string> = new Map();
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

  /**
   * Critical files to monitor
   * These checksums should be generated during build and embedded
   */
  private static readonly CRITICAL_FILES = [
    'server/_core/index.js',
    'server/_core/license-system.js',
    'server/_core/hardware-id.js',
    'server/_core/integrity-checker.js',
    'server/_core/anti-debug.js',
    'server/_core/crypto.js',
    'server/_core/db.js',
    'server/_core/env.js',
    'server/services/telegram-client.service.js',
    'server/services/anti-ban-core.js',
    'server/services/license-manager.js',
  ];

  /**
   * Initialize integrity checker
   * Should be called at application startup
   */
  static async initialize(): Promise<boolean> {
    console.log('[Integrity] Initializing integrity checker...');

    try {
      // Calculate checksums for all critical files
      await this.calculateChecksums();

      // Perform initial verification
      const report = await this.verify();

      if (!report.valid) {
        console.error('[Integrity] ⛔ Initial integrity check failed!');
        console.error('[Integrity] Tampered files:', report.tamperedFiles);
        console.error('[Integrity] Missing files:', report.missingFiles);
        return false;
      }

      console.log('[Integrity] ✅ Initial integrity check passed');
      console.log('[Integrity] Monitoring', report.checkedFiles, 'critical files');

      return true;

    } catch (error: any) {
      console.error('[Integrity] Initialization error:', error.message);
      return false;
    }
  }

  /**
   * Start continuous monitoring
   */
  static startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    console.log('[Integrity] Starting continuous monitoring...');

    this.monitoringInterval = setInterval(async () => {
      const report = await this.verify();

      if (!report.valid) {
        console.error('[Integrity] ⛔ TAMPERING DETECTED!');
        console.error('[Integrity] Tampered files:', report.tamperedFiles);
        console.error('[Integrity] Missing files:', report.missingFiles);

        // Shutdown application
        this.shutdown();
      }
    }, this.CHECK_INTERVAL_MS) as any;
  }

  /**
   * Stop monitoring
   */
  static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[Integrity] Monitoring stopped');
    }
  }

  /**
   * Calculate checksums for all critical files
   */
  private static async calculateChecksums(): Promise<void> {
    this.checksums.clear();

    for (const file of this.CRITICAL_FILES) {
      const filePath = this.resolveFilePath(file);

      if (fs.existsSync(filePath)) {
        const checksum = await this.calculateFileChecksum(filePath);
        this.checksums.set(file, checksum);
      } else {
        console.warn('[Integrity] File not found:', file);
      }
    }
  }

  /**
   * Verify integrity of all critical files
   */
  static async verify(): Promise<IntegrityReport> {
    const tamperedFiles: string[] = [];
    const missingFiles: string[] = [];
    let checkedFiles = 0;

    for (const [file, expectedChecksum] of this.checksums.entries()) {
      const filePath = this.resolveFilePath(file);

      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
        continue;
      }

      const actualChecksum = await this.calculateFileChecksum(filePath);

      if (actualChecksum !== expectedChecksum) {
        tamperedFiles.push(file);
      }

      checkedFiles++;
    }

    return {
      valid: tamperedFiles.length === 0 && missingFiles.length === 0,
      checkedFiles,
      tamperedFiles,
      missingFiles,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate SHA-256 checksum of a file
   */
  private static async calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Resolve file path (handles both source and dist)
   */
  private static resolveFilePath(file: string): string {
    // Try dist directory first (production)
    const distPath = path.join(process.cwd(), 'dist', file);
    if (fs.existsSync(distPath)) {
      return distPath;
    }

    // Try source directory (development)
    const srcPath = path.join(process.cwd(), file.replace('.js', '.ts'));
    if (fs.existsSync(srcPath)) {
      return srcPath;
    }

    // Fallback to direct path
    return path.join(process.cwd(), file);
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(filePath: string): Promise<FileChecksum> {
    const stats = fs.statSync(filePath);
    const checksum = await this.calculateFileChecksum(filePath);

    return {
      path: filePath,
      checksum,
      size: stats.size,
      lastModified: stats.mtimeMs,
    };
  }

  /**
   * Generate checksums manifest (for build process)
   */
  static async generateManifest(outputPath: string): Promise<void> {
    const manifest: Record<string, FileChecksum> = {};

    for (const file of this.CRITICAL_FILES) {
      const filePath = this.resolveFilePath(file);

      if (fs.existsSync(filePath)) {
        manifest[file] = await this.getFileMetadata(filePath);
      }
    }

    fs.writeFileSync(
      outputPath,
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    console.log('[Integrity] Manifest generated:', outputPath);
  }

  /**
   * Load checksums from manifest
   */
  static async loadManifest(manifestPath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(manifestPath)) {
        console.warn('[Integrity] Manifest not found:', manifestPath);
        return false;
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      this.checksums.clear();

      for (const [file, metadata] of Object.entries(manifest)) {
        const fileChecksum = metadata as FileChecksum;
        this.checksums.set(file, fileChecksum.checksum);
      }

      console.log('[Integrity] Loaded', this.checksums.size, 'checksums from manifest');
      return true;

    } catch (error: any) {
      console.error('[Integrity] Error loading manifest:', error.message);
      return false;
    }
  }

  /**
   * Verify a single file
   */
  static async verifyFile(file: string): Promise<boolean> {
    const expectedChecksum = this.checksums.get(file);
    if (!expectedChecksum) {
      return false;
    }

    const filePath = this.resolveFilePath(file);
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const actualChecksum = await this.calculateFileChecksum(filePath);
    return actualChecksum === expectedChecksum;
  }

  /**
   * Add file to monitoring
   */
  static async addFile(file: string): Promise<void> {
    const filePath = this.resolveFilePath(file);

    if (fs.existsSync(filePath)) {
      const checksum = await this.calculateFileChecksum(filePath);
      this.checksums.set(file, checksum);
      console.log('[Integrity] Added file to monitoring:', file);
    }
  }

  /**
   * Remove file from monitoring
   */
  static removeFile(file: string): void {
    this.checksums.delete(file);
    console.log('[Integrity] Removed file from monitoring:', file);
  }

  /**
   * Get monitoring status
   */
  static getStatus(): {
    monitoring: boolean;
    filesCount: number;
    files: string[];
  } {
    return {
      monitoring: this.monitoringInterval !== null,
      filesCount: this.checksums.size,
      files: Array.from(this.checksums.keys()),
    };
  }

  /**
   * Shutdown application on tampering
   */
  private static shutdown(): void {
    console.error('[Integrity] ⛔ Application integrity compromised - shutting down');

    // Stop monitoring
    this.stopMonitoring();

    // Send alert (implement based on your alerting system)
    this.sendAlert();

    // Give time for cleanup
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  }

  /**
   * Send alert on tampering
   */
  private static sendAlert(): void {
    // TODO: Implement alerting (email, webhook, etc.)
    console.error('[Integrity] ALERT: Tampering detected at', new Date().toISOString());
  }

  /**
   * Export checksums for embedding in code
   */
  static exportChecksums(): string {
    const checksumArray = Array.from(this.checksums.entries());
    return JSON.stringify(checksumArray, null, 2);
  }

  /**
   * Import checksums from embedded data
   */
  static importChecksums(data: string): void {
    try {
      const checksumArray = JSON.parse(data) as [string, string][];
      this.checksums = new Map(checksumArray);
      console.log('[Integrity] Imported', this.checksums.size, 'checksums');
    } catch (error: any) {
      console.error('[Integrity] Error importing checksums:', error.message);
    }
  }
}
