import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Rocket } from "lucide-react";

import {
  BaseNode,
  BaseNodeContent,
  BaseNodeFooter,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@/components/base-node";

export type BaseDataflowNodeData = {
  title?: string;
  description?: string;
  footerActionLabel?: string;
};

export const BaseDataflowNode = memo(
  ({ data }: NodeProps) => {
    const {
      title = "Nodo base",
      description = "Este es un nodo basado en BaseNode.",
      footerActionLabel = "Acción",
    } = (data ?? {}) as BaseDataflowNodeData;

    return (
      <BaseNode className="w-80" infoDescription={description}>
        <BaseNodeHeader className="border-b">
          <Rocket className="size-5" />
          <BaseNodeHeaderTitle>{title}</BaseNodeHeaderTitle>
        </BaseNodeHeader>
        <BaseNodeContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </BaseNodeContent>
        <BaseNodeFooter>
          <button className="nodrag w-full rounded-md border px-2 py-1 text-sm">
            {footerActionLabel}
          </button>
        </BaseNodeFooter>
      </BaseNode>
    );
  },
);

BaseDataflowNode.displayName = "BaseDataflowNode";
