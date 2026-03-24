import { createUser, findUserByEmail } from "../users/users.service";
import type { UserInsert, UserSelect } from "../users/users.types";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AuthTokenPayload } from "./auth.types";

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
  const dbUser = await findUserByEmail(email);
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
