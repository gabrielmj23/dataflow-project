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
  "id" | "author" | "guestOwnerId" | "remixedFrom" | "createdAt" | "updatedAt"
>;

export type ProjectAuthorKind = "user" | "guest";

export type ProjectGet = Omit<
  typeof projectsTable.$inferSelect,
  "author" | "guestOwnerId" | "guestAuthorName" | "remixedFrom"
> & {
  authorId: string | null;
  authorKind: ProjectAuthorKind;
  authorName: string;
  remixedFromId: string | null;
  remixedFromName: string | null;
  viewerCanEdit: boolean;
};
