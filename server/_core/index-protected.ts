/**
 * Protected Server Entry Point
 * 
 * This is the main entry point with all security systems enabled:
 * - License validation
 * - Hardware ID verification
 * - Integrity checking
 * - Anti-debugging
 * 
 * @author Manus AI
 * @version 2.0.0
 */

import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from '../routers';
import { createContext } from './context';
import { licenseSystem } from './license-system';
import { IntegrityChecker } from './integrity-checker';
import { AntiDebug } from './anti-debug';
import { HardwareID } from './hardware-id';

/**
 * Initialize all security systems
 */
async function initializeSecurity(): Promise<boolean> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔐 Dragon Telegram Pro - Security Initialization');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 1. Enable Anti-Debugging (first line of defense)
  if (process.env.NODE_ENV === 'production') {
    AntiDebug.enable();
    AntiDebug.preventProcessInspection();
    AntiDebug.preventMemoryDumps();
  }
  
  // 2. Check Hardware ID
  console.log('[Security] Generating hardware fingerprint...');
  const hardwareId = HardwareID.generate();
  console.log('[Security] Hardware ID:', hardwareId.substring(0, 16) + '...');
  
  // 3. Initialize Integrity Checker
  console.log('\n[Security] Initializing integrity checker...');
  const integrityValid = await IntegrityChecker.initialize();
  
  if (!integrityValid) {
    console.error('[Security] ⛔ Integrity check failed!');
    return false;
  }
  
  // Start continuous monitoring
  IntegrityChecker.startMonitoring();
  
  // 4. Initialize License System
  console.log('\n[Security] Initializing license system...');
  const licenseValid = await licenseSystem.initialize();
  
  if (!licenseValid) {
    console.error('[Security] ⛔ License validation failed!');
    console.error('[Security] Please activate a valid license to use this application.');
    console.error('[Security] Run: npm run license:activate <LICENSE_KEY>');
    return false;
  }
  
  // 5. Display license information
  const license = licenseSystem.getLicense();
  if (license) {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                 LICENSE INFORMATION                    ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║ Type:          ${license.type.toUpperCase().padEnd(40)} ║`);
    console.log(`║ Max Accounts:  ${license.maxAccounts.toString().padEnd(40)} ║`);
    console.log(`║ Max Ops/Day:   ${license.maxOperationsPerDay.toString().padEnd(40)} ║`);
    console.log(`║ Expires:       ${new Date(license.expiresAt).toLocaleDateString().padEnd(40)} ║`);
    console.log('╚════════════════════════════════════════════════════════╝\n');
  }
  
  console.log('✅ All security systems initialized successfully\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  return true;
}

/**
 * Main server initialization
 */
async function main() {
  try {
    // Initialize security systems
    const securityOk = await initializeSecurity();
    
    if (!securityOk) {
      console.error('⛔ Security initialization failed - exiting');
      process.exit(1);
    }
    
    // Create Express app
    const app = express();
    
    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Health check endpoint
    app.get('/health', async (req, res) => {
      const licenseValid = licenseSystem.isValid();
      const integrityReport = await IntegrityChecker.verify();
      const antiDebugStatus = AntiDebug.getStatus();
      
      const health = {
        status: licenseValid && integrityReport.valid ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        license: {
          valid: licenseValid,
          type: licenseSystem.getLicense()?.type,
          expiresAt: licenseSystem.getLicense()?.expiresAt,
        },
        integrity: {
          valid: integrityReport.valid,
          checkedFiles: integrityReport.checkedFiles,
        },
        antiDebug: {
          enabled: antiDebugStatus.enabled,
          debuggerDetected: antiDebugStatus.debuggerDetected,
        },
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      };
      
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    });
    
    // tRPC endpoint
    app.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext,
      })
    );
    
    // Error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('[Server] Error:', err);
      
      // Don't expose internal errors in production
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({
          error: 'Internal server error',
          message: 'An unexpected error occurred',
        });
      } else {
        res.status(500).json({
          error: err.message,
          stack: err.stack,
        });
      }
    });
    
    // Start server
    const PORT = parseInt(process.env.PORT || '3000');
    
    const server = app.listen(PORT, () => {
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║         Dragon Telegram Pro Server Started            ║');
      console.log('╠════════════════════════════════════════════════════════╣');
      console.log(`║ Port:          ${PORT.toString().padEnd(40)} ║`);
      console.log(`║ Environment:   ${(process.env.NODE_ENV || 'development').padEnd(40)} ║`);
      console.log(`║ PID:           ${process.pid.toString().padEnd(40)} ║`);
      console.log('╚════════════════════════════════════════════════════════╝\n');
    });
    
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}, starting graceful shutdown...`);
      
      // Stop accepting new connections
      server.close(() => {
        console.log('[Server] HTTP server closed');
      });
      
      // Stop security systems
      IntegrityChecker.stopMonitoring();
      AntiDebug.disable();
      
      // Deactivate license
      await licenseSystem.deactivate();
      
      console.log('[Server] Shutdown complete');
      process.exit(0);
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('[Server] Uncaught exception:', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
    
  } catch (error) {
    console.error('[Server] Fatal error during initialization:', error);
    process.exit(1);
  }
}

// Start the server
main();
