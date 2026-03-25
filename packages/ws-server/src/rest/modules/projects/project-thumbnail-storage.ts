import { randomUUID } from "node:crypto";
import process from "node:process";
import { BlobServiceClient } from "@azure/storage-blob";

const DEFAULT_THUMBNAIL_CONTAINER = "project-thumbnails";

const SUPPORTED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let blobServiceClient: BlobServiceClient | null = null;

function getStorageConnectionString(): string {
  const connectionString = process.env.STORAGE_URL?.trim();
  if (!connectionString) {
    throw new Error("Falta configurar STORAGE_URL en el servidor.");
  }

  return connectionString;
}

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(
      getStorageConnectionString(),
    );
  }

  return blobServiceClient;
}

function getThumbnailContainerName(): string {
  return (
    process.env.AZURE_STORAGE_CONTAINER?.trim() || DEFAULT_THUMBNAIL_CONTAINER
  );
}

function buildThumbnailBlobName(contentType: string): string {
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

  const container = getBlobServiceClient().getContainerClient(
    getThumbnailContainerName(),
  );
  await container.createIfNotExists({ access: "blob" });

  const blobName = buildThumbnailBlobName(normalizedContentType);
  const blob = container.getBlockBlobClient(blobName);
  await blob.uploadData(params.fileBuffer, {
    blobHTTPHeaders: {
      blobContentType: normalizedContentType,
    },
  });

  return blob.url;
}
