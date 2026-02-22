import { and, desc, eq, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "../../db.js";
import { usersTable } from "../users/users.model.js";
import { projectsTable } from "./projects.model.js";
import {
  ProjectCreate,
  ProjectGet,
  ProjectSearchParams,
  ProjectUpdate,
} from "./projects.types.js";
import { UserSelect } from "../users/users.types.js";

const remixedProjectsTable = alias(projectsTable, "remixed_projects");

export async function findProjectById(id: string): Promise<ProjectGet> {
  const project = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      authorId: usersTable.id,
      authorName: usersTable.name,
      remixedFromId: projectsTable.remixedFrom,
      remixedFromName: remixedProjectsTable.name,
      thumbnail: projectsTable.thumbnail,
      program: projectsTable.program,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .innerJoin(usersTable, eq(projectsTable.author, usersTable.id))
    .leftJoin(
      remixedProjectsTable,
      eq(projectsTable.remixedFrom, remixedProjectsTable.id),
    )
    .where(eq(projectsTable.id, id))
    .limit(1);

  if (!project.length) {
    throw new Error("Proyecto no encontrado");
  }

  return project[0];
}

export async function findProjects(
  searchData: ProjectSearchParams,
): Promise<ProjectGet[]> {
  const { name, authorId, remixedFromId, page = 1, pageSize = 10 } = searchData;
  const offset = (page - 1) * pageSize;

  const projects = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      authorId: usersTable.id,
      authorName: usersTable.name,
      remixedFromId: projectsTable.remixedFrom,
      remixedFromName: remixedProjectsTable.name,
      thumbnail: projectsTable.thumbnail,
      program: projectsTable.program,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .innerJoin(usersTable, eq(projectsTable.author, usersTable.id))
    .leftJoin(
      remixedProjectsTable,
      eq(projectsTable.remixedFrom, remixedProjectsTable.id),
    )
    .where(
      and(
        name ? ilike(projectsTable.name, `%${name}%`) : undefined,
        authorId ? eq(projectsTable.author, authorId) : undefined,
        remixedFromId
          ? eq(projectsTable.remixedFrom, remixedFromId)
          : undefined,
      ),
    )
    .orderBy(desc(projectsTable.updatedAt))
    .limit(pageSize)
    .offset(offset);
  return projects;
}

export async function createProject(data: ProjectCreate) {
  const [project] = await db.insert(projectsTable).values(data).returning({
    id: projectsTable.id,
    name: projectsTable.name,
    author: projectsTable.author,
    remixedFrom: projectsTable.remixedFrom,
    thumbnail: projectsTable.thumbnail,
    program: projectsTable.program,
    createdAt: projectsTable.createdAt,
    updatedAt: projectsTable.updatedAt,
  });
  return project;
}

export async function updateProject(id: string, data: ProjectUpdate) {
  const [project] = await db
    .update(projectsTable)
    .set(data)
    .where(eq(projectsTable.id, id))
    .returning({
      id: projectsTable.id,
      name: projectsTable.name,
      author: projectsTable.author,
      remixedFrom: projectsTable.remixedFrom,
      thumbnail: projectsTable.thumbnail,
      program: projectsTable.program,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    });
  return project;
}

export async function deleteProject(id: string, user: UserSelect) {
  const project = await findProjectById(id);
  if (project.authorId !== user.id) {
    throw new Error("Acceso denegado");
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
}
