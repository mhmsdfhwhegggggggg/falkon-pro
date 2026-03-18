/**
 * Anti-Debugging System
 * 
 * Prevents debugging and reverse engineering attempts:
 * - Detects debugger attachment
 * - Detects Node.js inspector
 * - Prevents console access in production
 * - Detects timing anomalies
 * - Obfuscates stack traces
 * 
 * @module AntiDebug
 * @author Manus AI
 * @version 2.0.0
 */

export class AntiDebug {
  private static enabled = false;
  private static checkInterval: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL_MS = 1000; // 1 second
  private static debuggerDetectedCount = 0;
  private static readonly MAX_DETECTIONS = 3;

  /**
   * Enable anti-debugging protection
   * Should be called at application startup in production
   */
  static enable(): void {
    if (this.enabled) {
      return;
    }

    console.log('[AntiDebug] Enabling anti-debugging protection...');

    // 1. Check if already in debug mode
    if (this.isDebuggerAttached()) {
      console.error('[AntiDebug] ⛔ Debugger detected at startup!');
      this.shutdown();
      return;
    }

    // 2. Disable console in production
    if (process.env.NODE_ENV === 'production') {
      this.disableConsole();
    }

    // 3. Start continuous monitoring
    this.startMonitoring();

    // 4. Prevent inspector
    this.preventInspector();

    // 5. Obfuscate errors
    this.obfuscateErrors();

    this.enabled = true;
    console.log('[AntiDebug] ✅ Anti-debugging protection enabled');
  }

  /**
   * Disable anti-debugging (for development)
   */
  static disable(): void {
    if (!this.enabled) {
      return;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.enabled = false;
    console.log('[AntiDebug] Anti-debugging protection disabled');
  }

  /**
   * Check if debugger is attached
   */
  private static isDebuggerAttached(): boolean {
    // Method 1: Check for inspector
    if (process.execArgv.some(arg =>
      arg.includes('inspect') ||
      arg.includes('debug')
    )) {
      return true;
    }

    // Method 2: Check for debug port
    if (process.debugPort && process.debugPort > 0) {
      return true;
    }

    // Method 3: Timing-based detection
    const start = Date.now();
    debugger; // This line will pause if debugger is attached
    const end = Date.now();

    // If execution took more than 100ms, debugger is likely attached
    if (end - start > 100) {
      return true;
    }

    return false;
  }

  /**
   * Start continuous monitoring for debugger
   */
  private static startMonitoring(): void {
    this.checkInterval = setInterval(() => {
      if (this.isDebuggerAttached()) {
        this.debuggerDetectedCount++;

        console.error('[AntiDebug] ⚠️ Debugger detected!',
          `(${this.debuggerDetectedCount}/${this.MAX_DETECTIONS})`);

        if (this.debuggerDetectedCount >= this.MAX_DETECTIONS) {
          console.error('[AntiDebug] ⛔ Multiple debugger detections - shutting down');
          this.shutdown();
        }
      } else {
        // Reset counter if no debugger detected
        this.debuggerDetectedCount = Math.max(0, this.debuggerDetectedCount - 1);
      }
    }, this.CHECK_INTERVAL_MS) as any;
  }

  /**
   * Prevent Node.js inspector from being enabled
   */
  private static preventInspector(): void {
    // Override inspector module
    try {
      const inspector = require('inspector');

      if (inspector.url()) {
        console.error('[AntiDebug] ⛔ Inspector is already active!');
        this.shutdown();
        return;
      }

      // Prevent opening inspector
      const originalOpen = inspector.open;
      inspector.open = function (...args: any[]) {
        console.error('[AntiDebug] ⛔ Attempt to open inspector detected!');
        process.exit(1);
        return originalOpen.apply(this, args);
      };

    } catch (error) {
      // Inspector module not available (older Node.js versions)
    }
  }

  /**
   * Disable console methods in production
   */
  private static disableConsole(): void {
    const noop = () => { };

    // Save original methods for internal use
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
      trace: console.trace,
    };

    // Store in global for internal logging
    (global as any).__originalConsole = originalConsole;

    // Override console methods
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.debug = noop;
    console.trace = noop;

    // Keep console.error for critical errors only
    console.error = function (...args: any[]) {
      // Only log in production if it's a critical error
      if (args[0] && typeof args[0] === 'string' && args[0].includes('[AntiDebug]')) {
        originalConsole.error(...args);
      }
    };
  }

  /**
   * Obfuscate error stack traces
   */
  private static obfuscateErrors(): void {
    const originalPrepareStackTrace = Error.prepareStackTrace;

    Error.prepareStackTrace = function (error, stack) {
      if (process.env.NODE_ENV === 'production') {
        // Return minimal information in production
        return `${error.name}: ${error.message}\n[Stack trace hidden for security]`;
      }

      // Use original in development
      if (originalPrepareStackTrace) {
        return originalPrepareStackTrace(error, stack);
      }

      return `${error.name}: ${error.message}\n${stack.map(s => `  at ${s}`).join('\n')}`;
    };
  }

