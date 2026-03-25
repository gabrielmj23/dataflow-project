import { Router } from "express";
import multer from "multer";
import {
  createProject,
  deleteProject,
  findProjectById,
  findProjects,
  updateProject,
} from "./projects.service";
import {
  ensureGuestOwnerIdentity,
  resolveProjectViewerIdentity,
} from "./project-identity";
import type { ProjectCreate, ProjectUpdate } from "./projects.types";
import { ensureNoProhibitedTerms } from "../../moderation/text-moderation";
import { uploadProjectThumbnailToStorage } from "./project-thumbnail-storage";

const MAX_THUMBNAIL_UPLOAD_BYTES = 12 * 1024 * 1024;

const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_THUMBNAIL_UPLOAD_BYTES },
});

function normalizeGuestAuthorName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function getProjectCreateBody(body: unknown) {
  const payload = (body ?? {}) as Record<string, unknown>;

  return {
    name: typeof payload.name === "string" ? payload.name : undefined,
    description:
      typeof payload.description === "string" ? payload.description : undefined,
    remixedFrom:
      typeof payload.remixedFrom === "string" ? payload.remixedFrom : undefined,
    thumbnail: normalizeProjectThumbnailUrl(payload.thumbnail),
    isPublic:
      typeof payload.isPublic === "boolean" ? payload.isPublic : undefined,
    program: payload.program,
  };
}

function hasProjectProgram(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function getProjectUpdateBody(body: unknown): ProjectUpdate {
  const payload = (body ?? {}) as Record<string, unknown>;
  const updateData: ProjectUpdate = {};

  if (typeof payload.name === "string") {
    updateData.name = payload.name;
  }

  if (typeof payload.description === "string") {
    updateData.description = payload.description;
  }

  if (payload.thumbnail !== undefined) {
    updateData.thumbnail = normalizeProjectThumbnailUrl(payload.thumbnail);
  }

  if (typeof payload.isPublic === "boolean") {
    updateData.isPublic = payload.isPublic;
  }

  if (payload.program !== undefined) {
    updateData.program = payload.program as ProjectUpdate["program"];
  }

  return updateData;
}

function normalizeProjectThumbnailUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new Error("La miniatura del proyecto debe ser una URL válida.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("La miniatura del proyecto debe usar http o https.");
  }

  return trimmedValue;
}

const projectsRouter = Router();

