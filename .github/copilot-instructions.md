# Copilot Instructions for Dataflow Project

- **Stack & entrypoints**: Vite + React/TypeScript app under `src/`; custom dataflow engine + graph UI. `pnpm dev` to run, `pnpm build` (runs `tsc -b && vite build`). WebSocket hub lives in `packages/ws-server` (run with `pnpm --filter @dataflow/ws-server dev`).
- **Node registry**: Visual node types are registered in `src/flow/node-types-core.ts`; palette items in `src/flow/node-palette.ts`. When adding a node, wire both so it appears in the sidebar and renders in the canvas.
- **UI shells**: Use existing shells instead of hand-drawing handles. Examples:
  - Processing nodes: `ProcessingExecutionNode` → `ProcessingRectNodeShell` (blue, 1–3 inputs).
  - Control nodes: `ControlRectNodeShell` (orange, boolean shapes).
  - Iteration nodes: `IterationRectNodeShell` (teal, triple inputs).
  - Input circles: `InputCircleNodeShell` (green).
- **Handles & typing**: Port typing/compatibility is centralized in `src/flow/port-data-type.ts`; handle-to-port IDs in `src/engine/handle-mapping.ts`. For new handles, add masks (type inference + mask) and mapping entries so runtime wiring matches UI handles (`in-1`, `out`, etc.).
- **Engine side**: Runtime behavior lives in `src/engine/nodes/*` (classes extend `NodeDefinition`). Node compilers map React-flow nodes to engine nodes in `src/engine/node-compilers/*.ts` (see `processing.ts`, `logic.ts`). Always add a compiler case and use `FirePatterns` to declare required inputs.
- **Edge labels**: Text shown on connections is derived in `src/flow/labeled-edge.tsx` (e.g., Switch outputs, Sequence inputs). Add a label helper there for new per-handle labels when needed.
- **Program serialization/typing**: Port masks are used both for UI coloring (`maskToVisualPortDataType`) and connection validation (`isTypeCompatible`). Ensure masks align with engine expectations.
- **Remote execution hooks**: Some processing nodes support controller/micro:bit execution. `ProcessingExecutionNode` passes execution config; `compileProcessingNodes` branches on `executionTarget`. Add remote stubs only if the node supports offloading.
- **Icons & palette previews**: Palette card previews live in `src/components/app-sidebar.tsx` (mapped per node type). Add icons there so new nodes render nicely in the sidebar.
- **Micro:bit**: Connector logic under `src/microbit/*`, with protocol helpers and slot manager. WebSocket bridge/hooks live in `src/ws` and `src/hooks/useWs*`.
- **Common components**: Base canvas pieces live in `src/components/flow` (handles, edge rendering), and layout/UX in `src/components/app-sidebar.tsx`, `src/components/ConsolePanel.tsx`, etc.
- **Lint/tests**: No custom test harness noted. Typechecks run via `pnpm build`. ESLint config at root `eslint.config.js`.
- **WS server**: Minimal message router; see `packages/ws-server/README.md` for protocol (hello → runner/controller, then snapshot/control messages). Environment vars: `WS_HOST`, `WS_PORT`, `WS_MAX_MESSAGE_BYTES`.

- **Routing / Pages**: The app uses `react-router-dom` and organizes top-level pages under `src/pages/`:
  - `ModeSelectPage` (`src/pages/ModeSelectPage.tsx`) – landing / mode selection (route `/`).
  - `ChallengesPage` (`src/pages/ChallengesPage.tsx`) – challenge browser (route `/challenges`).
  - `EditorPage` (`src/pages/EditorPage.tsx`) – the main editor view (routes `/editor` and `/editor/:challengeId`).
  - The router shell is `src/App.tsx`, which mounts `BrowserRouter` and the `Routes`.

  When adding new full-screen views, place them under `src/pages/` and keep smaller components in `src/components/`.

When implementing a new node:
1) Add UI component using the appropriate shell; register in `node-types-core.ts` and `node-palette.ts` with icon entry in `app-sidebar.tsx`.
2) Define engine class in `src/engine/nodes/*` and compiler case in the relevant `node-compilers/*.ts` file.
3) Update port typing (`port-data-type.ts`), handle mapping (`handle-mapping.ts`), and edge labels (`labeled-edge.tsx`) if inputs need labels.

If anything here seems incomplete or unclear, ask for the missing detail before proceeding.
