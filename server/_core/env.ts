/**
 * Environment Configuration
 * Centralized environment variables with validation and defaults
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

export const ENV = {
  // Application
  nodeEnv: getEnvVar("NODE_ENV", "development"),
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
  appName: getEnvVar("APP_NAME", "Dragon Telegram Pro"),
  appVersion: getEnvVar("APP_VERSION", "1.0.0"),
  port: getEnvNumber("PORT", 3000),
  expoPort: getEnvNumber("EXPO_PORT", 8081),

  // Database
  databaseUrl: getEnvVar("DATABASE_URL", "file:./dev.db"),

  // Redis
  redisUrl: getEnvVar("REDIS_URL", "redis://127.0.0.1:6379"),
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
  oAuthServerUrl: getEnvVar("OAUTH_SERVER_URL", "https://oauth.dragaan-pro.com"),
  appId: getEnvVar("APP_ID", "dragon_telegram_pro_mobile"),
  ownerOpenId: getEnvVar("OWNER_OPEN_ID", ""),

  // CORS
  corsOrigins: getEnvVar("CORS_ORIGINS", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // API Keys
  forgeApiUrl: getEnvVar("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: getEnvVar("BUILT_IN_FORGE_API_KEY"),

  // Monitoring & Logging
  sentryDsn: getEnvVar("SENTRY_DSN"),
  logLevel: getEnvVar("LOG_LEVEL", "info"),
  enableLogging: getEnvBoolean("ENABLE_LOGGING", true),

  // Rate Limiting
  rateLimitWindowMs: getEnvNumber("RATE_LIMIT_WINDOW_MS", 60000),
  rateLimitMaxRequests: getEnvNumber("RATE_LIMIT_MAX_REQUESTS", 100),

  // Anti-Ban Configuration
  antiBanEnabled: getEnvBoolean("ANTI_BAN_ENABLED", true),
  defaultMessageDelayMs: getEnvNumber("DEFAULT_MESSAGE_DELAY_MS", 2000),
  defaultActionDelayMs: getEnvNumber("DEFAULT_ACTION_DELAY_MS", 3000),
  maxMessagesPerDay: getEnvNumber("MAX_MESSAGES_PER_DAY", 100),
  maxGroupsJoinPerDay: getEnvNumber("MAX_GROUPS_JOIN_PER_DAY", 10),

  // Proxy Configuration
  enableProxy: getEnvBoolean("ENABLE_PROXY", false),
  defaultProxyHost: getEnvVar("DEFAULT_PROXY_HOST"),
  defaultProxyPort: getEnvNumber("DEFAULT_PROXY_PORT", 0),
  defaultProxyUsername: getEnvVar("DEFAULT_PROXY_USERNAME"),
  defaultProxyPassword: getEnvVar("DEFAULT_PROXY_PASSWORD"),

  // Email Configuration
  smtpHost: getEnvVar("SMTP_HOST"),
  smtpPort: getEnvNumber("SMTP_PORT", 587),
  smtpUser: getEnvVar("SMTP_USER"),
  smtpPassword: getEnvVar("SMTP_PASSWORD"),
  smtpFrom: getEnvVar("SMTP_FROM", "noreply@example.com"),

  // Payment Gateway
  stripeSecretKey: getEnvVar("STRIPE_SECRET_KEY"),
  stripePublishableKey: getEnvVar("STRIPE_PUBLISHABLE_KEY"),
  stripeWebhookSecret: getEnvVar("STRIPE_WEBHOOK_SECRET"),

  // File Storage
  s3Bucket: getEnvVar("S3_BUCKET"),
  s3Region: getEnvVar("S3_REGION"),
  s3AccessKey: getEnvVar("S3_ACCESS_KEY"),
  s3SecretKey: getEnvVar("S3_SECRET_KEY"),

  // Feature Flags
  enableRegistration: getEnvBoolean("ENABLE_REGISTRATION", true),
  enableLicenseCheck: getEnvBoolean("ENABLE_LICENSE_CHECK", false),
  enableAnalytics: getEnvBoolean("ENABLE_ANALYTICS", true),
  enableNotifications: getEnvBoolean("ENABLE_NOTIFICATIONS", true),

  // Development
  debug: getEnvBoolean("DEBUG", false),
  enableSwagger: getEnvBoolean("ENABLE_SWAGGER", false),
  enablePlayground: getEnvBoolean("ENABLE_PLAYGROUND", false),
};

/**
 * Validate required environment variables
 */
export function validateEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Critical variables
  if (!ENV.databaseUrl) {
    errors.push("DATABASE_URL is required");
  }

  if (!ENV.jwtSecret || ENV.jwtSecret.length < 32) {
    errors.push("JWT_SECRET is required and must be at least 32 characters");
  }

  if (!ENV.encryptionKey || ENV.encryptionKey.length !== 32) {
    errors.push("ENCRYPTION_KEY is required and must be exactly 32 characters");
  }

  if (ENV.isProduction) {
    // Production-specific validations
    if (!ENV.telegramApiId || ENV.telegramApiId === 0) {
      errors.push("TELEGRAM_API_ID is required in production");
    }

    if (!ENV.telegramApiHash) {
      errors.push("TELEGRAM_API_HASH is required in production");
    }

    if (!ENV.redisUrl) {
      errors.push("REDIS_URL is required in production");
    }

    if (ENV.jwtSecret.includes("dev_") || ENV.jwtSecret.includes("change")) {
      errors.push("JWT_SECRET must be changed from default value in production");
    }

    if (ENV.encryptionKey === "12345678901234567890123456789012") {
      errors.push("ENCRYPTION_KEY must be changed from default value in production");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Print environment configuration (safe for logging)
 */
export function printEnvConfig(): void {
  console.log("\n=== Environment Configuration ===");
  console.log(`Environment: ${ENV.nodeEnv}`);
  console.log(`App Name: ${ENV.appName}`);
  console.log(`App Version: ${ENV.appVersion}`);
  console.log(`Port: ${ENV.port}`);
  console.log(`Database: ${ENV.databaseUrl ? "✓ Configured" : "✗ Missing"}`);
  console.log(`Redis: ${ENV.redisUrl ? "✓ Configured" : "✗ Missing"}`);
  console.log(`Telegram API: ${ENV.telegramApiId && ENV.telegramApiHash ? "✓ Configured" : "✗ Missing"}`);
  console.log(`JWT Secret: ${ENV.jwtSecret ? "✓ Configured" : "✗ Missing"}`);
  console.log(`Encryption: ${ENV.encryptionKey ? "✓ Configured" : "✗ Missing"}`);
  console.log(`Anti-Ban: ${ENV.antiBanEnabled ? "✓ Enabled" : "✗ Disabled"}`);
  console.log(`License Check: ${ENV.enableLicenseCheck ? "✓ Enabled" : "✗ Disabled"}`);
  console.log("================================\n");
}
