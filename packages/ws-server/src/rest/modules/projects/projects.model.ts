import {
  foreignKey,
  json,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "../users/users.model.js";

export const projectsTable = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    author: uuid("author")
      .notNull()
      .references(() => usersTable.id),
    remixedFrom: uuid("remixed_from"),
    program: json("program").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    foreignKey({
      columns: [table.remixedFrom],
      foreignColumns: [table.id],
      name: "projects_remixed_from_fkey",
    }),
  ],
);
