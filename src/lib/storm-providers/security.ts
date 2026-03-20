import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_PREFIX = "v1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function deriveEncryptionKey(secret: string): Buffer {
  if (/^[a-fA-F0-9]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  try {
    const asBase64 = Buffer.from(secret, "base64");
    if (asBase64.length === 32) {
      return asBase64;
    }
  } catch {
    // Fall through to hash derivation.
  }

  return createHash("sha256").update(secret).digest();
}

function getEncryptionSecretOrThrow(): string {
  const secret =
    process.env.STORM_PROVIDER_ENCRYPTION_KEY?.trim() ||
    process.env.INTEGRATION_ENCRYPTION_KEY?.trim() ||
    process.env.JOBNIMBUS_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error(
      "Missing STORM_PROVIDER_ENCRYPTION_KEY (or INTEGRATION_ENCRYPTION_KEY / JOBNIMBUS_ENCRYPTION_KEY)"
    );
  }
  return secret;
}

function isEncryptedValue(value: string): boolean {
  return value.startsWith(`${ENCRYPTION_PREFIX}:`);
}

/**
 * Encrypt storm provider API credentials (HailTrace, Hail Recon).
 * Uses same pattern as JobNimbus encryption.
 */
export function encryptStormProviderCredentials(credentials: string): string {
  const encryptionSecret = getEncryptionSecretOrThrow();
  const key = deriveEncryptionKey(encryptionSecret);

  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(credentials, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString(
    "base64"
  )}`;
}

/**
 * Decrypt storm provider API credentials.
 */
export function decryptStormProviderCredentials(storedValue: string): string {
  if (!storedValue) return storedValue;
  if (!isEncryptedValue(storedValue)) {
    return storedValue;
  }

  const encryptionSecret = getEncryptionSecretOrThrow();
  const key = deriveEncryptionKey(encryptionSecret);
  const [, ivB64, authTagB64, encryptedB64] = storedValue.split(":");

  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error("Invalid encrypted storm provider credential format");
  }

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
