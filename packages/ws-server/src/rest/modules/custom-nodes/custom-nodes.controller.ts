import { Router } from "express";
import { createCustomNode, findCustomNodes } from "./custom-nodes.service";
import { authGuard } from "../auth/auth.guard";

const customNodesRouter = Router();

/**
 * @openapi
 * /nodes:
 *   get:
 *     tags: [CustomNodes]
 *     summary: Lista nodos personalizados con búsqueda y paginación.
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
 *         description: Colección de nodos personalizados.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CustomNodeGet'
 *       500:
 *         description: Error al buscar nodos personalizados.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
customNodesRouter.get("/", async (req, res) => {
  try {
    const searchData = {
      search: req.query.search ? String(req.query.search) : undefined,
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      pageSize: req.query.pageSize
        ? parseInt(String(req.query.pageSize), 10)
        : undefined,
    };
    const customNodes = await findCustomNodes(searchData);
    res.json(customNodes);
  } catch (error) {
    console.error("Error fetching custom nodes:", error);
    res.status(500).json({ error: "Error fetching custom nodes" });
  }
});

/**
 * @openapi
 * /nodes:
 *   post:
 *     tags: [CustomNodes]
 *     summary: Crea un nodo personalizado.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomNodeCreate'
 *     responses:
 *       201:
 *         description: Nodo personalizado creado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomNodeCreateResponse'
 *       500:
 *         description: Error al crear el nodo personalizado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
customNodesRouter.post("/", authGuard, async (req, res) => {
  try {
    const { name, description, code } = req.body;
    const authorId = req.user?.id;
    const created = await createCustomNode({
      name,
      description,
      code,
      author: authorId!,
    });
    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating custom node:", error);
    res.status(500).json({ error: "Error creating custom node" });
  }
});

export { customNodesRouter };
