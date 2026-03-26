import type { NodeTypes } from "@xyflow/react";

import { BaseDataflowNode } from "@/components/nodes/base-dataflow-node";
import { ConstantInputNode } from "@/components/nodes/input/constant-input-node";
import { ConstantNumberInputNode } from "@/components/nodes/input/constant-number-input-node";
import { ConstantBooleanInputNode } from "@/components/nodes/input/constant-boolean-input-node";
import { ConstantTextInputNode } from "@/components/nodes/input/constant-text-input-node";
import { ConstantListInputNode } from "@/components/nodes/input/constant-list-input-node";
import { RandomInputNode } from "@/components/nodes/input/random-input-node";
import { ChoiceInputNode } from "@/components/nodes/input/choice-input-node";
import { TimerInputNode } from "@/components/nodes/input/timer-input-node";
import { RuntimeInputNode } from "@/components/nodes/input/runtime-input-node";

import { MicrobitReadButtonInputNode } from "@/components/nodes/microbit/microbit-read-button-input-node";
import { MicrobitReadTemperatureInputNode } from "@/components/nodes/microbit/microbit-read-temperature-input-node";
import { MicrobitReadPinInputNode } from "@/components/nodes/microbit/microbit-read-pin-input-node";

import { SumNode } from "@/components/nodes/processing/sum-node";
import { SubtractNode } from "@/components/nodes/processing/subtract-node";
import { MultiplyNode } from "@/components/nodes/processing/multiply-node";
import { DivideNode } from "@/components/nodes/processing/divide-node";
import { ModNode } from "@/components/nodes/processing/mod-node";
import { PowerNode } from "@/components/nodes/processing/power-node";
import { MathOperationNode } from "@/components/nodes/processing/math-operation-node";
import { LogicOperationNode } from "@/components/nodes/processing/logic-operation-node";
import { RootNode } from "@/components/nodes/processing/root-node";
import { LogarithmNode } from "@/components/nodes/processing/logarithm-node";
import { FloorNode } from "@/components/nodes/processing/floor-node";
import { CeilingNode } from "@/components/nodes/processing/ceiling-node";
import { RoundNode } from "@/components/nodes/processing/round-node";
import { FormulaEditorNode } from "@/components/nodes/processing/formula-editor-node";
import { ConcatNode } from "@/components/nodes/processing/concat-node";
import { ReplaceTextNode } from "@/components/nodes/processing/replace-text-node";
import { SubtractTextNode } from "@/components/nodes/processing/subtract-text-node";
import { SliceTextNode } from "@/components/nodes/processing/slice-text-node";

import { ComparisonNode } from "@/components/nodes/control/comparison-node";
import {
  ComparisonEqualNode,
  ComparisonNotEqualNode,
  ComparisonLessNode,
  ComparisonLessOrEqualNode,
  ComparisonGreaterNode,
  ComparisonGreaterOrEqualNode,
} from "@/components/nodes/control/comparison-operator-nodes";
import { AndNode } from "@/components/nodes/control/and-node";
import { OrNode } from "@/components/nodes/control/or-node";
import { NotNode } from "@/components/nodes/control/not-node";
import { NandNode } from "@/components/nodes/control/nand-node";
import { NorNode } from "@/components/nodes/control/nor-node";
import { XorNode } from "@/components/nodes/control/xor-node";
import { DesvioNode } from "@/components/nodes/control/desvio-node";
import { RelevoNode } from "@/components/nodes/control/relevo-node";
import { WhileNode } from "@/components/nodes/control/while-node";
import { SwitchNode } from "@/components/nodes/control/switch-node";
import { ConditionalNode } from "@/components/nodes/control/conditional-node";
import { ConditionalSelectorNode } from "@/components/nodes/control/conditional-selector-node";
import { SelectorNode } from "@/components/nodes/control/selector-node";

import { WriteNode } from "@/components/nodes/io/write-node";

import { MicrobitWriteNode } from "@/components/nodes/microbit/microbit-write-node";
import { MicrobitSoundNode } from "@/components/nodes/microbit/microbit-sound-node";
import { MicrobitWritePinNode } from "@/components/nodes/microbit/microbit-write-pin-node";

