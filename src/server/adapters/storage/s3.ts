import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { contentDisposition, DEFAULT_SIGNED_URL_TTL_SECONDS, type StorageAdapter } from "./types";

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export function createS3StorageAdapter(config: S3StorageConfig): StorageAdapter {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle ?? false,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const Bucket = config.bucket;

  return {
    async putObject(key, body, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    async getObject(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return result.Body ? await result.Body.transformToByteArray() : null;
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async headObject(key) {
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { size: result.ContentLength ?? 0 };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async getSignedDownloadUrl(key, options) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket,
          Key: key,
          ResponseContentDisposition: contentDisposition(options.disposition, options.fileName),
          ResponseContentType: options.contentType,
          ResponseCacheControl: "private, no-store",
        }),
        { expiresIn: options.ttlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS },
      );
    },
    async getSignedUploadUrl(key, contentType, ttlSeconds = 3600) {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }),
        {
          expiresIn: ttlSeconds,
        },
      );
      return {
        url,
        method: "PUT",
        headers: { "content-type": contentType },
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      };
    },
    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
  };
}

function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}
