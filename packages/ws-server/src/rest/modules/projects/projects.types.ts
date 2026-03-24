import { projectsTable } from "./projects.model";

export type ProjectSearchParams = {
  name?: string;
  authorId?: string;
  remixedFromId?: string;
  mine?: boolean;
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

export type ProjectListItem = Omit<
  typeof projectsTable.$inferSelect,
  | "author"
  | "guestOwnerId"
  | "guestAuthorName"
  | "remixedFrom"
  | "program"
  | "createdAt"
  | "updatedAt"
> & {
  authorId: string | null;
  authorKind: ProjectAuthorKind;
  authorName: string;
  remixedFromId: string | null;
  remixedFromName: string | null;
  viewerCanEdit: boolean;
};

export type ProjectGet = ProjectListItem & {
  program: (typeof projectsTable.$inferSelect)["program"];
};