import { SequenceNode } from "@/components/nodes/iteration/sequence-node";
import { PulseSequenceNode } from "@/components/nodes/iteration/pulse-sequence-node";
import { ZipNode } from "@/components/nodes/iteration/zip-node";
import { UnzipNode } from "@/components/nodes/iteration/unzip-node";
import { FilterNode } from "@/components/nodes/iteration/filter-node";
import { MapNode } from "@/components/nodes/iteration/map-node";
import { AccumulateNode } from "@/components/nodes/iteration/accumulate-node";
import { ProductNode } from "@/components/nodes/iteration/product-node";
import { CountNode } from "@/components/nodes/iteration/count-node";
import { SortListNode } from "@/components/nodes/iteration/sort-list-node";
import { ListFirstNode } from "@/components/nodes/iteration/list-first-node";
import { ListLastNode } from "@/components/nodes/iteration/list-last-node";
import { ListMinNode } from "@/components/nodes/iteration/list-min-node";
import { ListMaxNode } from "@/components/nodes/iteration/list-max-node";
import { ListFrequencyNode } from "@/components/nodes/iteration/list-frequency-node";
import { ListAtPositionNode } from "@/components/nodes/iteration/list-at-position-node";
import { ListFindElementNode } from "@/components/nodes/iteration/list-find-element-node";
import { ListRemoveFirstNode } from "@/components/nodes/iteration/list-remove-first-node";
import { ListRemoveLastNode } from "@/components/nodes/iteration/list-remove-last-node";
import { ListPrependNode } from "@/components/nodes/iteration/list-prepend-node";
import { ListAppendNode } from "@/components/nodes/iteration/list-append-node";
import { ListIsEmptyNode } from "@/components/nodes/iteration/list-is-empty-node";
import { ListReverseNode } from "@/components/nodes/iteration/list-reverse-node";
import { SplitListNode } from "@/components/nodes/iteration/split-list-node";
import { ListEvenPositionsNode } from "@/components/nodes/iteration/list-even-positions-node";
import { ListOddPositionsNode } from "@/components/nodes/iteration/list-odd-positions-node";
import { CommentNode } from "@/components/nodes/annotation/comment-node";

import { SubflowInputNode } from "@/components/nodes/abstraction/subflow-input-node"; // New import for SubflowInputNode
import { SubflowOutputNode } from "@/components/nodes/abstraction/subflow-output-node";
import { ScatterNode } from "@/components/nodes/control/scatter-node";
import { GatherNode } from "@/components/nodes/control/gather-node";
// NOTE: This is intentionally the nodeTypes map WITHOUT the `subflow` entry.
// We use this inside the Subflow editor to avoid circular imports.
export const nodeTypesCore: NodeTypes = {
  baseNode: BaseDataflowNode,
  constantInput: ConstantInputNode,
  constantNumber: ConstantNumberInputNode,
  constantBoolean: ConstantBooleanInputNode,
  constantText: ConstantTextInputNode,
  constantList: ConstantListInputNode,
  runtimeInput: RuntimeInputNode,
  randomInput: RandomInputNode,
  choiceInput: ChoiceInputNode,
  timerInput: TimerInputNode,
  microbitReadButton: MicrobitReadButtonInputNode,
  microbitReadTemperature: MicrobitReadTemperatureInputNode,
  microbitReadPin: MicrobitReadPinInputNode,
  sum: SumNode,
  subtract: SubtractNode,
  multiply: MultiplyNode,
  divide: DivideNode,
  mod: ModNode,
  power: PowerNode,
  mathOperation: MathOperationNode,
  logicOperation: LogicOperationNode,
  root: RootNode,
  logarithm: LogarithmNode,
  floor: FloorNode,
  ceiling: CeilingNode,
  round: RoundNode,
  formulaEditor: FormulaEditorNode,
  concat: ConcatNode,
  replaceText: ReplaceTextNode,
  subtractText: SubtractTextNode,
  sliceText: SliceTextNode,
  comparison: ComparisonNode,
  comparisonEqual: ComparisonEqualNode,
  comparisonNotEqual: ComparisonNotEqualNode,
  comparisonLess: ComparisonLessNode,
  comparisonLessOrEqual: ComparisonLessOrEqualNode,
  comparisonGreater: ComparisonGreaterNode,
  comparisonGreaterOrEqual: ComparisonGreaterOrEqualNode,
  and: AndNode,
  nand: NandNode,
  or: OrNode,
  nor: NorNode,
  xor: XorNode,
  desvio: DesvioNode,
  relevo: RelevoNode,
  while: WhileNode,
  not: NotNode,
  switch: SwitchNode,
  conditional: ConditionalNode,
  conditionalSelector: ConditionalSelectorNode,
  selector: SelectorNode,
  scatter: ScatterNode,
  gather: GatherNode,
  subflowInput: SubflowInputNode, // Registering SubflowInputNode in nodeTypesCore
  subflowOutput: SubflowOutputNode,
  write: WriteNode,
  microbitWrite: MicrobitWriteNode,
  microbitSound: MicrobitSoundNode,
  microbitWritePin: MicrobitWritePinNode,
  sequence: SequenceNode,
  pulseSequence: PulseSequenceNode,
  zip: ZipNode,
  unzip: UnzipNode,
  filter: FilterNode,
  map: MapNode,
  accumulate: AccumulateNode,
  product: ProductNode,
  count: CountNode,
  sortList: SortListNode,
  listFirst: ListFirstNode,
  listLast: ListLastNode,
  listMin: ListMinNode,
  listMax: ListMaxNode,
  listFrequency: ListFrequencyNode,
  listAtPosition: ListAtPositionNode,
  listFindElement: ListFindElementNode,
  listRemoveFirst: ListRemoveFirstNode,
  listRemoveLast: ListRemoveLastNode,
  listPrepend: ListPrependNode,
  listAppend: ListAppendNode,
  listIsEmpty: ListIsEmptyNode,
  listReverse: ListReverseNode,
  splitList: SplitListNode,
  listEvenPositions: ListEvenPositionsNode,
  listOddPositions: ListOddPositionsNode,
  listParityPositions: ListEvenPositionsNode,
  comment: CommentNode,
};
