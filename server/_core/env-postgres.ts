/**
 * PostgreSQL Environment Configuration
 * Production-ready environment variables for PostgreSQL
 */

function getEnvVar(key: string, defaultValue: string = ""): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

export const ENV_POSTGRES = {
  // Application
  nodeEnv: getEnvVar("NODE_ENV", "development"),
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
  appName: getEnvVar("APP_NAME", "Dragon Telegram Pro"),
  appVersion: getEnvVar("APP_VERSION", "1.0.0"),
  port: getEnvNumber("PORT", 3000),
  expoPort: getEnvNumber("EXPO_PORT", 8081),

  // Database - PostgreSQL
  databaseUrl: getEnvVar("DATABASE_URL", "postgresql://dragaan_user:dragaan_secure_password_2024@localhost:5432/dragaan_pro"),

  // Redis
  redisUrl: getEnvVar("REDIS_URL", "redis://127.0.1:6379"),
  redisPassword: getEnvVar("REDIS_PASSWORD"),
  redisDb: getEnvNumber("REDIS_DB", 0),

  // Telegram API
  telegramApiId: getEnvNumber("TELEGRAM_API_ID", 0),
  telegramApiHash: getEnvVar("TELEGRAM_API_HASH"),

  // Authentication & Security
  jwtSecret: getEnvVar("JWT_SECRET"),
  sessionSecret: getEnvVar("SESSION_SECRET"),
  encryptionKey: getEnvVar("ENCRYPTION_KEY"),
  cookieSecret: getEnvVar("JWT_SECRET", ""), // Backward compatibility

  // OAuth
  oAuthServerUrl: getEnvVar("OAUTH_SERVER_URL"),
  appId: getEnvVar("APP_ID"),
  oAuthClientId: getEnvVar("OAUTH_CLIENT_ID"),
  oAuthClientSecret: getEnvVar("OAUTH_CLIENT_SECRET"),

  // CORS
  corsOrigins: getEnvVar("CORS_ORIGINS", "http://localhost:3000,http://localhost:8081"),
  corsCredentials: getEnvBoolean("CORS_CREDENTIALS", true),

  // Rate Limiting
  rateLimitWindowMs: getEnvNumber("RATE_LIMIT_WINDOW_MS", 900000),
  rateLimitMaxRequests: getEnvNumber("RATE_LIMIT_MAX_REQUESTS", 100),

  // Anti-Ban System
  antiBanEnabled: getEnvBoolean("ANTI_BAN_ENABLED", true),
  antiBanStrictMode: getEnvBoolean("ANTI_BAN_STRICT_MODE", true),
  antiBanMaxOperationsPerHour: getEnvNumber("ANTI_BAN_MAX_OPERATIONS_PER_HOUR", 100),
  antiBanCooldownMinutes: getEnvNumber("ANTI_BAN_COOLDOWN_MINUTES", 5),

  // Monitoring
  enableMetrics: getEnvBoolean("ENABLE_METRICS", true),
  enableHealthChecks: getEnvBoolean("ENABLE_HEALTH_CHECKS", true),
  enableLogging: getEnvBoolean("ENABLE_LOGGING", true),
  logLevel: getEnvVar("LOG_LEVEL", "info"),

  // License System
  enableLicenseCheck: getEnvBoolean("ENABLE_LICENSE_CHECK", true),
  licenseServerUrl: getEnvVar("LICENSE_SERVER_URL"),
  licenseKey: getEnvVar("LICENSE_KEY"),

  // Proxy Settings
  proxyRotationEnabled: getEnvBoolean("PROXY_ROTATION_ENABLED", true),
  proxyCheckIntervalMs: getEnvNumber("PROXY_CHECK_INTERVAL_MS", 300000),
  proxyMaxFailures: getEnvNumber("PROXY_MAX_FAILURES", 3),

  // File Storage
  storageType: getEnvVar("STORAGE_TYPE", "local"),
  storagePath: getEnvVar("STORAGE_PATH", "./uploads"),
  maxFileSize: getEnvNumber("MAX_FILE_SIZE", 10485760), // 10MB

  // Email
  smtpHost: getEnvVar("SMTP_HOST"),
  smtpPort: getEnvNumber("SMTP_PORT", 587),
  smtpUser: getEnvVar("SMTP_USER"),
  smtpPass: getEnvVar("SMTP_PASS"),
  smtpFrom: getEnvVar("SMTP_FROM"),
  smtpFromName: getEnvVar("SMTP_FROM_NAME", "Dragon Telegram Pro"),

  // API Keys
  openAiApiKey: getEnvVar("OPENAI_API_KEY"),
  googleMapsApiKey: getEnvVar("GOOGLE_MAPS_API_KEY"),

  // Feature Flags
  enableBulkOperations: getEnvBoolean("ENABLE_BULK_OPERATIONS", true),
  enableAdvancedExtraction: getEnvBoolean("ENABLE_ADVANCED_EXTRACTION", true),
  enableRealTimeUpdates: getEnvBoolean("ENABLE_REAL_TIME_UPDATES", true),
  enableAnalytics: getEnvBoolean("ENABLE_ANALYTICS", true),
  enableNotifications: getEnvBoolean("ENABLE_NOTIFICATIONS", true),

  // Security Headers
  helmetEnabled: getEnvBoolean("HELMET_ENABLED", true),
  enableCsrfProtection: getEnvBoolean("ENABLE_CSRF_PROTECTION", true),
  enableRateLimiting: getEnvBoolean("ENABLE_RATE_LIMITING", true),

  // Performance
  connectionPoolMax: getEnvNumber("DB_POOL_MAX", 20),
  connectionPoolMin: getEnvNumber("DB_POOL_MIN", 5),
  connectionPoolIdleTimeout: getEnvNumber("DB_POOL_IDLE_TIMEOUT", 30000),
  queryTimeout: getEnvNumber("DB_QUERY_TIMEOUT", 30000),
};

export default ENV_POSTGRES;
