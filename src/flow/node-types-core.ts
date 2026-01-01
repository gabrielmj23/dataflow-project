import type { NodeTypes } from "@xyflow/react";

import { BaseDataflowNode } from "@/components/nodes/base-dataflow-node";
import { ConstantInputNode } from "@/components/nodes/input/constant-input-node";
import { ConstantNumberInputNode } from "@/components/nodes/input/constant-number-input-node";
import { ConstantBooleanInputNode } from "@/components/nodes/input/constant-boolean-input-node";
import { ConstantTextInputNode } from "@/components/nodes/input/constant-text-input-node";
import { RandomInputNode } from "@/components/nodes/input/random-input-node";
import { TimerInputNode } from "@/components/nodes/input/timer-input-node";

import { SumNode } from "@/components/nodes/processing/sum-node";
import { SubtractNode } from "@/components/nodes/processing/subtract-node";
import { MultiplyNode } from "@/components/nodes/processing/multiply-node";
import { DivideNode } from "@/components/nodes/processing/divide-node";
import { ModNode } from "@/components/nodes/processing/mod-node";
import { PowerNode } from "@/components/nodes/processing/power-node";
import { ConcatNode } from "@/components/nodes/processing/concat-node";

import { ComparisonNode } from "@/components/nodes/control/comparison-node";
import { AndNode } from "@/components/nodes/control/and-node";
import { OrNode } from "@/components/nodes/control/or-node";
import { NotNode } from "@/components/nodes/control/not-node";
import { SwitchNode } from "@/components/nodes/control/switch-node";

import { WriteNode } from "@/components/nodes/io/write-node";

import { SequenceNode } from "@/components/nodes/iteration/sequence-node";
import { ZipNode } from "@/components/nodes/iteration/zip-node";
import { FilterNode } from "@/components/nodes/iteration/filter-node";
import { MapNode } from "@/components/nodes/iteration/map-node";
import { AccumulateNode } from "@/components/nodes/iteration/accumulate-node";
import { CountNode } from "@/components/nodes/iteration/count-node";

// NOTE: This is intentionally the nodeTypes map WITHOUT the `subflow` entry.
// We use this inside the Subflow editor to avoid circular imports.
export const nodeTypesCore: NodeTypes = {
  baseNode: BaseDataflowNode,
  constantInput: ConstantInputNode,
  constantNumber: ConstantNumberInputNode,
  constantBoolean: ConstantBooleanInputNode,
  constantText: ConstantTextInputNode,
  randomInput: RandomInputNode,
  timerInput: TimerInputNode,
  sum: SumNode,
  subtract: SubtractNode,
  multiply: MultiplyNode,
  divide: DivideNode,
  mod: ModNode,
  power: PowerNode,
  concat: ConcatNode,
  comparison: ComparisonNode,
  and: AndNode,
  or: OrNode,
  not: NotNode,
  switch: SwitchNode,
  write: WriteNode,
  sequence: SequenceNode,
  zip: ZipNode,
  filter: FilterNode,
  map: MapNode,
  accumulate: AccumulateNode,
  count: CountNode,
};
