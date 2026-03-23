import { Router } from "express";
import { logIn, requestPasswordReset, resetPasswordWithCode, signUp } from "./auth.service";

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
      error: error instanceof Error ? error.message : "Internal server error",
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
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * @openapi
 * /auth/request-password-reset:
 *   post:
 *     tags: [Auth]
 *     summary: Solicita código de recuperación por correo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RequestPasswordResetBody'
 *     responses:
 *       200:
 *         description: Solicitud procesada.
 *       400:
 *         description: Error de validación.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post("/request-password-reset", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    await requestPasswordReset(email);
    return res.status(200).json({
      message:
        "Si el correo existe, te enviamos un código para restablecer tu contraseña.",
    });
  } catch (error: unknown) {
    console.error("Error requesting password reset:", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Restablece la contraseña usando código enviado al correo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordBody'
 *     responses:
 *       200:
 *         description: Contraseña actualizada.
 *       400:
 *         description: Código inválido o datos incorrectos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post("/reset-password", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const newPassword =
      typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

    await resetPasswordWithCode({ email, code, newPassword });

    return res
      .status(200)
      .json({ message: "Contraseña actualizada correctamente." });
  } catch (error: unknown) {
    console.error("Error resetting password:", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export { authRouter };
