import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface ObjectStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  deletePrefix(prefix: string): Promise<number>;
  check(): Promise<void>;
}

export class S3CompatibleObjectStore implements ObjectStore {
  private readonly bucket = process.env.S3_BUCKET || "hirelens";
  private readonly client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY ? { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } : undefined,
  });
  async put(key: string, body: Uint8Array, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: process.env.S3_SSE as "AES256" | undefined }));
  }
  async get(key: string) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) throw new Error("Object body is empty");
    return response.Body.transformToByteArray();
  }
  async deletePrefix(prefix: string) {
    let token: string | undefined;
    let removed = 0;
    do {
      const listed = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      const objects = (listed.Contents || []).flatMap((item) => item.Key ? [{ Key: item.Key }] : []);
      if (objects.length) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects, Quiet: true } }));
        removed += objects.length;
      }
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);
    return removed;
  }
  async check() { await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, MaxKeys: 1 })); }
}

export const objectStore = new S3CompatibleObjectStore();