/**
 * @openapi
 * /projects/thumbnail-upload:
 *   post:
 *     tags: [Projects]
 *     summary: Sube una miniatura de proyecto y devuelve su URL.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *             required: [thumbnail]
 *     responses:
 *       201:
 *         description: Miniatura subida.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectThumbnailUploadResponse'
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
projectsRouter.post("/thumbnail-upload", async (req, res) => {
  try {
    await new Promise<void>((resolve, reject) => {
      thumbnailUpload.single("thumbnail")(req, res, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    if (!req.file) {
      return res.status(400).json({ error: "Debes adjuntar una imagen." });
    }

    const fileMimeType = req.file.mimetype?.toLowerCase() ?? "";
    if (
      fileMimeType !== "image/jpeg" &&
      fileMimeType !== "image/png" &&
      fileMimeType !== "image/webp"
    ) {
      return res.status(400).json({
        error: "Solo se permiten imágenes JPG, PNG o WEBP.",
      });
    }

    const thumbnailUrl = await uploadProjectThumbnailToStorage({
      fileBuffer: req.file.buffer,
      contentType: fileMimeType,
    });

    return res.status(201).json({ url: thumbnailUrl });
  } catch (error: unknown) {
    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        error: "La imagen no puede superar los 12 MB.",
      });
    }

    console.error("Error uploading project thumbnail:", error);
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error, por favor intenta de nuevo",
    });
  }
});

/**
 * @openapi
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: Lista proyectos con filtros.
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: remixedFromId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Colección de proyectos.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProjectListItem'
 *       500:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
projectsRouter.get("/", async (req, res) => {
  try {
    const viewer = resolveProjectViewerIdentity(req);
    const searchData = {
      name: req.query.name ? String(req.query.name) : undefined,
      authorId: req.query.authorId ? String(req.query.authorId) : undefined,
      remixedFromId: req.query.remixedFromId
        ? String(req.query.remixedFromId)
        : undefined,
      mine: req.query.mine === "true",
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      pageSize: req.query.pageSize
        ? parseInt(String(req.query.pageSize), 10)
        : undefined,
    };
    const projects = await findProjects(searchData, viewer);
    return res.status(200).json(projects);
  } catch (error: unknown) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error, por favor intenta de nuevo",
    });
  }
});

/**
 * @openapi
 * /projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Obtiene un proyecto.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proyecto.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectGet'
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
projectsRouter.get("/:id", async (req, res) => {
  try {
    const viewer = resolveProjectViewerIdentity(req);
    const projectId = req.params.id;
    const project = await findProjectById(projectId, viewer);
    return res.status(200).json(project);
  } catch (error: unknown) {
    console.error("Error fetching project:", error);
    return res.status(404).json({
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error, por favor intenta de nuevo",
    });
  }
});

/**
 * @openapi
 * /projects:
 *   post:
 *     tags: [Projects]
 *     summary: Crea un nuevo proyecto.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProjectCreate'
 *     responses:
 *       201:
 *         description: Proyecto creado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectGet'
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
projectsRouter.post("/", async (req, res) => {
  try {
    const viewer = resolveProjectViewerIdentity(req);
    const guestAuthorName = normalizeGuestAuthorName(req.body?.guestAuthorName);
    const createBody = getProjectCreateBody(req.body);

    if (!createBody.name?.trim()) {
      return res
        .status(400)
        .json({ error: "El proyecto debe tener un nombre." });
    }

    if (!hasProjectProgram(createBody.program)) {
      return res
        .status(400)
        .json({ error: "El proyecto debe incluir un programa." });
    }

    const normalizedName = createBody.name.trim();
    ensureNoProhibitedTerms("El titulo del proyecto", normalizedName);
    ensureNoProhibitedTerms(
      "La descripcion del proyecto",
      createBody.description ?? "",
    );

    const projectData: ProjectCreate =
      viewer.kind === "user"
        ? {
            name: normalizedName,
            description: createBody.description ?? "",
            remixedFrom: createBody.remixedFrom,
            isPublic: createBody.isPublic ?? true,
            thumbnail: createBody.thumbnail,
            program: createBody.program as ProjectCreate["program"],
            author: viewer.user.id,
            guestOwnerId: null,
            guestAuthorName: null,
          }
        : {
            name: normalizedName,
            description: createBody.description ?? "",
            remixedFrom: createBody.remixedFrom,
            isPublic: createBody.isPublic ?? true,
            thumbnail: createBody.thumbnail,
            program: createBody.program as ProjectCreate["program"],
            author: null,
            guestOwnerId: ensureGuestOwnerIdentity(req, res),
            guestAuthorName,
          };

    if (
      projectData.author === null &&
      projectData.isPublic &&
      !projectData.guestAuthorName
    ) {
      return res.status(400).json({
        error: "Debes indicar tu nombre para publicar sin iniciar sesión.",
      });
    }

    const effectiveViewer =
      viewer.kind === "anonymous"
        ? {
            kind: "guest" as const,
            guestOwnerId: projectData.guestOwnerId!,
          }
        : viewer;

    const project = await createProject(projectData, effectiveViewer);
    return res.status(201).json(project);
  } catch (error: unknown) {
    console.error("Error creating project:", error);
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error, por favor intenta de nuevo",
    });
  }
});

/**
 * @openapi
 * /projects/{id}:
 *   patch:
 *     tags: [Projects]
 *     summary: Actualiza un proyecto.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProjectUpdate'
 *     responses:
 *       200:
 *         description: Proyecto actualizado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectGet'
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
projectsRouter.patch("/:id", async (req, res) => {
  try {
    const viewer = resolveProjectViewerIdentity(req);
    const projectId = req.params.id;
    if (Array.isArray(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    if (viewer.kind === "anonymous") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updateBody = getProjectUpdateBody(req.body);
    if (typeof updateBody.name === "string") {
      ensureNoProhibitedTerms("El titulo del proyecto", updateBody.name);
    }

    if (typeof updateBody.description === "string") {
      ensureNoProhibitedTerms(
        "La descripcion del proyecto",
        updateBody.description,
      );
    }

    const updatedProject = await updateProject(
      projectId,
      {
        ...updateBody,
        guestAuthorName:
          viewer.kind === "guest" && "guestAuthorName" in (req.body ?? {})
            ? normalizeGuestAuthorName(req.body?.guestAuthorName)
            : undefined,
      },
      viewer,
    );
    return res.status(200).json(updatedProject);
  } catch (error: unknown) {
    console.error("Error updating project:", error);
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error, por favor intenta de nuevo",
    });
  }
});

/**
 * @openapi
 * /projects/{id}:
 *   delete:
 *     tags: [Projects]
 *     summary: Elimina un proyecto.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Proyecto eliminado.
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
projectsRouter.delete("/:id", async (req, res) => {
  try {
    const viewer = resolveProjectViewerIdentity(req);
    const projectId = req.params.id;
    if (Array.isArray(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    if (viewer.kind === "anonymous") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await deleteProject(projectId, viewer);
    return res.status(204).send();
  } catch (error: unknown) {
    console.error("Error deleting project:", error);
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error, por favor intenta de nuevo",
    });
  }
});

export { projectsRouter };
