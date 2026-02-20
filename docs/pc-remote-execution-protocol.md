# Protocolo de ejecución remota PC↔PC (WS v1)

Este documento describe el flujo completo de ejecución remota entre PCs en Dataflow usando el hub WebSocket (`packages/ws-server`).

Objetivo: permitir que un **runner** ejecute el grafo principal y delegue nodos concretos a uno o más **controllers** remotos, con trazabilidad por máquina en consola remota.

## 1) Roles

- **Runner**: instancia que ejecuta el programa principal (engine local) y delega nodos remotos.
- **Controller**: instancia remota que recibe operaciones (`exec_request`) y responde resultados (`exec_result`).
- **Hub WS**: servidor que enruta mensajes por `sessionKey`.

## 2) Handshake y sesión

Primer mensaje obligatorio para cualquier cliente:

```json
{
  "type": "hello",
  "role": "runner|controller",
  "protocol": 1,
  "sessionKey": "DEV",
  "clientName": "gabriel"
}
```

Respuesta típica:

```json
{
  "type": "welcome",
  "clientId": "uuid",
  "role": "controller",
  "sessionKey": "DEV",
  "runnerConnected": true
}
```

Notas:

- `sessionKey` aísla salas lógicas.
- Puede existir **1 runner** por sesión.
- Puede haber múltiples controllers por sesión.

## 3) Flujo de control (runner)

Mensajes controller → runner (enrutados por hub):

- `control` (`run` / `stop`)
- `get_snapshot`
- `prompt_reply`

Mensajes runner → controller:

- `control_ack`
- `snapshot`
- `run_start` / `run_end`
- `node_status`
- `prompt`

## 4) Flujo de ejecución remota de nodos

Cuando un nodo está configurado con `executionTarget === "controller"`, el runner invoca:

```json
{
  "type": "exec_request",
  "requestId": "exec_123",
  "controllerId": "<clientId-controller>",
  "nodeId": "node-abc",
  "op": "multiply",
  "args": [3, 2]
}
```

El controller ejecuta `op(args)` y responde:

```json
{
  "type": "exec_result",
  "requestId": "exec_123",
  "ok": true,
  "result": 6
}
```

En error:

```json
{
  "type": "exec_result",
  "requestId": "exec_123",
  "ok": false,
  "error": "texto de error"
}
```

## 5) Operaciones remotas soportadas

Operaciones de procesamiento:

- `sum`, `subtract`, `multiply`, `divide`, `mod`, `power`
- `floor`, `ceiling`, `round`
- `concat`

Operaciones de listas:

- `generateSequence`, `pulseSequence`
- `zip`, `unzip`
- `filterTruthy`, `mapIdentity`
- `reduceSum`, `count`
- `scatter`, `gather`
- `sortListAsc`, `sortListDesc`

Subflujos:

- `subflow` (incluye payload serializado del subgrafo remoto)

## 6) Retry automático corto (runner)

Para mejorar tolerancia a microcortes/reconexiones WS, `executeRemote` aplica:

- **1 reintento automático** por request.
- Espera corta de **400ms** antes de reintentar.
- Solo para errores transitorios:
  - `Conexión WS cerrada`
  - `WS no conectado`
  - `WS no inicializado`
  - `Timeout esperando respuesta del controller`

Si el segundo intento falla, se propaga error al engine.

## 7) Consola remota verbose

El runner emite trazas `node_execution` por controller:

```text
Nodo1: Multiplicar(3, 2) -> 6
```

Características:

- Contador `NodoN` separado por `controllerId`.
- Solo incluye nodos realmente ejecutados en ese controller.
- Snapshot remoto incluye `controllerId` para evitar mezclar trazas entre PCs.

## 8) Consideraciones de portabilidad

Al descargar programa (`Download`), se sanitizan campos remotos para exportar portable/local:

- `executionTarget`
- `controllerId`
- `transport`
- `connectionType`
- `microbitSlot`

Esto evita que otro usuario quede bloqueado por configuraciones de hardware/PC que no tiene.

## 9) Recomendaciones operativas

- Usar `sessionKey` compartida solo entre instancias que deben colaborar.
- Asignar nombre de cliente (`clientName`) para identificar controllers.
- Si se observa latencia alta, priorizar menos nodos remotos por corrida.
- Mantener WS server estable (`pnpm --filter @dataflow/ws-server dev`) antes de ejecutar.
