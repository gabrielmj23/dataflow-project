import { randomUUID } from "node:crypto";
import process from "node:process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BlobServiceClient } from "@azure/storage-blob";

const DEFAULT_THUMBNAIL_CONTAINER = "project-thumbnails";
const DEFAULT_S3_REGION = "us-east-1";

const SUPPORTED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type StorageProvider = "azure" | "s3";

interface ThumbnailStorage {
  upload(params: {
    key: string;
    fileBuffer: Buffer;
    contentType: string;
  }): Promise<string>;
}

let thumbnailStorage: ThumbnailStorage | null = null;

function readEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Falta configurar ${name} en el servidor.`);
  }

  return value;
}

function getStorageProvider(): StorageProvider {
  const provider = (readEnv("STORAGE_PROVIDER") ?? "azure").toLowerCase();
  if (provider !== "azure" && provider !== "s3") {
    throw new Error(
      `STORAGE_PROVIDER inválido: "${provider}". Valores permitidos: azure, s3.`,
    );
  }

  return provider;
}

function createAzureStorage(): ThumbnailStorage {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    requireEnv("STORAGE_URL"),
  );
  const containerName =
    readEnv("AZURE_STORAGE_CONTAINER") ?? DEFAULT_THUMBNAIL_CONTAINER;

  return {
    async upload({ key, fileBuffer, contentType }) {
      const container = blobServiceClient.getContainerClient(containerName);
      await container.createIfNotExists({ access: "blob" });

      const blob = container.getBlockBlobClient(key);
      await blob.uploadData(fileBuffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
        },
      });

      return blob.url;
    },
  };
}

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function createS3Storage(): ThumbnailStorage {
  const bucket = requireEnv("S3_BUCKET");
  const region = readEnv("S3_REGION") ?? DEFAULT_S3_REGION;
  const endpoint = readEnv("S3_ENDPOINT");
  const accessKeyId = readEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = readEnv("S3_SECRET_ACCESS_KEY");
  const forcePathStyleEnv = readEnv("S3_FORCE_PATH_STYLE");
  // Los servicios compatibles (MinIO, etc.) suelen requerir path-style;
  // AWS usa virtual-hosted por defecto.
  const forcePathStyle =
    forcePathStyleEnv !== undefined
      ? forcePathStyleEnv.toLowerCase() === "true"
      : endpoint !== undefined;

  // Sin llaves explícitas, el SDK usa su cadena por defecto (AWS_*, perfiles, roles).
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials:
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined,
  });

  const publicBaseUrl = readEnv("S3_PUBLIC_URL");
  let baseUrl: string;
  if (publicBaseUrl) {
    baseUrl = stripTrailingSlashes(publicBaseUrl);
  } else if (endpoint) {
    baseUrl = `${stripTrailingSlashes(endpoint)}/${bucket}`;
  } else {
    baseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;
  }

  return {
    async upload({ key, fileBuffer, contentType }) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
        }),
      );

      return `${baseUrl}/${key}`;
    },
  };
}

function getThumbnailStorage(): ThumbnailStorage {
  if (!thumbnailStorage) {
    thumbnailStorage =
      getStorageProvider() === "s3" ? createS3Storage() : createAzureStorage();
  }

  return thumbnailStorage;
}

function buildThumbnailKey(contentType: string): string {
  const extension = SUPPORTED_CONTENT_TYPES[contentType];
  if (!extension) {
    throw new Error("Formato de imagen no permitido.");
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${randomUUID()}.${extension}`;
}

export async function uploadProjectThumbnailToStorage(params: {
  fileBuffer: Buffer;
  contentType: string;
}): Promise<string> {
  const normalizedContentType = params.contentType.toLowerCase();
  if (!SUPPORTED_CONTENT_TYPES[normalizedContentType]) {
    throw new Error("Formato de imagen no permitido.");
  }

  return getThumbnailStorage().upload({
    key: buildThumbnailKey(normalizedContentType),
    fileBuffer: params.fileBuffer,
    contentType: normalizedContentType,
  });
}
