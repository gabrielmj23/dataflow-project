import {
  createUser,
  findUserById,
  findUserByEmail,
  updateUserPassword,
} from "../users/users.service";
import type { UserInsert, UserSelect } from "../users/users.types";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { isRefreshTokenPayload, type AuthTokenPayload } from "./auth.types";
import crypto from "node:crypto";
import db from "../../db";
import { passwordResetCodesTable } from "./password-reset-codes.model";
import { refreshTokensTable } from "./refresh-tokens.model";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { sendMail } from "../../mailer";

type AuthSessionResult = {
  user: UserSelect;
  token: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

type AuthSessionWithTokenId = AuthSessionResult & {
  refreshTokenId: string;
};

function getAccessTokenTtl(): string {
  return process.env.JWT_ACCESS_EXPIRES?.trim() || "15m";
}

function getRefreshTokenDays(): number {
  const configuredDays = Number.parseInt(
    process.env.JWT_REFRESH_EXPIRES_DAYS ?? "30",
    10,
  );

  if (!Number.isFinite(configuredDays) || configuredDays <= 0) {
    return 30;
  }

  return configuredDays;
}

function getRefreshTokenSecret(): string {
  return process.env.JWT_REFRESH_SECRET?.trim() || process.env.JWT_SECRET!;
}

function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getRefreshTokenExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + getRefreshTokenDays());
  return expiresAt;
}

async function generateAccessToken(user: UserSelect) {
  const payload: AuthTokenPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: getAccessTokenTtl() as jwt.SignOptions["expiresIn"],
  });
  return token;
}

async function issueAuthSession(
  user: UserSelect,
): Promise<AuthSessionWithTokenId> {
  const refreshTokenId = crypto.randomUUID();
  const refreshTokenExpiresAt = getRefreshTokenExpiryDate();

  const refreshToken = jwt.sign(
    {
      sub: user.id,
      tokenId: refreshTokenId,
      type: "refresh",
    },
    getRefreshTokenSecret(),
    {
      expiresIn: getRefreshTokenDays() * 24 * 60 * 60,
    },
  );

  await db.insert(refreshTokensTable).values({
    id: refreshTokenId,
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiresAt,
  });

  const token = await generateAccessToken(user);

  return {
    user,
    token,
    refreshToken,
    refreshTokenExpiresAt,
    refreshTokenId,
  };
}

export function getRefreshTokenCookieMaxAgeMs(): number {
  return getRefreshTokenDays() * 24 * 60 * 60 * 1000;
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    const decoded = jwt.verify(refreshToken, getRefreshTokenSecret());
    if (!isRefreshTokenPayload(decoded)) {
      return;
    }

    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokensTable.id, decoded.tokenId),
          eq(refreshTokensTable.userId, decoded.sub),
          isNull(refreshTokensTable.revokedAt),
        ),
      );
  } catch {
    // no-op on malformed or expired refresh token.
  }
}

async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokensTable.userId, userId),
        isNull(refreshTokensTable.revokedAt),
      ),
    );
}

export async function refreshAuthSession(
  refreshToken: string,
): Promise<AuthSessionResult> {
  let decoded: unknown;

  try {
    decoded = jwt.verify(refreshToken, getRefreshTokenSecret());
  } catch {
    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  if (!isRefreshTokenPayload(decoded)) {
    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  const matchingTokenRows = await db
    .select({
      id: refreshTokensTable.id,
      tokenHash: refreshTokensTable.tokenHash,
    })
    .from(refreshTokensTable)
    .where(
      and(
        eq(refreshTokensTable.id, decoded.tokenId),
        eq(refreshTokensTable.userId, decoded.sub),
        isNull(refreshTokensTable.revokedAt),
        gt(refreshTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const currentToken = matchingTokenRows[0];
  if (!currentToken) {
    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  if (currentToken.tokenHash !== hashToken(refreshToken)) {
    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  const user = await findUserById(decoded.sub);
  const nextSession = await issueAuthSession(user);

  await db
    .update(refreshTokensTable)
    .set({
      revokedAt: new Date(),
      replacedByTokenId: nextSession.refreshTokenId,
    })
    .where(eq(refreshTokensTable.id, currentToken.id));

  return {
    user: nextSession.user,
    token: nextSession.token,
    refreshToken: nextSession.refreshToken,
    refreshTokenExpiresAt: nextSession.refreshTokenExpiresAt,
  };
}

export async function signUp(data: UserInsert) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error(
      "Ya existe una cuenta con este correo, por favor utiliza otro",
    );
  }

  try {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newUser = await createUser({
      ...data,
      email: normalizedEmail,
      password: hashedPassword,
    });
    const session = await issueAuthSession(newUser);
    return {
      user: session.user,
      token: session.token,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    };
  } catch {
    throw new Error(
      "Ocurrió un error al crear la cuenta, por favor intenta de nuevo",
    );
  }
}

export async function logIn(email: string, password: string) {
  const dbUser = await findUserByEmail(email.trim().toLowerCase());
  if (!dbUser) {
    throw new Error("Correo o contraseña incorrectos");
  }

  const isPasswordValid = await bcrypt.compare(password, dbUser.password);
  if (!isPasswordValid) {
    throw new Error("Correo o contraseña incorrectos");
  }

  const userWithoutPassword: UserSelect = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
  };
  const session = await issueAuthSession(userWithoutPassword);

  return {
    user: session.user,
    token: session.token,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
  };
}

function buildPasswordResetEmail(code: string) {
  const ttlMinutes = 15;
  return {
    subject: "Codigo para recuperar tu contraseña",
    text: `Tu codigo de recuperacion es: ${code}. Vence en ${ttlMinutes} minutos.`,
    html: `<p>Tu codigo de recuperacion es:</p><h2>${code}</h2><p>Este codigo vence en ${ttlMinutes} minutos.</p>`,
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Correo inválido");
  }

  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    return;
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db
    .delete(passwordResetCodesTable)
    .where(eq(passwordResetCodesTable.userId, user.id));

  await db.insert(passwordResetCodesTable).values({
    userId: user.id,
    codeHash,
    expiresAt,
  });

  const message = buildPasswordResetEmail(code);
  await sendMail({
    to: normalizedEmail,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

export async function resetPasswordWithCode(params: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const normalizedCode = params.code.trim();
  const normalizedPassword = params.newPassword;

  if (!normalizedEmail || !normalizedCode) {
    throw new Error("Datos inválidos");
  }

  if (normalizedPassword.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }

  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error("Código inválido o expirado");
  }

  const activeCodeRows = await db
    .select({
      id: passwordResetCodesTable.id,
      codeHash: passwordResetCodesTable.codeHash,
    })
    .from(passwordResetCodesTable)
    .where(
      and(
        eq(passwordResetCodesTable.userId, user.id),
        isNull(passwordResetCodesTable.consumedAt),
        gt(passwordResetCodesTable.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(passwordResetCodesTable.createdAt))
    .limit(1);

  const activeCode = activeCodeRows[0];
  if (!activeCode) {
    throw new Error("Código inválido o expirado");
  }

  const isCodeValid = await bcrypt.compare(normalizedCode, activeCode.codeHash);
  if (!isCodeValid) {
    throw new Error("Código inválido o expirado");
  }

  const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
  await updateUserPassword(user.id, hashedPassword);
  await revokeAllRefreshTokensForUser(user.id);

  await db
    .update(passwordResetCodesTable)
    .set({ consumedAt: new Date() })
    .where(eq(passwordResetCodesTable.id, activeCode.id));
}
