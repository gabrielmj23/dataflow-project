import { and, desc, eq, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "../../db";
import { usersTable } from "../users/users.model";
import { projectsTable } from "./projects.model";
import {
  ProjectCreate,
  ProjectGet,
  ProjectListItem,
  ProjectSearchParams,
  ProjectUpdate,
} from "./projects.types";
import type { ProjectViewerIdentity } from "./project-identity";

const remixedProjectsTable = alias(projectsTable, "remixed_projects");

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  authorId: string | null;
  registeredAuthorName: string | null;
  guestOwnerId: string | null;
  guestAuthorName: string | null;
  remixedFromId: string | null;
  remixedFromName: string | null;
  isPublic: boolean;
  thumbnail: string | null;
  program: ProjectGet["program"];
};

function mapProjectRow(
  row: ProjectRow,
  viewer: ProjectViewerIdentity = { kind: "anonymous" },
): ProjectListItem {
  const authorKind = row.authorId ? "user" : "guest";
  const authorName =
    row.registeredAuthorName ?? row.guestAuthorName ?? "Autor desconocido";
  const viewerCanEdit =
    viewer.kind === "user"
      ? row.authorId === viewer.user.id
      : viewer.kind === "guest"
        ? row.guestOwnerId === viewer.guestOwnerId
        : false;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    authorId: row.authorId,
    authorKind,
    authorName,
    remixedFromId: row.remixedFromId,
    remixedFromName: row.remixedFromName,
    isPublic: row.isPublic,
    thumbnail: row.thumbnail,
    viewerCanEdit,
  };
}

function buildProjectBaseQuery() {
  return db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      description: projectsTable.description,
      authorId: usersTable.id,
      registeredAuthorName: usersTable.name,
      guestOwnerId: projectsTable.guestOwnerId,
      guestAuthorName: projectsTable.guestAuthorName,
      remixedFromId: projectsTable.remixedFrom,
      remixedFromName: remixedProjectsTable.name,
      isPublic: projectsTable.isPublic,
      thumbnail: projectsTable.thumbnail,
      program: projectsTable.program,
    })
    .from(projectsTable)
    .leftJoin(usersTable, eq(projectsTable.author, usersTable.id))
    .leftJoin(
      remixedProjectsTable,
      eq(projectsTable.remixedFrom, remixedProjectsTable.id),
    );
}

async function findProjectRowById(id: string): Promise<ProjectRow> {
  const project = await buildProjectBaseQuery()
    .where(eq(projectsTable.id, id))
    .limit(1);

  if (!project.length) {
    throw new Error("Proyecto no encontrado");
  }

  return project[0];
}

function isProjectOwnedByViewer(
  project: ProjectRow,
  viewer: ProjectViewerIdentity,
) {
  if (viewer.kind === "user") {
    return project.authorId === viewer.user.id;
  }

  if (viewer.kind === "guest") {
    return project.guestOwnerId === viewer.guestOwnerId;
  }

  return false;
}

export async function findProjectById(
  id: string,
  viewer: ProjectViewerIdentity = { kind: "anonymous" },
): Promise<ProjectGet> {
  const project = await findProjectRowById(id);
  if (!project.isPublic && !isProjectOwnedByViewer(project, viewer)) {
    throw new Error("Proyecto no encontrado");
  }
  return {
    ...mapProjectRow(project, viewer),
    program: project.program,
  };
}

export async function findProjects(
  searchData: ProjectSearchParams,
  viewer: ProjectViewerIdentity = { kind: "anonymous" },
): Promise<ProjectListItem[]> {
  const {
    name,
    authorId,
    remixedFromId,
    mine,
    page = 1,
    pageSize = 10,
  } = searchData;
  const offset = (page - 1) * pageSize;

  const projects = await buildProjectBaseQuery()
    .where(
      and(
        name ? ilike(projectsTable.name, `%${name}%`) : undefined,
        authorId ? eq(projectsTable.author, authorId) : undefined,
        remixedFromId
          ? eq(projectsTable.remixedFrom, remixedFromId)
          : undefined,
        mine
          ? viewer.kind === "user"
            ? eq(projectsTable.author, viewer.user.id)
            : viewer.kind === "guest"
              ? eq(projectsTable.guestOwnerId, viewer.guestOwnerId)
              : eq(projectsTable.id, "00000000-0000-0000-0000-000000000000") // Impossible match
          : eq(projectsTable.isPublic, true),
      ),
    )
    .orderBy(desc(projectsTable.updatedAt))
    .limit(pageSize)
    .offset(offset);
  return projects.map((project) => mapProjectRow(project, viewer));
}

export async function createProject(
  data: ProjectCreate,
  viewer: ProjectViewerIdentity,
) {
  const [project] = await db.insert(projectsTable).values(data).returning({
    id: projectsTable.id,
  });
  return findProjectById(project.id, viewer);
}

export async function updateProject(
  id: string,
  data: ProjectUpdate,
  viewer: ProjectViewerIdentity,
) {
  const existingProject = await findProjectRowById(id);
  if (!isProjectOwnedByViewer(existingProject, viewer)) {
    throw new Error("Acceso denegado");
  }

  await db
    .update(projectsTable)
    .set(data)
    .where(eq(projectsTable.id, id))
    .returning({ id: projectsTable.id });

  return findProjectById(id, viewer);
}

export async function deleteProject(id: string, viewer: ProjectViewerIdentity) {
  const project = await findProjectRowById(id);
  if (!isProjectOwnedByViewer(project, viewer)) {
    throw new Error("Acceso denegado");
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
}
