import {
  createUser,
  findUserByEmail,
  updateUserPassword,
} from "../users/users.service";
import type { UserInsert, UserSelect } from "../users/users.types";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AuthTokenPayload } from "./auth.types";
import crypto from "node:crypto";
import db from "../../db";
import { passwordResetCodesTable } from "./password-reset-codes.model";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { sendMail } from "../../mailer";

async function generateToken(user: UserSelect) {
  const payload: AuthTokenPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: "24h",
  });
  return token;
}

export async function signUp(data: UserInsert) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error("Ya existe una cuenta con este correo, por favor utiliza otro");
  }

  try {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newUser = await createUser({
      ...data,
      email: normalizedEmail,
      password: hashedPassword,
    });
    const token = await generateToken(newUser);
    return { user: newUser, token };
  } catch {
    throw new Error("Ocurrió un error al crear la cuenta, por favor intenta de nuevo");
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

  const token = await generateToken(dbUser);
  const userWithoutPassword = { ...dbUser, password: undefined };
  return { user: userWithoutPassword, token };
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

  await db
    .update(passwordResetCodesTable)
    .set({ consumedAt: new Date() })
    .where(eq(passwordResetCodesTable.id, activeCode.id));
}
