import { desc, eq, ilike, or } from "drizzle-orm";
import db from "../../db";
import { usersTable } from "../users/users.model";
import { extensionsTable } from "./extensions.model";
import { extensionsToNodes } from "../extensions-nodes/extensions-nodes.model";
import { customNodesTable } from "../custom-nodes/custom-nodes.model";
import { ExtensionCreate, ExtensionsSearchParams } from "./extensions.types";

export async function createExtension(data: ExtensionCreate) {
  const [extension] = await db.insert(extensionsTable).values(data).returning({
    id: extensionsTable.id,
    name: extensionsTable.name,
    description: extensionsTable.description,
    color: extensionsTable.color,
    author: extensionsTable.author,
    createdAt: extensionsTable.createdAt,
  });

  return extension;
}

export async function addNodesToExtension(
  extensionId: string,
  nodeIds: string[],
) {
  if (!nodeIds || nodeIds.length === 0) return [];

  const values = nodeIds.map((nodeId) => ({
    extensionId: extensionId,
    nodeId: nodeId,
  }));

  const inserted = await db
    .insert(extensionsToNodes)
    .values(values)
    .returning();
  return inserted;
}

export async function getExtension(extensionId: string) {
  const [extension] = await db
    .select({
      id: extensionsTable.id,
      name: extensionsTable.name,
      description: extensionsTable.description,
      color: extensionsTable.color,
      authorId: usersTable.id,
      authorName: usersTable.name,
      createdAt: extensionsTable.createdAt,
    })
    .from(extensionsTable)
    .innerJoin(usersTable, eq(extensionsTable.author, usersTable.id))
    .where(eq(extensionsTable.id, extensionId));

  if (!extension) return null;

  const nodes = await db
    .select({
      id: customNodesTable.id,
      name: customNodesTable.name,
      description: customNodesTable.description,
      code: customNodesTable.code,
      authorId: usersTable.id,
      authorName: usersTable.name,
      createdAt: customNodesTable.createdAt,
    })
    .from(extensionsToNodes)
    .innerJoin(
      customNodesTable,
      eq(extensionsToNodes.nodeId, customNodesTable.id),
    )
    .innerJoin(usersTable, eq(customNodesTable.author, usersTable.id))
    .where(eq(extensionsToNodes.extensionId, extensionId))
    .orderBy(desc(customNodesTable.createdAt));

  return { ...extension, nodes };
}

export async function getExtensions(params: ExtensionsSearchParams) {
  const { search, page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;

  const extensions = await db
    .select({
      id: extensionsTable.id,
      name: extensionsTable.name,
      description: extensionsTable.description,
      color: extensionsTable.color,
      authorId: usersTable.id,
      authorName: usersTable.name,
      createdAt: extensionsTable.createdAt,
    })
    .from(extensionsTable)
    .innerJoin(usersTable, eq(extensionsTable.author, usersTable.id))
    .where(
      or(
        search ? ilike(extensionsTable.name, `%${search}%`) : undefined,
        search ? ilike(extensionsTable.description, `%${search}%`) : undefined,
      ),
    )
    .orderBy(desc(extensionsTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  return extensions;
}
