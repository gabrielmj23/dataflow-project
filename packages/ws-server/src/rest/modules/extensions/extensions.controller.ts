import { Router } from "express";
import {
  createExtension,
  addNodesToExtension,
  createNodeAndAddToExtension,
  getExtension,
  getExtensions,
} from "./extensions.service";
import { authGuard } from "../auth/auth.guard";
import { ensureNoProhibitedTerms } from "../../moderation/text-moderation";

const extensionsRouter = Router();

/**
 * @openapi
 * /extensions:
 *   get:
 *     tags: [Extensions]
 *     summary: Lista extensiones con filtros.
 *     parameters:
 *       - in: query
 *         name: search
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
 *         description: Colección de extensiones.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExtensionListItem'
 *       500:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
extensionsRouter.get("/", async (req, res) => {
  try {
    const searchData = {
      search: req.query.search ? String(req.query.search) : undefined,
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      pageSize: req.query.pageSize
        ? parseInt(String(req.query.pageSize), 10)
        : undefined,
    };
    const extensions = await getExtensions(searchData);
    return res.status(200).json(extensions);
  } catch (error: unknown) {
    console.error("Error fetching extensions:", error);
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
 * /extensions/{id}:
 *   get:
 *     tags: [Extensions]
 *     summary: Obtiene una extensión (con sus nodos).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Extensión.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExtensionGet'
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
extensionsRouter.get("/:id", async (req, res) => {
  try {
    const extensionId = req.params.id;
    if (Array.isArray(extensionId)) {
      return res.status(400).json({ error: "Invalid extension ID" });
    }
    const extension = await getExtension(extensionId);
    if (!extension) {
      return res.status(404).json({ error: "Extension not found" });
    }
    return res.status(200).json(extension);
  } catch (error: unknown) {
    console.error("Error fetching extension:", error);
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
 * /extensions:
 *   post:
 *     tags: [Extensions]
 *     summary: Crea una nueva extensión.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExtensionCreate'
 *     responses:
 *       201:
 *         description: Extensión creada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExtensionListItem'
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
extensionsRouter.post("/", authGuard, async (req, res) => {
  try {
    ensureNoProhibitedTerms(
      "El nombre de la extensión",
      String(req.body?.name ?? ""),
    );
    ensureNoProhibitedTerms(
      "La descripción de la extensión",
      String(req.body?.description ?? ""),
    );

    const extension = await createExtension({
      ...req.body,
      author: req.user!.id,
    });
    return res.status(201).json(extension);
  } catch (error: unknown) {
    console.error("Error creating extension:", error);
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
 * /extensions/{id}/nodes:
 *   post:
 *     tags: [Extensions]
 *     summary: Agrega nodos a una extensión.
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
 *             type: object
 *             properties:
 *               nodeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Nodos agregados.
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
extensionsRouter.post("/:id/nodes", authGuard, async (req, res) => {
  try {
    const extensionId = req.params.id;
    if (Array.isArray(extensionId)) {
      return res.status(400).json({ error: "La extensión no es válida" });
    }
    const nodeIds = Array.isArray(req.body.nodeIds) ? req.body.nodeIds : [];
    if (nodeIds.length === 0) {
      return res.status(400).json({ error: "Los IDs de los nodos son requeridos" });
    }
    const inserted = await addNodesToExtension(extensionId, nodeIds);
    return res.status(201).json(inserted);
  } catch (error: unknown) {
    console.error("Error adding nodes to extension:", error);
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
 * /extensions/{id}/nodes/upload:
 *   post:
 *     tags: [Extensions]
 *     summary: Crea un nodo a partir de JSON y lo agrega a la extensión.
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
 *             $ref: '#/components/schemas/CustomNodeCreate'
 *     responses:
 *       201:
 *         description: Nodo creado y asociado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomNodeCreateResponse'
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
extensionsRouter.post("/:id/nodes/upload", authGuard, async (req, res) => {
  try {
    const extensionId = req.params.id;
    if (Array.isArray(extensionId)) {
      return res.status(400).json({ error: "Invalid extension ID" });
    }

    const { name, description, code } = req.body;
    if (!name || !description || !code) {
      return res
        .status(400)
        .json({ error: "Los campos de nombre, descripción y código son requeridos" });
    }

    ensureNoProhibitedTerms("El nombre del nodo personalizado", String(name));
    ensureNoProhibitedTerms(
      "La descripción del nodo personalizado",
      String(description),
    );

    const createdNode = await createNodeAndAddToExtension(
      extensionId,
      {
        name,
        description,
        code,
      },
      req.user!.id,
    );

    return res.status(201).json(createdNode);
  } catch (error: unknown) {
    console.error("Error creating node and adding to extension:", error);
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error, por favor intenta de nuevo",
    });
  }
});

export { extensionsRouter };