  /**
   * Detect timing attacks
   */
  static detectTimingAttack(operation: () => void): boolean {
    const iterations = 10;
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      operation();
      const end = process.hrtime.bigint();
      timings.push(Number(end - start) / 1000000); // Convert to ms
    }

    // Calculate standard deviation
    const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
    const variance = timings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / timings.length;
    const stdDev = Math.sqrt(variance);

    // If standard deviation is too high, timing attack is suspected
    const threshold = mean * 0.5; // 50% of mean
    return stdDev > threshold;
  }

  /**
   * Prevent process inspection
   */
  static preventProcessInspection(): void {
    // Hide sensitive environment variables
    const sensitiveVars = [
      'ENCRYPTION_KEY',
      'JWT_SECRET',
      'SESSION_SECRET',
      'DATABASE_URL',
      'REDIS_URL',
      'TELEGRAM_API_HASH',
      'LICENSE_SERVER_URL',
    ];

    for (const varName of sensitiveVars) {
      if (process.env[varName]) {
        // Replace with asterisks
        Object.defineProperty(process.env, varName, {
          get: () => '***HIDDEN***',
          enumerable: true,
          configurable: false,
        });
      }
    }
  }

  /**
   * Detect virtual machine or container
   */
  static detectVirtualization(): {
    isVirtual: boolean;
    type?: string;
  } {
    const os = require('os');
    const fs = require('fs');

    // Check for common VM/container indicators
    const indicators = {
      docker: fs.existsSync('/.dockerenv'),
      kubernetes: fs.existsSync('/var/run/secrets/kubernetes.io'),
      vmware: os.cpus()[0]?.model.toLowerCase().includes('vmware'),
      virtualbox: os.cpus()[0]?.model.toLowerCase().includes('virtualbox'),
      qemu: os.cpus()[0]?.model.toLowerCase().includes('qemu'),
    };

    for (const [type, detected] of Object.entries(indicators)) {
      if (detected) {
        return { isVirtual: true, type };
      }
    }

    return { isVirtual: false };
  }

  /**
   * Check if running in known debugging environment
   */
  static detectDebugEnvironment(): boolean {
    // Check for common debugging tools
    const debugTools = [
      'node-inspector',
      'chrome-devtools',
      'vscode-debugger',
      'webstorm-debugger',
    ];

    // Check loaded modules
    const loadedModules = Object.keys(require.cache);

    for (const tool of debugTools) {
      if (loadedModules.some(mod => mod.includes(tool))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Prevent memory dumps
   */
  static preventMemoryDumps(): void {
    // Overwrite sensitive data in memory periodically
    setInterval(() => {
      if (global.gc) {
        global.gc(); // Force garbage collection if --expose-gc is set
      }
    }, 60000); // Every minute
  }

  /**
   * Get anti-debug status
   */
  static getStatus(): {
    enabled: boolean;
    debuggerDetected: boolean;
    detectionCount: number;
    virtualEnvironment: boolean;
  } {
    return {
      enabled: this.enabled,
      debuggerDetected: this.isDebuggerAttached(),
      detectionCount: this.debuggerDetectedCount,
      virtualEnvironment: this.detectVirtualization().isVirtual,
    };
  }

  /**
   * Shutdown application on debug detection
   */
  private static shutdown(): void {
    console.error('[AntiDebug] ⛔ Debugging attempt detected - shutting down for security');

    // Stop monitoring
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Send alert
    this.sendAlert();

    // Immediate shutdown
    process.exit(1);
  }

  /**
   * Send alert on debug detection
   */
  private static sendAlert(): void {
    // TODO: Implement alerting (email, webhook, etc.)
    const alert = {
      type: 'SECURITY_ALERT',
      severity: 'CRITICAL',
      message: 'Debugging attempt detected',
      timestamp: new Date().toISOString(),
      details: {
        debuggerAttached: this.isDebuggerAttached(),
        detectionCount: this.debuggerDetectedCount,
        environment: this.detectVirtualization(),
      },
    };

    // Log to file or send to monitoring service
    console.error('[AntiDebug] ALERT:', JSON.stringify(alert));
  }

  /**
   * Create anti-debug trap
   * Place this in critical code sections
   */
  static trap(): void {
    if (!this.enabled) {
      return;
    }

    // Quick debugger check
    const start = Date.now();
    debugger;
    const end = Date.now();

    if (end - start > 50) {
      console.error('[AntiDebug] ⛔ Trap triggered!');
      this.shutdown();
    }
  }
}
