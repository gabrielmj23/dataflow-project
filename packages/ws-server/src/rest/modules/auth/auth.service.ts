import { createUser, findUserByEmail } from "../users/users.service.js";
import type { UserInsert, UserSelect } from "../users/users.types.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AuthTokenPayload } from "./auth.types.js";

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
  const hashedPassword = await bcrypt.hash(data.password, 10);
  const newUser = await createUser({
    ...data,
    password: hashedPassword,
  });
  const token = await generateToken(newUser);
  return { user: newUser, token };
}

export async function logIn(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const dbUser = await findUserByEmail(email);
  if (dbUser.password !== hashedPassword) {
    throw new Error("Credenciales inválidas");
  }

  const token = await generateToken(dbUser);
  const userWithoutPassword = { ...dbUser, password: undefined };
  return { user: userWithoutPassword, token };
}
