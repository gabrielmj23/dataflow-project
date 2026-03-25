import { isNotNull, eq } from "drizzle-orm";
import db from "../rest/db";
import { projectsTable } from "../rest/modules/projects/projects.model";
import { uploadProjectThumbnailToStorage } from "../rest/modules/projects/project-thumbnail-storage";

type MigrationOptions = {
  dryRun: boolean;
  limit: number | null;
};

type ParsedThumbnailPayload = {
  buffer: Buffer;
  contentType: string;
};

function parseArgs(argv: string[]): MigrationOptions {
  let dryRun = false;
  let limit: number | null = null;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--limit debe ser un entero positivo.");
      }
      limit = Math.floor(value);
      continue;
    }

    throw new Error(`Argumento no reconocido: ${arg}`);
  }

  return { dryRun, limit };
}

function normalizeBase64String(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function inferContentTypeFromBuffer(buffer: Buffer): string {
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  throw new Error("No se pudo inferir el tipo de imagen desde el contenido.");
}

function parseBase64Thumbnail(value: string): ParsedThumbnailPayload {
  const trimmedValue = value.trim();
  const dataUrlMatch = /^data:([^;,]+);base64,(.+)$/i.exec(trimmedValue);

  let base64Payload = trimmedValue;
  let contentType: string | null = null;

  if (dataUrlMatch) {
    contentType = dataUrlMatch[1].toLowerCase();
    base64Payload = dataUrlMatch[2];
  }

  const normalizedBase64 = normalizeBase64String(base64Payload);
  if (!normalizedBase64) {
    throw new Error("El valor base64 está vacío.");
  }

  const buffer = Buffer.from(normalizedBase64, "base64");
  if (!buffer.length) {
    throw new Error("No se pudo decodificar la imagen base64.");
  }

  return {
    buffer,
    contentType: contentType ?? inferContentTypeFromBuffer(buffer),
  };
}

function isRemoteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await db
    .select({ id: projectsTable.id, thumbnail: projectsTable.thumbnail })
    .from(projectsTable)
    .where(isNotNull(projectsTable.thumbnail));

  const candidates = rows.filter((row) => {
    const thumbnail = row.thumbnail?.trim();
    return Boolean(thumbnail) && !isRemoteUrl(thumbnail!);
  });

  const limitedCandidates =
    options.limit === null ? candidates : candidates.slice(0, options.limit);

  if (!limitedCandidates.length) {
    console.log("No se encontraron miniaturas base64 para migrar.");
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    `Se procesarán ${limitedCandidates.length} miniaturas${options.dryRun ? " (dry-run)" : ""}.`,
  );

  for (const [index, row] of limitedCandidates.entries()) {
    const projectLabel = `${index + 1}/${limitedCandidates.length} (id=${row.id})`;

    try {
      const rawThumbnail = row.thumbnail?.trim();
      if (!rawThumbnail) {
        skipped += 1;
        console.log(`${projectLabel}: omitido (thumbnail vacío).`);
        continue;
      }

      const parsedThumbnail = parseBase64Thumbnail(rawThumbnail);

      if (options.dryRun) {
        migrated += 1;
        console.log(
          `${projectLabel}: listo para migrar (${parsedThumbnail.contentType}).`,
        );
        continue;
      }

      const uploadedUrl = await uploadProjectThumbnailToStorage({
        fileBuffer: parsedThumbnail.buffer,
        contentType: parsedThumbnail.contentType,
      });

      await db
        .update(projectsTable)
        .set({ thumbnail: uploadedUrl })
        .where(eq(projectsTable.id, row.id));

      migrated += 1;
      console.log(`${projectLabel}: migrado -> ${uploadedUrl}`);
    } catch (error: unknown) {
      failed += 1;
      console.error(
        `${projectLabel}: error -> ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      );
    }
  }

  console.log(
    `Resumen: migrados=${migrated}, omitidos=${skipped}, fallidos=${failed}.`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(
    `La migración terminó con error fatal: ${
      error instanceof Error ? error.message : "Error desconocido"
    }`,
  );
  process.exitCode = 1;
});
