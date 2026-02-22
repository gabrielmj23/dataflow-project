import { Router } from "express";
import { findUserById } from "./users.service";

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

export { usersRouter };
