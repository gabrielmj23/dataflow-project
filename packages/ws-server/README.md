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

## Endpoints HTTP (Express)

- `GET /health` → estado básico del servicio.
- `GET /sessions` → lista de salas activas, con runner/controllers conectados.
- `GET /sessions/:sessionKey` → detalle de una sala activa específica.
- `GET /docs` → UI de Swagger/OpenAPI.
- `GET /docs-json` → especificación OpenAPI en JSON.

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
