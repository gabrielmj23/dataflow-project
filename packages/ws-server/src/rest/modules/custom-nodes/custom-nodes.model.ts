import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "../users/users.model";
import { relations } from "drizzle-orm";
import { extensionsToNodes } from "../extensions-nodes/extensions-nodes.model";

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

export const nodesRelations = relations(customNodesTable, ({ many }) => ({
  extensionsToNodes: many(extensionsToNodes),
}));
