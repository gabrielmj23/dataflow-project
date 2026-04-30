import { Router, type Request, type Response } from "express";
import {
  getRefreshTokenCookieMaxAgeMs,
  logIn,
  refreshAuthSession,
  requestPasswordReset,
  resetPasswordWithCode,
  revokeRefreshToken,
  signUp,
} from "./auth.service";

const authRouter = Router();
const REFRESH_TOKEN_COOKIE_NAME = "nodi_refresh_token";

function parseCookies(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        return cookies;
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!name || !value) {
        return cookies;
      }

      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }

      return cookies;
    }, {});
}

function getRefreshTokenFromRequest(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const refreshToken = cookies[REFRESH_TOKEN_COOKIE_NAME];
  if (!refreshToken || !refreshToken.trim()) {
    return null;
  }

  return refreshToken;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...getCookieOptions(),
    maxAge: getRefreshTokenCookieMaxAgeMs(),
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getCookieOptions());
}

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
    setRefreshTokenCookie(res, result.refreshToken);

    return res.status(201).json({
      user: result.user,
      token: result.token,
    });
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

    setRefreshTokenCookie(res, result.refreshToken);

    return res.status(200).json({
      user: result.user,
      token: result.token,
    });
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

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresca sesión usando cookie HttpOnly de refresh token.
 *     responses:
 *       200:
 *         description: Token renovado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Sesión expirada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post("/refresh", async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: "Debes iniciar sesión" });
    }

    const result = await refreshAuthSession(refreshToken);
    setRefreshTokenCookie(res, result.refreshToken);

    return res.status(200).json({
      user: result.user,
      token: result.token,
    });
  } catch (error: unknown) {
    clearRefreshTokenCookie(res);
    console.error("Error refreshing session:", error);
    return res.status(401).json({
      error:
        error instanceof Error
          ? error.message
          : "Sesión expirada. Inicia sesión nuevamente.",
    });
  }
});

/**
 * @openapi
 * /auth/log-out:
 *   post:
 *     tags: [Auth]
 *     summary: Cierra sesión y revoca refresh token actual.
 *     responses:
 *       200:
 *         description: Sesión cerrada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
authRouter.post("/log-out", async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
  } catch (error: unknown) {
    console.error("Error revoking refresh token on logout:", error);
  }

  clearRefreshTokenCookie(res);
  return res.status(200).json({ message: "Sesión cerrada." });
});

export { authRouter };
