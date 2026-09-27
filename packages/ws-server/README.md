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

- `STORAGE_PROVIDER` (`azure` o `s3`; default: `azure`)

Con `STORAGE_PROVIDER=azure`:

- `STORAGE_URL` (connection string de Azure Blob Storage; requerida)
- `AZURE_STORAGE_CONTAINER` (default: `project-thumbnails`; se crea con acceso público de lectura si no existe)

Con `STORAGE_PROVIDER=s3` (AWS S3 o cualquier API compatible, como MinIO o Cloudflare R2):

- `S3_BUCKET` (requerida; el bucket debe existir y permitir lectura pública de los objetos)
- `S3_REGION` (default: `us-east-1`; en R2 usar `auto`)
- `S3_ENDPOINT` (URL del servicio compatible; omitir para AWS)
- `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY` (si faltan, el SDK usa `AWS_ACCESS_KEY_ID`, perfiles o roles)
- `S3_PUBLIC_URL` (base de las URLs que se guardan en BD, p. ej. el dominio público de R2 o un CDN; default: `S3_ENDPOINT/S3_BUCKET` o la URL de AWS)
- `S3_FORCE_PATH_STYLE` (`true`/`false`; default: `true` si hay `S3_ENDPOINT`)

Actualizar esquema de base de datos (incluye tabla `refresh_tokens` para sesiones):

- `pnpm --filter @dataflow/ws-server db:push`

Migración de miniaturas base64 existentes al almacenamiento configurado:

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
