import { NODE_TYPES } from "@/common/constants";

import { EngineWriteNode } from "../nodes/output-nodes";
import {
  EngineMicrobitWritePinNode,
  EngineMicrobitSoundNode,
  EngineMicrobitWriteNode,
} from "../nodes/microbit-nodes";

import { asRecord } from "../deserialize/utils";
import type { NodeCompiler } from "./types";

export const compileOutputNodes: NodeCompiler = (flowNode, ctx) => {
  const nodeType = String(flowNode.type);
  const data = asRecord(flowNode.data);

  switch (nodeType) {
    case NODE_TYPES.WRITE_SINK:
      return new EngineWriteNode(
        ctx.writeSinkInputCountByNodeId?.get(String(flowNode.id)) ?? 1,
        typeof data.template === "string" ? data.template : undefined,
        ctx.writeSinkConnectedInputPortsByNodeId?.get(String(flowNode.id)),
      );

    case NODE_TYPES.MICROBIT_WRITE:
      return new EngineMicrobitWriteNode({
        transport:
          (data as { transport?: unknown; connectionType?: unknown } | null)
            ?.transport ??
          (data as { connectionType?: unknown } | null)?.connectionType,
      });

    case NODE_TYPES.MICROBIT_SOUND:
      return new EngineMicrobitSoundNode({
        transport:
          (data as { transport?: unknown; connectionType?: unknown } | null)
            ?.transport ??
          (data as { connectionType?: unknown } | null)?.connectionType,
        signal: ctx.signal,
      });

    case NODE_TYPES.MICROBIT_WRITE_PIN: {
      const pin = typeof data.pin === "string" ? data.pin : "P0";
      const mode = data.mode === "analog" ? "analog" : "digital";
      return new EngineMicrobitWritePinNode({
        transport:
          (data as { transport?: unknown; connectionType?: unknown } | null)
            ?.transport ??
          (data as { connectionType?: unknown } | null)?.connectionType,
        pin,
        mode,
      });
    }

    default:
      return null;
  }
};
