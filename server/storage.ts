// File storage abstraction.
//
// In production (and on any serverless platform such as Netlify Functions or
// Vercel) the filesystem is read-only/ephemeral, so files MUST be persisted
// to S3-compatible object storage. When the S3_* env vars are configured we
// upload there. When they are not configured we fall back to writing under
// /tmp (or ./uploads locally) purely so local development keeps working
// without any setup — this fallback is NOT durable and NOT suitable for
// production traffic.

import * as fs from "fs";
import * as path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ENV } from "./_core/env.js";

function isS3Configured(): boolean {
  return Boolean(ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey);
}

let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: ENV.s3Region || "auto",
      endpoint: ENV.s3Endpoint || undefined,
      credentials: {
        accessKeyId: ENV.s3AccessKeyId,
        secretAccessKey: ENV.s3SecretAccessKey,
      },
      // Needed for most non-AWS S3-compatible providers (R2, Spaces, MinIO, ...).
      forcePathStyle: Boolean(ENV.s3Endpoint),
    });
  }
  return _s3Client;
}

function buildS3Url(key: string): string {
  if (ENV.s3PublicUrl) {
    return `${ENV.s3PublicUrl.replace(/\/+$/, "")}/${key}`;
  }
  if (ENV.s3Endpoint) {
    // Path-style URL for S3-compatible providers (R2, Spaces, MinIO, ...).
    return `${ENV.s3Endpoint.replace(/\/+$/, "")}/${ENV.s3Bucket}/${key}`;
  }
  // Standard AWS virtual-hosted-style URL.
  return `https://${ENV.s3Bucket}.s3.${ENV.s3Region || "us-east-1"}.amazonaws.com/${key}`;
}

// --- Local fallback (development only) -------------------------------------

const UPLOADS_DIR = path.resolve(
  ENV.isProduction ? "/tmp/uploads" : path.resolve(process.cwd(), "uploads")
);

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function getLocalBaseUrl(): string {
  return ENV.appBaseUrl || `http://localhost:${process.env.PORT || "3000"}`;
}

// -----------------------------------------------------------------------------

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  const buffer =
    typeof data === "string" ? Buffer.from(data) : Buffer.from(data as Uint8Array);

  if (isS3Configured()) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: ENV.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return { key, url: buildS3Url(key) };
  }

  // Local fallback — only reliable on a persistent (non-serverless) server.
  if (ENV.isProduction) {
    console.warn(
      "[storage] S3 is not configured (S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY). " +
        "Falling back to ephemeral /tmp storage — uploaded files WILL be lost. " +
        "Configure S3 env vars for production use."
    );
  }
  ensureUploadsDir();
  const fileName = key.replace(/\//g, "_");
  const filePath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(filePath, buffer);
  const url = `${getLocalBaseUrl()}/uploads/${fileName}`;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  if (isS3Configured()) {
    return { key, url: buildS3Url(key) };
  }
  const fileName = key.replace(/\//g, "_");
  return { key, url: `${getLocalBaseUrl()}/uploads/${fileName}` };
}
