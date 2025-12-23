import { useState, useCallback } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ControlButton,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./App.css";
import { PlusCircle } from "lucide-react";
import { BaseDataflowNode } from "@/components/nodes/base-dataflow-node";
import { ConstantInputNode } from "@/components/nodes/input/constant-input-node";
import { RandomInputNode } from "@/components/nodes/input/random-input-node";
import { TimerInputNode } from "@/components/nodes/input/timer-input-node";
import { SumNode } from "@/components/nodes/processing/sum-node";
import { SubtractNode } from "@/components/nodes/processing/subtract-node";
import { MultiplyNode } from "@/components/nodes/processing/multiply-node";
import { DivideNode } from "@/components/nodes/processing/divide-node";
import { PowerNode } from "@/components/nodes/processing/power-node";
import { ConcatNode } from "@/components/nodes/processing/concat-node";
import { ComparisonNode } from "@/components/nodes/control/comparison-node";
import { AndNode } from "@/components/nodes/control/and-node";
import { OrNode } from "@/components/nodes/control/or-node";
import { NotNode } from "@/components/nodes/control/not-node";
import { SwitchNode } from "@/components/nodes/control/switch-node";
import { SubflowNode } from "@/components/nodes/abstraction/subflow-node";
import { WriteNode } from "@/components/nodes/io/write-node";
import { SequenceNode } from "@/components/nodes/iteration/sequence-node";
import { ZipNode } from "@/components/nodes/iteration/zip-node";
import { FilterNode } from "@/components/nodes/iteration/filter-node";
import { AccumulateNode } from "@/components/nodes/iteration/accumulate-node";
import { CountNode } from "@/components/nodes/iteration/count-node";

type FlowNode = Node;
type FlowEdge = Edge;

const nodeTypes: NodeTypes = {
  baseNode: BaseDataflowNode,
  constantInput: ConstantInputNode,
  randomInput: RandomInputNode,
  timerInput: TimerInputNode,
   sum: SumNode,
   subtract: SubtractNode,
   multiply: MultiplyNode,
   divide: DivideNode,
   power: PowerNode,
   concat: ConcatNode,
   comparison: ComparisonNode,
   and: AndNode,
   or: OrNode,
   not: NotNode,
   switch: SwitchNode,
   subflow: SubflowNode,
   write: WriteNode,
  sequence: SequenceNode,
  zip: ZipNode,
  filter: FilterNode,
  accumulate: AccumulateNode,
  count: CountNode,
};

const initialNodes: FlowNode[] = [
  // Entradas y eventos (verde, circulares)
  {
    id: "in-const",
    position: { x: 0, y: 0 },
    data: {
      label: "Constante",
    },
    type: "constantInput",
  },
  {
    id: "in-timer",
    position: { x: 0, y: 140 },
    data: {
      label: "Timer",
    },
    type: "timerInput",
  },
  {
    id: "in-random",
    position: { x: 0, y: 280 },
    data: {
      label: "Valor Aleatorio",
    },
    type: "randomInput",
  },
  // Procesamiento (azul, rectángulos redondeados)
  {
    id: "pr-sum",
    position: { x: 260, y: 0 },
    data: { label: "Sumar" },
    type: "sum",
  },
  {
    id: "pr-sub",
    position: { x: 260, y: 90 },
    data: { label: "Restar" },
    type: "subtract",
  },
  {
    id: "pr-mul",
    position: { x: 260, y: 180 },
    data: { label: "Multiplicar" },
    type: "multiply",
  },
  {
    id: "pr-div",
    position: { x: 260, y: 270 },
    data: { label: "División" },
    type: "divide",
  },
  {
    id: "pr-pow",
    position: { x: 260, y: 360 },
    data: { label: "Potencia" },
    type: "power",
  },
  {
    id: "pr-concat",
    position: { x: 260, y: 450 },
    data: { label: "Concatenar" },
    type: "concat",
  },
  // Control (naranja)
  {
    id: "ct-comp",
    position: { x: 520, y: 0 },
    data: { label: "Comparación" },
    type: "comparison",
  },
  {
    id: "ct-and",
    position: { x: 520, y: 90 },
    data: { label: "AND" },
    type: "and",
  },
  {
    id: "ct-or",
    position: { x: 520, y: 180 },
    data: { label: "OR" },
    type: "or",
  },
  {
    id: "ct-not",
    position: { x: 520, y: 270 },
    data: { label: "NOT" },
    type: "not",
  },
  {
    id: "ct-switch",
    position: { x: 520, y: 360 },
    data: { label: "Switch" },
    type: "switch",
  },
  // Iteración y listas (verde azulado)
  {
    id: "it-seq",
    position: { x: 780, y: 0 },
    data: { label: "Generar Secuencia" },
    type: "sequence",
  },
  {
    id: "it-zip",
    position: { x: 780, y: 90 },
    data: { label: "Zip" },
    type: "zip",
  },
  {
    id: "it-filter",
    position: { x: 780, y: 180 },
    data: { label: "Filtrar" },
    type: "filter",
  },
  {
    id: "it-acc",
    position: { x: 780, y: 270 },
    data: { label: "Acumular" },
    type: "accumulate",
  },
  {
    id: "it-count",
    position: { x: 780, y: 360 },
    data: { label: "Contar" },
    type: "count",
  },
  // Abstracción (morado)
  {
    id: "ab-subflow",
    position: { x: 1040, y: 180 },
    data: { label: "Subflujo" },
    type: "subflow",
  },
  // Interacción / Verificación (rojo)
  {
    id: "io-write",
    position: { x: 1300, y: 180 },
    data: { label: "Escribir" },
    type: "write",
  },
];

const initialEdges: FlowEdge[] = [];

export default function App() {
  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialEdges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
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
        position: { x: 0, y: next * 140 },
        data: {
          title: `Nodo base ${next}`,
          description: "Nodo creado dinámicamente a partir del esqueleto base.",
          footerActionLabel: "Acción",
        },
        type: "baseNode" as FlowNode["type"],
      };
      return [...prev, newNode];
    });
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
