import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

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
	const secret = process.env.JOBNIMBUS_ENCRYPTION_KEY?.trim();
	if (!secret) {
		throw new Error("Missing JOBNIMBUS_ENCRYPTION_KEY");
	}
	return secret;
}

function isEncryptedValue(value: string): boolean {
	return value.startsWith(`${ENCRYPTION_PREFIX}:`);
}

function safeCompare(a: string, b: string): boolean {
	const aBuf = Buffer.from(a);
	const bBuf = Buffer.from(b);
	if (aBuf.length !== bBuf.length) return false;
	return timingSafeEqual(aBuf, bBuf);
}

export function encryptJobNimbusApiKey(apiKey: string): string {
	const encryptionSecret = getEncryptionSecretOrThrow();
	const key = deriveEncryptionKey(encryptionSecret);

	const iv = randomBytes(12);
	const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
	const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();

	return `${ENCRYPTION_PREFIX}:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString(
		"base64"
	)}`;
}

export function decryptJobNimbusApiKey(storedValue: string): string {
	if (!storedValue) return storedValue;
	if (!isEncryptedValue(storedValue)) {
		// Backward compatibility for legacy plaintext values.
		return storedValue;
	}

	const encryptionSecret = getEncryptionSecretOrThrow();
	const key = deriveEncryptionKey(encryptionSecret);
	const [, ivB64, authTagB64, encryptedB64] = storedValue.split(":");

	if (!ivB64 || !authTagB64 || !encryptedB64) {
		throw new Error("Invalid encrypted JobNimbus credential format");
	}

	const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivB64, "base64"));
	decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(encryptedB64, "base64")),
		decipher.final(),
	]);
	return decrypted.toString("utf8");
}

export function verifyJobNimbusWebhookSignature(rawBody: string, signatureHeader: string | null): {
	valid: boolean;
	reason?: string;
} {
	const secret = process.env.JOBNIMBUS_WEBHOOK_SECRET?.trim();
	if (!secret) {
		if (process.env.NODE_ENV === "production") {
			return { valid: false, reason: "JOBNIMBUS_WEBHOOK_SECRET is required in production" };
		}
		return { valid: true };
	}

	if (!signatureHeader) {
		return { valid: false, reason: "Missing x-jobnimbus-signature header" };
	}

	const provided = signatureHeader.replace(/^sha256=/i, "").trim();
	const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
	const expectedBase64 = createHmac("sha256", secret).update(rawBody).digest("base64");

	const valid = safeCompare(provided, expectedHex) || safeCompare(provided, expectedBase64);
	return valid ? { valid: true } : { valid: false, reason: "Invalid webhook signature" };
}
