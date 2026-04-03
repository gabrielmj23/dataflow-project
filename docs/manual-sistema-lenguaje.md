# Manual de Sistema del Lenguaje Dataflow

## 1. Proposito y alcance

Este documento describe, a nivel tecnico, como funciona el lenguaje visual Dataflow implementado en este repositorio. Cubre:

- Modelo de programa (nodos, puertos, aristas, tokens).
- Proceso de compilacion (grafo visual -> grafo ejecutable).
- Semantica de ejecucion del motor.
- Tipado y validacion de conexiones.
- Semantica de nodos especiales (control, listas, runtime input, subflujos).
- Ejecucion distribuida (controller remoto y micro:bit).
- Reglas de serializacion y portabilidad.
- Contrato de extensibilidad para nuevos nodos.

El manual refleja el comportamiento actual del codigo.

## 2. Arquitectura del lenguaje

El sistema se organiza en capas:

1. Editor visual (React Flow / XYFlow): representa nodos y edges con handles UI.
2. Capa de validacion visual: comprueba compatibilidad de tipos y reglas estructurales.
3. Capa de compilacion: traduce nodos UI a NodeDefinition y edges UI a Arc.
4. Motor Dataflow: ejecuta nodos por disponibilidad de tokens.
5. Backends de ejecucion opcionales: local, controller remoto por WS, micro:bit.

Archivos clave:

