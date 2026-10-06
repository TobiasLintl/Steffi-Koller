import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Backup encryption with Node's standard AES-256-GCM (no custom cryptography):
 * file = "SZBK1" | salt(16) | iv(12) | ciphertext | authTag(16); key = scrypt(passphrase, salt).
 */
const MAGIC = Buffer.from("SZBK1");

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  if (passphrase.length < 16)
    throw new Error("BACKUP_ENCRYPTION_KEY must have at least 16 characters");
  return scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export function encryptBackup(plain: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, body, cipher.getAuthTag()]);
}

export function decryptBackup(file: Buffer, passphrase: string): Buffer {
  if (file.length < MAGIC.length + 16 + 12 + 16 || !file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Not a Seelenzeit backup file");
  }
  const salt = file.subarray(5, 21);
  const iv = file.subarray(21, 33);
  const tag = file.subarray(file.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(file.subarray(33, file.length - 16)), decipher.final()]);
}

export function backupKey(now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return `backups/seelenzeit-${stamp}.dump.enc`;
}

/** Keys older than the retention window (keys carry their timestamp). */
export function expiredBackupKeys(keys: string[], now: Date, retentionDays: number): string[] {
  const limit = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return keys.filter((key) => {
    const m = key.match(/seelenzeit-(\d{8})-(\d{6})\.dump\.enc$/);
    if (!m) return false;
    const [d, t] = [m[1]!, m[2]!];
    const time = Date.UTC(
      +d.slice(0, 4),
      +d.slice(4, 6) - 1,
      +d.slice(6, 8),
      +t.slice(0, 2),
      +t.slice(2, 4),
      +t.slice(4, 6),
    );
    return time < limit;
  });
}
