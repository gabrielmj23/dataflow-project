# Reutilización de lógica de nodos en editores

## Objetivo

Centralizar la lógica común de **qué nodo se dibuja** al hacer drag/drop dentro de los distintos editores del proyecto (canvas principal y editores embebidos como Subflow, Nested Subflow, Map, Filter y Replicate Flow).

## Punto único de reutilización

Archivo: `src/flow/editor-node-factory.ts`

Este módulo contiene utilidades compartidas para:

- `editorPaletteLabelByType`: lookup único `type -> label` de la paleta.
- `projectClientToFlowPosition(...)`: conversión estándar de coordenadas de pantalla a coordenadas del canvas.
- `buildDroppedNodeData(...)`: construcción unificada de `data` para nodos soltados, incluyendo resolución de plantillas de subflujo (`templateId`).
- `normalizeNodeTypeForEditor(...)`: normalización del tipo al render en editores embebidos para evitar fallbacks inconsistentes por mayúsculas/minúsculas.

## Archivos que consumen esta lógica

- `src/hooks/usePaletteDrag.ts` (editor principal)
- `src/components/nodes/abstraction/subflow-node.tsx`
- `src/components/nodes/abstraction/nested-subflow-node.tsx`
- `src/components/nodes/iteration/map-node.tsx`
- `src/components/nodes/iteration/filter-node.tsx`
- `src/components/nodes/distribution/replicate-flow-node.tsx`

## Cómo extender

Si agregas un nuevo editor interno:

1. Importa `projectClientToFlowPosition` y `buildDroppedNodeData`.
2. En el `onDrop`, toma `type` (`application/reactflow`) y `templateId` (`application/subflow-template-id`).
3. Usa `buildDroppedNodeData` para crear el `data` del nodo.
4. Si tu editor renderiza nodos de fuentes mixtas, usa `normalizeNodeTypeForEditor` al pasar `nodes` a `ReactFlow`.

Si agregas nuevos campos comunes para nodos soltados, hazlo en `buildDroppedNodeData(...)` y quedará disponible para todos los editores sin duplicar cambios.
