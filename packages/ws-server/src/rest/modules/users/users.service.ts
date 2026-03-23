import { eq } from "drizzle-orm";
import db from "../../db";
import { usersTable } from "./users.model";
import { User, UserInsert, UserSelect } from "./users.types";

export async function findUserById(id: string): Promise<UserSelect> {
  const user = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!user.length) {
    throw new Error("Usuario no encontrado");
  }

  return user[0];
}

export async function findUserByEmail(email: string): Promise<User> {
  const user = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      password: usersTable.password,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  return user[0];
}

export async function createUser(data: UserInsert): Promise<UserSelect> {
  const [user] = await db.insert(usersTable).values(data).returning({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
  });

  return user;
}

export async function updateUserPassword(
  userId: string,
  hashedPassword: string,
): Promise<void> {
  await db
    .update(usersTable)
    .set({ password: hashedPassword })
    .where(eq(usersTable.id, userId));
}
