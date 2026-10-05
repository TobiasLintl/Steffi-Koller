import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_SIGNED_URL_TTL_SECONDS, type StorageAdapter } from "./types";

/**
 * Development driver: files on local disk, delivered through /api/files with HMAC-signed,
 * expiring URLs – the same semantics as S3 presigned URLs, so access rules are testable
 * without a cloud account. Not for production.
 */
export interface LocalStorageConfig {
  rootDir: string;
  baseUrl: string;
  signingSecret: string;
  now?: () => number;
}

export interface LocalSignedParams {
  key: string;
  op: "get" | "put";
  exp: number;
  disposition?: string;
  name?: string;
  type?: string;
}

function canonical(p: LocalSignedParams): string {
  return [p.op, p.key, p.exp, p.disposition ?? "", p.name ?? "", p.type ?? ""].join("\n");
}

export function signLocal(secret: string, params: LocalSignedParams): string {
  return createHmac("sha256", secret).update(canonical(params)).digest("base64url");
}

export function verifyLocal(
  secret: string,
  params: LocalSignedParams,
  sig: string,
  nowMs = Date.now(),
): boolean {
  if (!Number.isFinite(params.exp) || params.exp * 1000 < nowMs) return false;
  const expected = Buffer.from(signLocal(secret, params));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function safeKeyPath(rootDir: string, key: string): string {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  const full = path.resolve(rootDir, key);
  if (!full.startsWith(path.resolve(rootDir) + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export function createLocalStorageAdapter(config: LocalStorageConfig): StorageAdapter {
  const now = config.now ?? Date.now;
  const url = (params: LocalSignedParams) => {
    const search = new URLSearchParams({
      key: params.key,
      op: params.op,
      exp: String(params.exp),
      ...(params.disposition ? { disposition: params.disposition } : {}),
      ...(params.name ? { name: params.name } : {}),
      ...(params.type ? { type: params.type } : {}),
      sig: signLocal(config.signingSecret, params),
    });
    return `${config.baseUrl}/api/files?${search.toString()}`;
  };

  return {
    async putObject(key, body) {
      const file = safeKeyPath(config.rootDir, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async getObject(key) {
      try {
        return new Uint8Array(await readFile(safeKeyPath(config.rootDir, key)));
      } catch {
        return null;
      }
    },
    async headObject(key) {
      try {
        const s = await stat(safeKeyPath(config.rootDir, key));
        return { size: s.size };
      } catch {
        return null;
      }
    },
    async getSignedDownloadUrl(key, options) {
      const exp = Math.floor(now() / 1000) + (options.ttlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS);
      return url({
        key,
        op: "get",
        exp,
        disposition: options.disposition,
        name: options.fileName,
        type: options.contentType,
      });
    },
    async getSignedUploadUrl(key, contentType, ttlSeconds = 3600) {
      const exp = Math.floor(now() / 1000) + ttlSeconds;
      return {
        url: url({ key, op: "put", exp, type: contentType }),
        method: "PUT",
        headers: { "content-type": contentType },
        expiresAt: new Date(exp * 1000),
      };
    },
    async deleteObject(key) {
      await rm(safeKeyPath(config.rootDir, key), { force: true });
    },
  };
}
