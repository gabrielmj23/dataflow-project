import { customNodesTable } from "./custom-nodes.model";

export type CustomNodesSearchParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export type CustomNodeGet = {
  id: string;
  name: string;
  description: string;
  code: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
};

export type CustomNodeCreate = Omit<
  typeof customNodesTable.$inferInsert,
  "id" | "createdAt"
>;
