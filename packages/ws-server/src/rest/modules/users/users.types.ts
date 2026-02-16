import { usersTable } from "./users.model.js";

export type UserSelect = Omit<typeof usersTable.$inferSelect, "password">;

export type UserInsert = Omit<typeof usersTable.$inferInsert, "id">;
