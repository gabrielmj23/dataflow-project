import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "../users/users.model";
import { relations } from "drizzle-orm";
import { extensionsToNodes } from "../extensions-nodes/extensions-nodes.model";

export const extensionsTable = pgTable("extensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  author: uuid("author")
    .notNull()
    .references(() => usersTable.id),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const extensionsRelations = relations(extensionsTable, ({ many }) => ({
  extensionsToNodes: many(extensionsToNodes),
}));
