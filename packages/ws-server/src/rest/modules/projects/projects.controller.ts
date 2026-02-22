import { Router } from "express";
import {
  createProject,
  deleteProject,
  findProjectById,
  findProjects,
  updateProject,
} from "./projects.service";
import { authGuard } from "../auth/auth.guard";

const projectsRouter = Router();

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
 *                 $ref: '#/components/schemas/ProjectGet'
 *       500:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
projectsRouter.get("/", async (req, res) => {
  try {
    const searchData = {
      name: req.query.name ? String(req.query.name) : undefined,
      authorId: req.query.authorId ? String(req.query.authorId) : undefined,
      remixedFromId: req.query.remixedFromId
        ? String(req.query.remixedFromId)
        : undefined,
      page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
      pageSize: req.query.pageSize
        ? parseInt(String(req.query.pageSize), 10)
        : undefined,
    };
    const projects = await findProjects(searchData);
    return res.status(200).json(projects);
  } catch (error: unknown) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
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
    const projectId = req.params.id;
    const project = await findProjectById(projectId);
    return res.status(200).json(project);
  } catch (error: unknown) {
    console.error("Error fetching project:", error);
    return res.status(404).json({
      error: error instanceof Error ? error.message : "Internal server error",
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
projectsRouter.post("/", authGuard, async (req, res) => {
  try {
    const project = await createProject({ ...req.body, author: req.user!.id });
    return res.status(201).json(project);
  } catch (error: unknown) {
    console.error("Error creating project:", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Internal server error",
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
projectsRouter.patch("/:id", authGuard, async (req, res) => {
  try {
    const projectId = req.params.id;
    if (Array.isArray(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }
    const updatedProject = await updateProject(projectId, req.body);
    return res.status(200).json(updatedProject);
  } catch (error: unknown) {
    console.error("Error updating project:", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Internal server error",
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
projectsRouter.delete("/:id", authGuard, async (req, res) => {
  try {
    const projectId = req.params.id;
    if (Array.isArray(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }
    await deleteProject(projectId, req.user!);
    return res.status(204).send();
  } catch (error: unknown) {
    console.error("Error deleting project:", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export { projectsRouter };
