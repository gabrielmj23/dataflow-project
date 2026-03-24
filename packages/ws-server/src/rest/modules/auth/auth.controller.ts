import { Router } from "express";
import { logIn, signUp } from "./auth.service";

const authRouter = Router();

/**
 * @openapi
 * /auth/sign-up:
 *   post:
 *     tags: [Auth]
 *     summary: Crea un usuario y devuelve token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignUpBody'
 *     responses:
 *       201:
 *         description: Usuario creado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Error de validación o creación.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post("/sign-up", async (req, res) => {
  try {
    const result = await signUp(req.body);
    return res.status(201).json(result);
  } catch (error: unknown) {
    console.error("Error signing up:", error);
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
 * /auth/log-in:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesión y devuelve token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogInBody'
 *     responses:
 *       200:
 *         description: Login correcto.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Credenciales inválidas.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post("/log-in", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await logIn(email, password);
    return res.status(200).json(result);
  } catch (error: unknown) {
    console.error("Error logging in:", error);
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error, por favor intenta de nuevo",
    });
  }
});

export { authRouter };
