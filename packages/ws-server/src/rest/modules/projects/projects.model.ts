import {
  boolean,
  foreignKey,
  json,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "../users/users.model";

export const projectsTable = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    author: uuid("author").references(() => usersTable.id),
    guestOwnerId: text("guest_owner_id"),
    guestAuthorName: text("guest_author_name"),
    remixedFrom: uuid("remixed_from"),
    isPublic: boolean("is_public").notNull().default(true),
    thumbnail: text("thumbnail"),
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
