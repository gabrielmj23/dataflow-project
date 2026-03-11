import path from "node:path";
import process from "node:process";

import type { Express } from "express";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const openApiDefinition = {
  openapi: "3.0.3",
  info: {
    title: "Dataflow WS Server API",
    version: "1.0.0",
    description:
      "REST API para autenticación, usuarios y observabilidad de sesiones del servidor de ejecución remota.",
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
      ProjectSearchParams: {
        type: "object",
        properties: {
          name: { type: "string" },
          authorId: { type: "string" },
          remixedFromId: { type: "string" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
        },
      },
      ControllerSnapshot: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id"],
      },
      SessionSnapshot: {
        type: "object",
        properties: {
          sessionKey: { type: "string" },
          runnerConnected: { type: "boolean" },
          controllers: {
            type: "array",
            items: { $ref: "#/components/schemas/ControllerSnapshot" },
          },
        },
        required: ["sessionKey", "runnerConnected", "controllers"],
      },
      UserSelect: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
        },
        required: ["id", "name", "email"],
      },
      AuthResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/UserSelect" },
          token: { type: "string" },
        },
        required: ["user", "token"],
      },
      SignUpBody: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
        required: ["name", "email", "password"],
      },
      LogInBody: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
        required: ["email", "password"],
      },
      ProjectGet: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          authorId: { type: ["string", "null"] },
          authorKind: { type: "string", enum: ["user", "guest"] },
          authorName: { type: "string" },
          remixedFromId: { type: ["string", "null"] },
          remixedFromName: { type: ["string", "null"] },
          thumbnail: { type: ["string", "null"] },
          viewerCanEdit: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "name",
          "description",
          "authorId",
          "authorKind",
          "authorName",
          "remixedFromId",
          "remixedFromName",
          "thumbnail",
          "viewerCanEdit",
          "createdAt",
          "updatedAt",
        ],
      },
      ProjectCreate: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          remixedFrom: { type: "string" },
          thumbnail: { type: "string" },
          program: { type: "object" },
          guestAuthorName: { type: "string" },
        },
        required: ["name", "program"],
      },
      ProjectUpdate: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          thumbnail: { type: "string" },
          program: { type: "object" },
          guestAuthorName: { type: "string" },
        },
      },
      CustomNodeGet: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          code: { type: "string" },
          authorId: { type: "string" },
          authorName: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "name",
          "description",
          "code",
          "authorId",
          "authorName",
          "createdAt",
        ],
      },
      CustomNodeCreate: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          code: { type: "string" },
        },
        required: ["name", "description", "code"],
      },
      CustomNodeCreateResponse: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          code: { type: "string" },
        },
        required: ["id", "name", "description", "code"],
      },
      ExtensionNodeGet: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          code: { type: "string" },
          authorId: { type: "string" },
          authorName: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "name",
          "description",
          "code",
          "authorId",
          "authorName",
          "createdAt",
        ],
      },
      ExtensionListItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          color: { type: "string" },
          authorId: { type: "string" },
          authorName: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "name",
          "description",
          "color",
          "authorId",
          "authorName",
          "createdAt",
        ],
      },
      ExtensionGet: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          color: { type: "string" },
          authorId: { type: "string" },
          authorName: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          nodes: {
            type: "array",
            items: { $ref: "#/components/schemas/ExtensionNodeGet" },
          },
        },
        required: [
          "id",
          "name",
          "description",
          "color",
          "authorId",
          "authorName",
          "createdAt",
          "nodes",
        ],
      },
      ExtensionCreate: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          color: { type: "string" },
        },
        required: ["name", "description", "color"],
      },
    },
  },
} as const;

function getApiGlobs(): string[] {
  return [
    path.resolve(process.cwd(), "src/rest/**/*.ts"),
    path.resolve(process.cwd(), "dist/rest/**/*.js"),
  ];
}

export function buildOpenApiSpec() {
  return swaggerJSDoc({
    definition: openApiDefinition,
    apis: getApiGlobs(),
  });
}

export function setupSwagger(app: Express): void {
  const spec = buildOpenApiSpec();

  app.get("/docs-json", (_req, res) => {
    res.status(200).json(spec);
  });

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
}
