import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { extensionsTable } from "../extensions/extensions.model";
import { customNodesTable } from "../custom-nodes/custom-nodes.model";
import { relations } from "drizzle-orm";

export const extensionsToNodes = pgTable(
  "extensions_to_nodes",
  {
    extensionId: uuid("extension_id")
      .notNull()
      .references(() => extensionsTable.id),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => customNodesTable.id),
  },
  (t) => [primaryKey({ columns: [t.extensionId, t.nodeId] })],
);

export const extensionsToNodesRelations = relations(
  extensionsToNodes,
  ({ one }) => ({
    extension: one(extensionsTable, {
      fields: [extensionsToNodes.extensionId],
      references: [extensionsTable.id],
    }),
    node: one(customNodesTable, {
      fields: [extensionsToNodes.nodeId],
      references: [customNodesTable.id],
    }),
  }),
);
