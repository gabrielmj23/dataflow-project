import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "../users/users.model";

export const customNodesTable = pgTable("custom_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  code: text("code").notNull(),
  author: uuid("author")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
