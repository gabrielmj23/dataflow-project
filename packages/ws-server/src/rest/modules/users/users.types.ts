import { usersTable } from "./users.model";

export type User = typeof usersTable.$inferSelect;

export type UserSelect = Omit<typeof usersTable.$inferSelect, "password">;

export type UserInsert = Omit<typeof usersTable.$inferInsert, "id">;
