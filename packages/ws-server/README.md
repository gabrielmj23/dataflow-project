# @dataflow/ws-server

Servidor de **Express + WebSocket** para coordinación **hub (runner)** + **clients (controllers)**.

## Uso

Instalar deps en el root:

- `pnpm install`

Correr el server en modo dev:

- `pnpm --filter @dataflow/ws-server dev`

Variables de entorno (opcionales):

- `WS_HOST` (default: `0.0.0.0`)
- `WS_PORT` (default: `8787`)
- `WS_MAX_MESSAGE_BYTES` (default: `1000000`)
- `WS_MAX_JSON_BODY_BYTES` (default: `8000000`)
- `REST_ALLOWED_ORIGIN` (si se define, limita CORS al origen indicado y habilita credenciales para cookies)
- `JWT_ACCESS_EXPIRES` (default: `15m`)
- `JWT_REFRESH_EXPIRES_DAYS` (default: `30`)
- `JWT_REFRESH_SECRET` (fallback a `JWT_SECRET` si no se define)

Variables de entorno para miniaturas de proyectos:

- `STORAGE_URL` (connection string de Azure Blob Storage; requerida para subida de miniaturas)
- `AZURE_STORAGE_CONTAINER` (default: `project-thumbnails`)

Actualizar esquema de base de datos (incluye tabla `refresh_tokens` para sesiones):

- `pnpm --filter @dataflow/ws-server db:push`

Migración de miniaturas base64 existentes a Azure:

- `pnpm --filter @dataflow/ws-server migrate:project-thumbnails:dry` (simulación sin actualizar BD)
- `pnpm --filter @dataflow/ws-server migrate:project-thumbnails` (ejecución real)
- `pnpm --filter @dataflow/ws-server migrate:project-thumbnails -- --limit=50` (procesa en lotes)

## Endpoints HTTP (Express)

- `GET /health` → estado básico del servicio.
- `GET /sessions` → lista de salas activas, con runner/controllers conectados.
- `GET /sessions/:sessionKey` → detalle de una sala activa específica.
- `GET /docs` → UI de Swagger/OpenAPI.
- `GET /docs-json` → especificación OpenAPI en JSON.
- `POST /auth/refresh` → renueva access token usando cookie HttpOnly de refresh token.
- `POST /auth/log-out` → revoca refresh token actual y limpia cookie de sesión.
- `POST /projects/thumbnail-upload` → recibe `multipart/form-data` con el campo `thumbnail` y retorna `{ "url": "https://..." }`.

## Protocolo (v1)

Primer mensaje (obligatorio):

```json
{
  "type": "hello",
  "role": "runner|controller",
  "protocol": 1,
  "sessionKey": "ABC123"
}
```

Luego:

- Controllers → runner: `control`, `get_snapshot`, `prompt_reply`
- Runner → controllers: `snapshot`, `engine_log`, `node_status`, `run_start`, `run_end`, `prompt`, `control_ack`

Este servidor **no ejecuta el engine**: solo enruta mensajes por `sessionKey` y expone endpoints HTTP de observabilidad.

## Documentación relacionada

- Protocolo remoto PC↔PC: [docs/pc-remote-execution-protocol.md](../../docs/pc-remote-execution-protocol.md)
- Protocolo micro:bit subflow: [docs/microbit-subflow-protocol.md](../../docs/microbit-subflow-protocol.md)
