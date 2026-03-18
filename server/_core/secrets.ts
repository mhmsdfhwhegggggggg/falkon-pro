import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

type SecretsShape = {
  SESSION_ENC_KEY?: string; // base64 preferred (32 bytes)
  TELEGRAM_API_ID?: number;
  TELEGRAM_API_HASH?: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
};

const secretsDir = path.join(process.cwd(), "server");
const secretsPath = path.join(secretsDir, ".secrets.json");

function ensureFile(): void {
  if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });
  if (!fs.existsSync(secretsPath)) fs.writeFileSync(secretsPath, JSON.stringify({}, null, 2));
}

function readSecrets(): SecretsShape {
  try {
    ensureFile();
    const raw = fs.readFileSync(secretsPath, "utf8");
    return JSON.parse(raw || "{}") as SecretsShape;
  } catch {
    return {};
  }
}

function writeSecrets(next: SecretsShape) {
  ensureFile();
  fs.writeFileSync(secretsPath, JSON.stringify(next, null, 2));
}

export const Secrets = {
  getAll(): SecretsShape {
    return readSecrets();
  },

  getSessionEncKey(): string {
    const current = readSecrets();
    if (current.SESSION_ENC_KEY && current.SESSION_ENC_KEY.length > 0) return current.SESSION_ENC_KEY;
    // Auto-generate 32-byte key (base64)
    const key = crypto.randomBytes(32).toString("base64");
    const next = { ...current, SESSION_ENC_KEY: key };
    writeSecrets(next);
    return key;
  },

  getTelegramCredentials(): { apiId: number; apiHash: string } | null {
    const s = readSecrets();
    if (s.TELEGRAM_API_ID && s.TELEGRAM_API_HASH) {
      return { apiId: s.TELEGRAM_API_ID, apiHash: s.TELEGRAM_API_HASH };
    }
    // Fallback to env if present
    const envId = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
    const envHash = process.env.TELEGRAM_API_HASH || "";
    if (envId && envHash) return { apiId: envId, apiHash: envHash };
    return null;
  },

  setTelegramCredentials(apiId: number, apiHash: string) {
    const s = readSecrets();
    const next = { ...s, TELEGRAM_API_ID: apiId, TELEGRAM_API_HASH: apiHash };
    writeSecrets(next);
  },

  getDatabaseUrl(): string | null {
    const s = readSecrets();
    let url = s.DATABASE_URL || process.env.DATABASE_URL || null;
    if (url && (url.startsWith("psql '") || url.startsWith("psql \""))) {
      // Clean psql 'postgresql://...' format
      const match = url.match(/['"](postgresql:\/\/.*?)['"]/);
      if (match && match[1]) {
        url = match[1];
      }
    } else if (url && url.startsWith("psql ")) {
      // Clean psql postgresql://... format
      url = url.replace("psql ", "").trim();
    } else if (url && (url.startsWith("'") || url.startsWith("\""))) {
      // Clean 'postgresql://...' format (just quotes)
      url = url.replace(/['"]/g, "").trim();
    }

    // Aggressive cleanup for Neon/Pooler params that might cause auth issues
    if (url) {
      url = url.replace(/[&?]channel_binding=require/g, "");
      // Ensure sslmode=require is present if it's a neon URL but don't double up
      if (url.includes("neon.tech") && !url.includes("sslmode=")) {
        url += (url.includes("?") ? "&" : "?") + "sslmode=require";
      }
    }

    return url;
  },

  setDatabaseUrl(url: string) {
    const s = readSecrets();
    const next = { ...s, DATABASE_URL: url };
    writeSecrets(next);
  },

  getRedisUrl(): string | null {
    const s = readSecrets();
    return s.REDIS_URL || process.env.REDIS_URL || null;
  },

  setRedisUrl(url: string) {
    const s = readSecrets();
    const next = { ...s, REDIS_URL: url };
    writeSecrets(next);
  },
};
