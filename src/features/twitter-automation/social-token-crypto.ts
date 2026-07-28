import "server-only";

import crypto from "node:crypto";

const TOKEN_CIPHER_VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function getTokenEncryptionKey() {
  const encodedKey = process.env.SOCIAL_AUTOMATION_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encodedKey) {
    throw new Error("SOCIAL_AUTOMATION_TOKEN_ENCRYPTION_KEY is required for social provider tokens.");
  }

  const key = Buffer.from(encodedKey, "base64url");
  if (key.length !== 32) {
    throw new Error("SOCIAL_AUTOMATION_TOKEN_ENCRYPTION_KEY must be a base64url-encoded 32-byte key.");
  }

  return key;
}

function encode(value: Buffer) {
  return value.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

export function encryptSocialProviderToken(token: string) {
  if (!token) throw new Error("A social provider token is required.");

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [TOKEN_CIPHER_VERSION, encode(iv), encode(ciphertext), encode(authTag)].join(".");
}

export function decryptSocialProviderToken(ciphertext: string) {
  const [version, encodedIv, encodedCiphertext, encodedAuthTag, ...unexpected] = ciphertext.split(".");
  if (version !== TOKEN_CIPHER_VERSION || !encodedIv || !encodedCiphertext || !encodedAuthTag || unexpected.length) {
    throw new Error("The social provider token ciphertext is invalid.");
  }

  const iv = decode(encodedIv);
  const encrypted = decode(encodedCiphertext);
  const authTag = decode(encodedAuthTag);
  if (iv.length !== IV_BYTES || !encrypted.length || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("The social provider token ciphertext is invalid.");
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("The social provider token could not be decrypted.");
  }
}
