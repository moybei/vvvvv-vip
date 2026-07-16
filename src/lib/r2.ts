import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.R2_BUCKET_NAME!;

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToR2(
  path: string,
  body: Buffer,
  contentType: string,
) {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: path,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getR2SignedUrl(path: string, expiresInSeconds: number) {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: path }), {
    expiresIn: expiresInSeconds,
  });
}

export async function getR2SignedUrls(paths: string[], expiresInSeconds: number) {
  return Promise.all(paths.map((path) => getR2SignedUrl(path, expiresInSeconds)));
}

export async function deleteFromR2(paths: string[]) {
  if (paths.length === 0) return;
  await r2.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: paths.map((Key) => ({ Key })) },
    }),
  );
}
