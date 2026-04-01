import { NODE_TYPES } from "@/common/constants";
import { parseMicrobitSlot } from "@/microbit/slot-utils";

import { EngineTimerNode } from "../nodes/event-nodes";
import {
  EngineChoiceNode,
  EngineConstantListNode,
  EngineConstantNode,
  EngineRandomNode,
} from "../nodes/input-nodes";
import {
  EngineMicrobitReadButtonNode,
  EngineMicrobitReadPinNode,
  EngineMicrobitReadTemperatureNode,
} from "../nodes/microbit-nodes";
import { FirePatterns, NodeDefinition } from "../program-elements";

import { asRecord } from "../deserialize/utils";
import type { NodeCompiler } from "./types";

export const compileInputNodes: NodeCompiler = (flowNode, ctx) => {
  const nodeType = String(flowNode.type);
  const data = asRecord(flowNode.data);

  switch (nodeType) {
    case NODE_TYPES.CONSTANT_INPUT: {
      const value = data.value as number | string | boolean | undefined;
      return new EngineConstantNode(value ?? 0);
    }
    case NODE_TYPES.CONSTANT_NUMBER_INPUT: {
      const value = typeof data.value === "number" ? data.value : 0;
      return new EngineConstantNode(value);
    }
    case NODE_TYPES.CONSTANT_BOOLEAN_INPUT: {
      const value = data.value === true;
      return new EngineConstantNode(value);
    }
    case NODE_TYPES.CONSTANT_TEXT_INPUT: {
      const value = typeof data.value === "string" ? data.value : "";
      return new EngineConstantNode(value);
    }
    case NODE_TYPES.CONSTANT_LIST_INPUT: {
      const raw = data.items;
      const items: Array<string | number> = Array.isArray(raw)
        ? raw
            .map((item) => {
              if (typeof item === "number") return item;
              const str = String(item ?? "").trim();
              const num = Number(str);
              if (/^-?\d+(\.\d+)?$/.test(str) && Number.isFinite(num)) {
                return num;
              }
              return str;
            })
            .filter((item) =>
              typeof item === "number"
                ? Number.isFinite(item)
                : Boolean(String(item).trim()),
            )
        : [];
      return new EngineConstantListNode(items);
    }
    case NODE_TYPES.RUNTIME_INPUT: {
      const prompt = typeof data.prompt === "string" ? data.prompt : undefined;
      const valueTypeRaw = data.valueType;
      const valueType = valueTypeRaw === "text" ? "text" : "number";

      const defaultValue =
        valueType === "text"
          ? typeof data.defaultValue === "string"
            ? data.defaultValue
            : undefined
          : typeof data.defaultValue === "number"
            ? data.defaultValue
            : undefined;

      return new NodeDefinition(
        () => defaultValue ?? (valueType === "text" ? "" : 0),
        [FirePatterns.ALWAYS],
        ["output"],
        {
          kind: "runtimeInput",
          runtimePrompt: prompt,
          runtimeInputType: valueType,
          runtimeDefaultValue: defaultValue,
        },
      );
    }
    case NODE_TYPES.RUNTIME_INPUT_PULSE: {
      const prompt = typeof data.prompt === "string" ? data.prompt : undefined;
      const valueTypeRaw = data.valueType;
      const valueType = valueTypeRaw === "text" ? "text" : "number";

      const defaultValue =
        valueType === "text"
          ? typeof data.defaultValue === "string"
            ? data.defaultValue
            : undefined
          : typeof data.defaultValue === "number"
            ? data.defaultValue
            : undefined;

      return new NodeDefinition(
        () => defaultValue ?? (valueType === "text" ? "" : 0),
        [FirePatterns.EXISTS, FirePatterns.EXISTS],
        ["frequency", "count", "output"],
        {
          kind: "runtimeInputPulse",
          runtimePrompt: prompt,
          runtimeInputType: valueType,
          runtimeDefaultValue: defaultValue,
        },
      );
    }
    case NODE_TYPES.RANDOM_INPUT: {
      const min = typeof data.min === "number" ? data.min : 0;
      const max = typeof data.max === "number" ? data.max : 100;
      const integerOnly = data.integerOnly === true;
      return new EngineRandomNode(min, max, integerOnly);
    }
    case NODE_TYPES.CHOICE_INPUT: {
      const raw = data.choices;
      const choices: string[] = Array.isArray(raw)
        ? raw
            .map((c) => (typeof c === "string" ? c : String(c)))
            .filter(Boolean)
        : [];
      return new EngineChoiceNode(choices);
    }
    case NODE_TYPES.TIMER_INPUT: {
      const seconds = typeof data.timeValue === "number" ? data.timeValue : 0;
      const hasIncoming = Boolean(
        ctx.timerHasIncomingByNodeId?.get(String(flowNode.id)),
      );
      return new EngineTimerNode(
        Math.max(0, Math.round(seconds * 1000)),
        hasIncoming ? "delay" : "source",
      );
    }
    case NODE_TYPES.MICROBIT_READ_BUTTON_INPUT: {
      const transportRaw = data.transport;
      const transport =
        transportRaw === "bluetooth" || transportRaw === "serial"
          ? transportRaw
          : "serial";
      const slot = parseMicrobitSlot(data);
      return new EngineMicrobitReadButtonNode({
        nodeId: String(flowNode.id),
        transport,
        slot,
        onLog: ctx.onLog,
        signal: ctx.signal,
      });
    }
    case NODE_TYPES.MICROBIT_READ_BUTTON_PULSE_INPUT: {
      const transportRaw = data.transport;
      const transport =
        transportRaw === "bluetooth" || transportRaw === "serial"
          ? transportRaw
          : "serial";
      const slot = parseMicrobitSlot(data);
      return new EngineMicrobitReadButtonNode({
        nodeId: String(flowNode.id),
        transport,
        slot,
        pulseFromInputs: true,
        onLog: ctx.onLog,
        signal: ctx.signal,
      });
    }
    case NODE_TYPES.MICROBIT_READ_TEMPERATURE_INPUT: {
      const transportRaw = data.transport;
      const transport =
        transportRaw === "bluetooth" || transportRaw === "serial"
          ? transportRaw
          : "serial";
      const slot = parseMicrobitSlot(data);
      return new EngineMicrobitReadTemperatureNode({
        nodeId: String(flowNode.id),
        transport,
        slot,
        onLog: ctx.onLog,
        signal: ctx.signal,
      });
    }
    case NODE_TYPES.MICROBIT_READ_TEMPERATURE_PULSE_INPUT: {
      const transportRaw = data.transport;
      const transport =
        transportRaw === "bluetooth" || transportRaw === "serial"
          ? transportRaw
          : "serial";
      const slot = parseMicrobitSlot(data);
      return new EngineMicrobitReadTemperatureNode({
        nodeId: String(flowNode.id),
        transport,
        slot,
        pulseFromInputs: true,
        onLog: ctx.onLog,
        signal: ctx.signal,
      });
    }
    case NODE_TYPES.MICROBIT_READ_PIN_INPUT: {
      const transportRaw = data.transport;
      const transport =
        transportRaw === "bluetooth" || transportRaw === "serial"
          ? transportRaw
          : "serial";
      const slot = parseMicrobitSlot(data);
      const pin = typeof data.pin === "string" ? data.pin : "P0";
      const mode = data.mode === "analog" ? "analog" : "digital";
      return new EngineMicrobitReadPinNode({
        nodeId: String(flowNode.id),
        transport,
        slot,
        pin,
        mode,
        onLog: ctx.onLog,
        signal: ctx.signal,
      });
    }
    case NODE_TYPES.MICROBIT_READ_PIN_PULSE_INPUT: {
      const transportRaw = data.transport;
      const transport =
        transportRaw === "bluetooth" || transportRaw === "serial"
          ? transportRaw
          : "serial";
      const slot = parseMicrobitSlot(data);
      const pin = typeof data.pin === "string" ? data.pin : "P0";
      const mode = data.mode === "analog" ? "analog" : "digital";
      return new EngineMicrobitReadPinNode({
        nodeId: String(flowNode.id),
        transport,
        slot,
        pin,
        mode,
        pulseFromInputs: true,
        onLog: ctx.onLog,
        signal: ctx.signal,
      });
    }
    default:
      return null;
  }
};
