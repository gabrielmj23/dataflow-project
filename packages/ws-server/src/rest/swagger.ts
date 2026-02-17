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
