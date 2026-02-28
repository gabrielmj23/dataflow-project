import { projectsTable } from "./projects.model";

export type ProjectSearchParams = {
  name?: string;
  authorId?: string;
  remixedFromId?: string;
  page?: number;
  pageSize?: number;
};

export type ProjectCreate = Omit<
  typeof projectsTable.$inferInsert,
  "id" | "createdAt" | "updatedAt"
>;

export type ProjectUpdate = Omit<
  Partial<typeof projectsTable.$inferInsert>,
  "id" | "author" | "remixedFrom" | "createdAt" | "updatedAt"
>;

export type ProjectGet = Omit<
  typeof projectsTable.$inferSelect,
  "author" | "remixedFrom"
> & {
  authorId: string;
  authorName: string;
  remixedFromId: string | null;
  remixedFromName: string | null;
};
