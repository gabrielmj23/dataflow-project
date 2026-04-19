import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";
import type { FlowEdge, FlowNode } from "./flow";

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

export function isSelectionConnected(
  nodeIds: string[],
  edges: FlowEdge[],
): boolean {
  if (nodeIds.length <= 1) {
    return true;
  }

  const idSet = new Set(nodeIds);
  const adjacency = new Map<string, Set<string>>();
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, new Set());
  }

  for (const edge of edges) {
    const source = String(edge.source);
    const target = String(edge.target);
    if (!idSet.has(source) || !idSet.has(target)) {
      continue;
    }
    adjacency.get(source)?.add(target);
    adjacency.get(target)?.add(source);
  }

  const start = nodeIds[0];
  if (!start) {
    return false;
  }

  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const neighbors = adjacency.get(current);
    if (!neighbors) {
      continue;
    }
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited.size === nodeIds.length;
}

export function getLayoutedElements(nodes: FlowNode[], edges: FlowEdge[]) {
  dagreGraph.setGraph({ rankdir: "LR" });

  const DEFAULT_NODE_WIDTH = 120;
  const LARGE_NODE_WIDTH = 180;
  const NODE_HEIGHT = 64;

  nodes.forEach((node) => {
    const isListNode =
      node.type?.startsWith("list") ||
      node.type === "sortList" ||
      node.type === "splitList" ||
      node.type === "filter" ||
      node.type === "map" ||
      node.type === "zip" ||
      node.type === "unzip" ||
      node.type === "accumulate";

    const isWriteNode = node.type === "write" || node.type === "microbitWrite";
    const isFormulaNode =
      node.type === "formulaEditor" || node.type === "logicFormula";

    const width =
      isListNode || isWriteNode || isFormulaNode
        ? LARGE_NODE_WIDTH
        : DEFAULT_NODE_WIDTH;

    dagreGraph.setNode(node.id, { width, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
}
