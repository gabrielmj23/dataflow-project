import { Router } from "express";
import { findUserById } from "./users.service";
import { getExtensionsByAuthor } from "../extensions/extensions.service";
import { authGuard } from "../auth/auth.guard";

const usersRouter = Router();

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Obtiene un usuario por id.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSelect'
 *       404:
 *         description: Usuario no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
usersRouter.get("/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await findUserById(userId);
    return res.status(200).json(user);
  } catch (error: unknown) {
    console.error("Error fetching user:", error);
    return res.status(404).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * @openapi
 * /users/me/extensions:
 *   get:
 *     tags: [Users]
 *     summary: Lista extensiones del usuario autenticado.
 *     security:
 *       - bearerAuth: []
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
 *         description: Lista de extensiones.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExtensionListItem'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 */
usersRouter.get("/me/extensions", authGuard, async (req, res) => {
  try {
    const userId = req.user!.id;
    const extensions = await getExtensionsByAuthor(userId);
    return res.status(200).json(extensions);
  } catch (error: unknown) {
    console.error("Error fetching user's extensions:", error);
    return res.status(401).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export { usersRouter };