- src/flow/serialization.ts
- src/flow/connection-validation.ts
- src/flow/port-data-type.ts
- src/engine/deserialize-program.ts
- src/engine/node-compilers/*
- src/engine/engine.ts
- src/engine/program-elements.ts

## 3. Modelo formal de programa

### 3.1 Entidades

- NodeDefinition: define activacion, patrones de disparo, puertos y metadatos.
- Node: instancia runtime de NodeDefinition con id.
- PortAddress: par (nodeId, portId).
- DataToken: valor + PortAddress actual.
- Arc: conexion dirigida de un PortAddress origen a uno destino.

### 3.2 Patrones de disparo (FirePatterns)

- EXISTS: requiere token en ese puerto para habilitar ejecucion.
- EMPTY: requiere ausencia de token en ese puerto.
- DONT_CARE: no bloquea ejecucion, no consume token.
- ALWAYS: no bloquea ejecucion, no consume token.

Nota operacional importante:

- En el motor, EXISTS consume estrictamente el token mas antiguo de ese puerto (FIFO).
- No existe fallback de reutilizacion automatica de ultimo valor en ausencia de token nuevo.

### 3.3 Convencion de puertos

- Inputs: son los primeros firePatterns.length puertos de NodeDefinition.ports.
- Outputs: el resto de puertos.
- Excepcion de fuentes: nodos modelados como [ALWAYS] y puertos ["output"] se tratan como nodos sin entradas efectivas.

## 4. Pipeline de compilacion

Pipeline principal en src/engine/deserialize-program.ts:

1. Filtrado de nodos solo UI
   - Se excluyen nodos de comentario.

2. Inferencia de estructura dinamica
   - Se infiere cantidad de puertos para nodos dinamicos (write, scatter, gather, barrier, selector, conditional, sequence).

3. Compilacion de nodos
   - NodeDefinitionCompilerBuilder delega por categoria:
     - inputs.ts
     - processing.ts
     - logic.ts
     - list.ts
     - output.ts
     - replicate-flow.ts
     - subflow.ts

4. Mapeo de handles UI a portId de engine
   - mapHandleToPortId en src/engine/handle-mapping.ts.

5. Construccion de arcos ejecutables
   - Cada edge visual se transforma en Arc(sourcePort, targetPort).

6. Deteccion de ciclos
   - DFS sobre el grafo compilado.
   - Si hay ciclo, se lanza CycleDetectedCompileError con nodos y nombres.

### 4.1 Invariantes de compilacion

- source y target del edge deben referir nodos existentes.
- node type debe estar soportado por algun compilador.
- handles deben mapearse a puertos validos.
- conexiones invalidas por tipo son filtradas desde la deserializacion UI.

## 5. Sistema de tipos y validacion de conexiones

### 5.1 Tipado por mascara

Tipos base:

- number
- text
- boolean
- list
- any

Implementacion en src/flow/port-data-type.ts usa mascaras bit a bit.

Compatibilidad:

- isTypeCompatible(source, target) => (sourceMask & targetMask) !== 0.

### 5.2 Reglas estructurales adicionales

En src/flow/connection-validation.ts:

- No se permite auto-conexion de un nodo consigo mismo.
- Conexion Condicional -> ConditionalSelector (token) es fija.
- El par conditional/selector debe compartir pairId.

### 5.3 Alcance del tipado

- El tipado de mascaras actua como validacion de conexion en editor y carga.
- El runtime sigue siendo dinamico (JS/TS), por lo que puede haber errores de dominio (ej: dividir por cero, lista vacia, etc.) dentro de la activacion de un nodo.

## 6. Semantica del motor de ejecucion

Motor en src/engine/engine.ts.

### 6.1 Almacenamiento y consumo de tokens

- TokenStore mantiene todos los DataToken pendientes.
- Para EXISTS, collectTokensForNode consume un token por puerto requerido (el mas antiguo).
- DONT_CARE/ALWAYS/EMPTY no consumen tokens.

### 6.2 Scheduler por lotes paralelos

- El motor intenta armar batches de nodos ejecutables sin conflicto de consumo.
- Dos nodos no se ejecutan en el mismo batch si compiten por el mismo token reservado.
- maxSteps limita ejecuciones (default 10000).

### 6.3 Runtime input bajo demanda

El scheduler calcula runtime inputs demandados:

- Primero agenda nodos no runtime input.
- Solo si no hay progreso, agenda un runtime input demandado.
- Evita pedir prompts cuando todavia hay trabajo ejecutable sin prompt.

### 6.4 Ejecucion de una unidad

executeUnit:

1. Marca estado running.
2. Ordena args segun puertos declarados.
3. Aplica delay global opcional (excepto nodos con skipStepDelay o runtime inputs).
4. Ejecuta activationFunction.
5. Normaliza salida:
   - DataToken
   - DataToken[]
   - valor unico
   - arreglo de valores
   - AsyncIterable (stream)
6. Marca estado done o error.

### 6.5 Error handling

- Error en un nodo no aborta todo el programa.
- Ese nodo produce 0 tokens de salida y el resto del grafo continua.
- AbortError si se propaga para detener corrida completa por cancelacion.

### 6.6 Propagacion por arcos

- Cada token de salida se transmite por todos los arcs salientes.
- Destinos internos: se encolan en TokenStore.
- Destinos externos (nodeId inexistente o vacio): se devuelven como externalOutputs.

## 7. Semantica de lenguaje por construccion

## 7.1 Fuentes (sources)

- Constantes, random, choice: FirePatterns.ALWAYS.
- Se consideran nodos sin entrada efectiva.
- Emiten en cada oportunidad de scheduling, con control anti-repeticion por batch para activaciones sin consumo.

## 7.2 Runtime input

Nodos:

- runtimeInput: prompt unico.
- runtimeInputPulse: prompt repetido, con frecuencia y cantidad desde entradas.

Comportamiento:

- Si no hay observer.onPrompt y existe defaultValue, usa default.
- Si no hay observer.onPrompt y no hay default, error.

## 7.3 Timer

Timer (src/engine/nodes/event-nodes.ts) tiene dos modos:

- source: sin entrada requerida (DONT_CARE), emite valor por defecto tras retardo.
- delay: requiere entrada (EXISTS), reemite valor entrante tras retardo.

Caracteristicas:

- skipStepDelay=true
- allowParallelTokenExecutions=false
- En modo delay, los tokens se procesan en orden de cola por puerto.

## 7.4 Sequence y PulseSequence

- sequence: devuelve lista numerica.
- pulseSequence: devuelve DataToken[] (un pulso por elemento).
- Si ciertos puertos no estan conectados, pueden quedar DONT_CARE y usar defaults.
- Valida paso != 0 y coherencia de direccion segun inicio/fin.

## 7.5 Switch

- Evalua condiciones en orden.
- Emite por la primera salida coincidente.
- Si ninguna condicion coincide, descarta token (sin salida).

## 7.6 Conditional, Selector y ConditionalSelector

conditional:

- Evalua formulas con scope numerico.
- Emite token (string) de salida seleccionada por puerto output.

selector:

- Recibe condition, trueValue, falseValue.
- Puede exigir solo las ramas conectadas (EXISTS/DONT_CARE segun cableado).

conditionalSelector:

- Recibe token + N entradas.
- Enruta al outputN correspondiente.
- Mantiene compatibilidad legacy emitiendo tambien por puertos token-named cuando aplica.

Regla de estructura:

- Conexion conditional.out -> conditionalSelector.token bloqueada y validada por pairId.

## 7.7 Desvio y Relevo

- desvio: enruta value a output1/output2 segun condition.
- relevo: consume value y relay, emite relay.

## 7.8 Scatter, Gather y Barrier

- scatter: divide lista en chunks equilibrados hacia output1..outputN.
- gather: concatena entradas (si alguna entrada es lista, aplana un nivel).
- barrier: sincroniza N entradas y emite N salidas posicionadas.

## 7.9 Write

- Nodo sink sin salidas.
- Soporta plantilla con placeholders {1}, {2}, ...
- Inputs no conectados pueden quedar en DONT_CARE.

## 8. Subflujos

Compilacion y ejecucion en src/engine/deserialize-program.ts y src/engine/node-compilers/subflow.ts.

### 8.1 Seleccion de entradas y salidas expuestas

El plan de ejecucion del subflujo se calcula con:

- Puertos explicitos via subflowInput/subflowOutput (preferidos).
- Fallback a puertos abiertos inferidos (sin arco entrante/saliente).
- inCount/outCount recortan exposicion cuando estan definidos.

### 8.2 Ejecucion

- Se crea engine anidado con stepDelayMs=0.
- Inputs externos se inyectan a selectedInputs.
- Salidas internas seleccionadas se enrutan a puerto externo out-1.
- Si no hay salida expuesta, retorna lista vacia.

### 8.3 Recursion y profundidad

- Soporta recursion por templateId (resolucion diferida).
- Se controla profundidad con maxDepth (default 1000 en runtime context).
- Si depth supera maxDepth, error.

### 8.4 Materializacion para remoto

Para controller remoto, se materializan subflujos anidados para no depender del registry del runner.

## 9. ReplicateFlow

Implementado en src/engine/node-compilers/replicate-flow.ts.

Semantica:

- Replica un mismo subflujo sobre multiples destinos de remoteConnections.
- Destinos posibles por replica: local, controller, microbit.
- Si no hay remoteConnections, crea una replica local por defecto.
- Si el subflujo requiere entradas, usa un input por replica (input1..inputR).
- Produce una salida por replica (output1..outputR).
- Argumentos por replica se clonan (structuredClone/JSON fallback).

## 10. Ejecucion distribuida

## 10.1 Controller remoto (WS)

Puntos clave:

- Runner envia exec_request con requestId, controllerId, op, args y subflow opcional.
- Controller responde exec_result ok/error.
- Timeout por request: 15s.
- Retry automatico: 1 intento adicional, espera 400ms, solo en errores WS transitorios.

Ver:

- docs/pc-remote-execution-protocol.md
- src/hooks/useWsRunnerBridge.ts
- src/hooks/useWsControllerClient.ts

## 10.2 Micro:bit

Puntos clave:

- Compiladores de processing/list/logic/subflow pueden offload a micro:bit.
- Se crea subgrafo remoto y se envia con sendSubflowToMicrobit.
- Soporta transporte serial/bluetooth y slot.

Ver:

- docs/microbit-subflow-protocol.md
- src/microbit/*

## 11. Serializacion y portabilidad

Formato serializado versionado (v1):

- version
- programName
- nodes
- edges
- viewport

Implementacion:

- src/flow/serialization.ts

Portabilidad al descargar:

- useProgramIO sanitiza campos remotos para exportar programas portables:
  - executionTarget
  - controllerId
  - transport
  - connectionType
  - microbitSlot

## 12. Observabilidad y trazas

El engine expone callbacks de observacion:

- onRunStart / onRunEnd
- onNodeStatus
- onLog
- onPrompt
- onEdgeValue
- onNodeExecution

Esto alimenta:

- Consola local.
- Consola remota por controller.
- Visualizacion de valores en edges.

## 13. Contrato de extensibilidad del lenguaje

Para agregar un nodo nuevo de forma completa:

1. Registrar type en src/common/constants.ts.
2. Implementar componente visual y registrarlo en src/flow/node-types-core.ts.
3. Agregar item en src/flow/node-palette.ts.
4. Definir semantica de puertos en src/engine/handle-mapping.ts.
5. Definir tipado de puertos en src/flow/port-data-type.ts.
6. Implementar NodeDefinition o clase en src/engine/nodes/*.
7. Agregar caso en compilador correspondiente en src/engine/node-compilers/*.
8. Si aplica, actualizar etiquetado de edges en src/flow/labeled-edge.tsx.
9. Si aplica, soportar destinos remotos (controller/micro:bit) con op/subflow.

## 14. Comportamientos que suelen ser contraintuitivos

1. stickyInputPorts esta presente en metadata de varios nodos, pero el scheduler core consume tokens de EXISTS de forma estricta y no hace fallback automatico por sticky.
2. Un error en un nodo no detiene la corrida global: corta ese flujo puntual.
3. Subflow expone una sola salida externa efectiva (output1/out-1), aunque internamente pueda tener multiples fuentes de salida.
4. Switch no tiene salida default: si no coincide ninguna condicion, el token se pierde.
5. La deteccion de ciclos en compilacion impide ejecutar grafos ciclicos directos.

## 15. Referencias primarias

- docs/catalogo-nodos.md
- docs/proceso-compilacion-evaluacion.md
- docs/editor-node-factory.md
- docs/pc-remote-execution-protocol.md
- docs/microbit-subflow-protocol.md
- docs/ws-orchestrator-architecture.mermaid
- src/engine/deserialize-program.ts
- src/engine/engine.ts
- src/engine/program-elements.ts
- src/flow/port-data-type.ts
- src/flow/connection-validation.ts
- src/engine/node-compilers/*