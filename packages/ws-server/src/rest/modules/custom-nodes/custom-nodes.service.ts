import { desc, eq, ilike, or } from "drizzle-orm";
import db from "../../db";
import { usersTable } from "../users/users.model";
import { customNodesTable } from "./custom-nodes.model";
import {
  CustomNodeCreate,
  CustomNodeGet,
  CustomNodesSearchParams,
} from "./custom-nodes.types";

export async function findCustomNodes(
  searchData: CustomNodesSearchParams,
): Promise<CustomNodeGet[]> {
  const { search, page = 1, pageSize = 20 } = searchData;
  const offset = (page - 1) * pageSize;

  const customNodes = await db
    .select({
      id: customNodesTable.id,
      name: customNodesTable.name,
      description: customNodesTable.description,
      code: customNodesTable.code,
      authorId: usersTable.id,
      authorName: usersTable.name,
      createdAt: customNodesTable.createdAt,
    })
    .from(customNodesTable)
    .innerJoin(usersTable, eq(customNodesTable.author, usersTable.id))
    .where(
      or(
        search ? ilike(customNodesTable.name, `%${search}%`) : undefined,
        search ? ilike(customNodesTable.description, `%${search}%`) : undefined,
      ),
    )
    .orderBy(desc(customNodesTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  return customNodes;
}

export async function createCustomNode(data: CustomNodeCreate) {
  const [customNode] = await db
    .insert(customNodesTable)
    .values(data)
    .returning({
      id: customNodesTable.id,
      name: customNodesTable.name,
      description: customNodesTable.description,
      code: customNodesTable.code,
    });
  return customNode;
}
