import crypto from "node:crypto";
import { Secrets } from "./secrets";

// AES-256-GCM encryption utility
// Requires SESSION_ENC_KEY (32 bytes in base64 or hex) from environment
const getKey = (): Buffer => {
  // Prefer persisted secret (auto-generated on first use)
  const raw = Secrets.getSessionEncKey() || process.env.SESSION_ENC_KEY || "";
  if (!raw) throw new Error("SESSION_ENC_KEY is not set");

  // Accept base64 or hex; fallback to utf8 (not recommended) if length >= 32
  let key: Buffer | null = null;
  try {
    if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length >= 44) {
      // likely base64 for 32 bytes -> length >= 44 incl padding
      key = Buffer.from(raw, "base64");
    } else if (/^[0-9a-fA-F]+$/.test(raw) && raw.length >= 64) {
      // likely hex for 32 bytes -> length >= 64
      key = Buffer.from(raw, "hex");
    }
  } catch {}
  if (!key) {
    const buf = Buffer.from(raw, "utf8");
    if (buf.length < 32) {
      // pad deterministically to 32 bytes (not ideal, but prevents crash)
      const padded = Buffer.alloc(32);
      buf.copy(padded);
      key = padded;
    } else {
      key = buf.subarray(0, 32);
    }
  }
  if (key.length !== 32) {
    // normalize length to 32
    if (key.length > 32) key = key.subarray(0, 32);
    else {
      const padded = Buffer.alloc(32);
      key.copy(padded);
      key = padded;
    }
  }
  return key;
};

export function encryptString(plain: string): string {
  if (!plain) return plain;
  const key = getKey();
  const iv = crypto.randomBytes(12); // GCM recommended IV size
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: v1:gcm:<iv_b64>:<ct_b64>:<tag_b64>
  return [
    "v1",
    "gcm",
    iv.toString("base64"),
    ciphertext.toString("base64"),
    tag.toString("base64"),
  ].join(":");
}

export function decryptString(token: string | null | undefined): string {
  if (!token) return "";
  if (!token.includes(":")) return token; // assume already plain (legacy)
  const parts = token.split(":");
  if (parts.length !== 5 || parts[0] !== "v1" || parts[1] !== "gcm") {
    // unknown format – return as-is to avoid data loss
    return token;
  }
  const [, , ivB64, ctB64, tagB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return plain;
}

/**
 * Additional Cryptography Utilities
 */

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 32;
const SALT_LENGTH = 64;

/**
 * Hash a password using PBKDF2
 * @param password - Plain text password
 * @returns Hashed password in format: salt:hash
 */
export function hashPassword(password: string): string {
  try {
    const salt = crypto.randomBytes(SALT_LENGTH).toString("hex");
    const hash = crypto
      .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, "sha512")
      .toString("hex");

    return `${salt}:${hash}`;
  } catch (error) {
    console.error("Password hashing error:", error);
    throw new Error("Failed to hash password");
  }
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hashedPassword - Hashed password from database
 * @returns True if password matches
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  try {
    if (!hashedPassword || !hashedPassword.includes(":")) {
      return false;
    }

    const parts = hashedPassword.split(":");
    if (parts.length !== 2) {
      return false;
    }

    const [salt, originalHash] = parts;
    const hash = crypto
      .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, "sha512")
      .toString("hex");

    // timingSafeEqual requires buffers of identical length
    const buf1 = Buffer.from(hash, "hex");
    const buf2 = Buffer.from(originalHash, "hex");

    if (buf1.length !== buf2.length) {
      return false;
    }

    return crypto.timingSafeEqual(buf1, buf2);
  } catch (error) {
    return false;
  }
}

/**
 * Generate a random token
 * @param length - Length of the token in bytes (default: 32)
 * @returns Random token as hex string
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Generate a secure random string
 * @param length - Length of the string (default: 16)
 * @returns Random string
 */
export function generateSecureString(length: number = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomBytes = crypto.randomBytes(length);
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }

  return result;
}

/**
 * Hash data using SHA-256
 * @param data - Data to hash
 * @returns SHA-256 hash as hex string
 */
export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Create HMAC signature
 * @param data - Data to sign
 * @param secret - Secret key
 * @returns HMAC signature as hex string
 */
export function createHmac(data: string, secret: string): string {
  if (!secret) {
    throw new Error("Secret key is required for HMAC");
  }
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Verify HMAC signature
 * @param data - Original data
 * @param signature - HMAC signature to verify
 * @param secret - Secret key
 * @returns True if signature is valid
 */
export function verifyHmac(data: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = createHmac(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    return false;
  }
}

/**
 * Encrypt object to JSON string
 * @param obj - Object to encrypt
 * @returns Encrypted JSON string
 */
export function encryptObject<T>(obj: T): string {
  const json = JSON.stringify(obj);
  return encryptString(json);
}

/**
 * Decrypt JSON string to object
 * @param encryptedJson - Encrypted JSON string
 * @returns Decrypted object
 */
export function decryptObject<T>(encryptedJson: string): T {
  const json = decryptString(encryptedJson);
  return JSON.parse(json) as T;
}

/**
 * Generate encryption key (for initial setup)
 * @returns 32-byte random key as base64 string
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

/**
 * Test encryption/decryption
 * @returns True if encryption is working correctly
 */
export function testEncryption(): boolean {
  try {
    const testString = "Hello, World! 🔐";
    const encrypted = encryptString(testString);
    const decrypted = decryptString(encrypted);
    return decrypted === testString;
  } catch (error) {
    console.error("Encryption test failed:", error);
    return false;
  }
}
