import "server-only";

import path from "node:path";

import {
  createLocalStorageAdapter,
  createS3StorageAdapter,
  type StorageAdapter,
} from "@/server/adapters/storage";
import {
  createBunnyVideoAdapter,
  createLocalVideoAdapter,
  type VideoAdapter,
} from "@/server/adapters/video";
import { serverEnv } from "@/server/env";

let storageInstance: StorageAdapter | undefined;
let videoInstance: VideoAdapter | undefined;

export function localSigningSecret(): string {
  return serverEnv().BETTER_AUTH_SECRET ?? "dev-only-local-storage-signing-secret";
}

export function storage(): StorageAdapter {
  if (storageInstance) return storageInstance;
  const env = serverEnv();
  storageInstance =
    env.STORAGE_DRIVER === "s3"
      ? createS3StorageAdapter({
          endpoint: env.S3_ENDPOINT!,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET!,
          accessKeyId: env.S3_ACCESS_KEY_ID!,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
          forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
        })
      : createLocalStorageAdapter({
          rootDir: path.resolve(env.LOCAL_STORAGE_DIR),
          baseUrl: env.NEXT_PUBLIC_APP_URL,
          signingSecret: localSigningSecret(),
        });
  return storageInstance;
}

export function videoAdapter(): VideoAdapter {
  if (videoInstance) return videoInstance;
  const env = serverEnv();
  videoInstance =
    env.VIDEO_DRIVER === "bunny"
      ? createBunnyVideoAdapter({
          libraryId: env.BUNNY_STREAM_LIBRARY_ID!,
          apiKey: env.BUNNY_STREAM_API_KEY!,
          tokenSecurityKey: env.BUNNY_STREAM_TOKEN_KEY!,
        })
      : createLocalVideoAdapter(storage());
  return videoInstance;
}

/** Test hook. */
export function setMediaAdapters(next: { storage?: StorageAdapter; video?: VideoAdapter }): void {
  storageInstance = next.storage;
  videoInstance = next.video;
}
