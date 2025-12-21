import { useState, useCallback } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ControlButton,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PlusCircle } from "lucide-react";

const initialNodes = [
  { id: "n1", position: { x: 0, y: 0 }, data: { label: "Node 1" } },
  { id: "n2", position: { x: 0, y: 100 }, data: { label: "Node 2" } },
];
const initialEdges = [{ id: "n1-n2", source: "n1", target: "n2" }];

export default function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const onNodesChange = useCallback(
    (
      changes: NodeChange<{
        id: string;
        position: { x: number; y: number };
        data: { label: string };
      }>[]
    ) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<{ id: string; source: string; target: string }>[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    []
  );

  const addNode = useCallback(() => {
    setNodes((prev) => {
      const maxIndex = prev.reduce((max, n) => {
        const m = String(n.id).match(/^n(\d+)$/);
        const idx = m ? parseInt(m[1], 10) : 0;
        return Math.max(max, idx);
      }, 0);
      const next = maxIndex + 1;
      const newNode = {
        id: `n${next}`,
        position: { x: 0, y: next * 100 },
        data: { label: `Node ${next}` },
      };
      return [...prev, newNode];
    });
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls>
          <ControlButton onClick={addNode}>
            <PlusCircle color="white" />
          </ControlButton>
        </Controls>
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
