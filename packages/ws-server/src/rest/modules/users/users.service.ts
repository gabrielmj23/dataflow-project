import { eq } from "drizzle-orm";
import db from "../../db.js";
import { usersTable } from "./users.model.js";
import { UserInsert, UserSelect } from "./users.types.js";

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

  return user[0];
}

export async function findUserByEmail(email: string): Promise<UserSelect> {
  const user = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
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
