import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { getPortTypeMask, maskToVisualPortDataType } from "@/flow/port-data-type";

type InputRectNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  prompt?: string | null;
  onPromptChange?: (next: string) => void;
  onLabelChange?: (next: string) => void;
  /** Optional className for the label text. */
  labelClassName?: string;
  className?: string;
  indicatorClassName?: string;
  disableRuntimeStyles?: boolean;
};

export function InputRectNodeShell({
  nodeType,
  icon,
  label,
  prompt = null,
  onPromptChange,
  onLabelChange,
  className,
  indicatorClassName,
  labelClassName,
  disableRuntimeStyles = true,
}: InputRectNodeShellProps) {
  const inputMask = getPortTypeMask({ nodeType, handleType: "target", handleId: null });
  const inputType = maskToVisualPortDataType(inputMask);
  const outputMask = getPortTypeMask({ nodeType, handleType: "source", handleId: null });
  const outputType = maskToVisualPortDataType(outputMask);

  const promptText = typeof prompt === "string" ? prompt : "Ingrese un número";
  const [localPrompt, setLocalPrompt] = useState(promptText);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const lastValidPrompt = useRef(promptText);

  useEffect(() => {
    if (!isEditingPrompt) {
      setLocalPrompt(promptText);
      lastValidPrompt.current = promptText;
    }
  }, [promptText, isEditingPrompt]);

  const [localLabel, setLocalLabel] = useState(label);
  const [isEditingLabel, setIsEditingLabel] = useState(false);

  useEffect(() => {
    if (!isEditingLabel) setLocalLabel(label);
  }, [label, isEditingLabel]);

  return (
    <BaseNode
      hideRuntimeBadges
      disableRuntimeStyles={disableRuntimeStyles}
      className={
        className ??
        "relative flex h-14 w-52 items-center justify-between rounded-lg border-emerald-600 bg-emerald-500 text-white shadow-md px-2"
      }
    >
      <div className="flex-1 pr-2 flex items-center justify-center">
        <textarea
          rows={2}
          value={localPrompt}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.focus();
          }}
          className="w-full resize-none border-none bg-transparent px-0 text-center text-sm font-normal text-white focus:outline-none"
          style={{
            lineHeight: "1.4rem",
            maxHeight: "3rem",
            minHeight: "3rem",
            display: "block",
            padding: "0",
            overflow: "hidden",
          }}
          aria-label="Prompt de entrada"
          onFocus={() => setIsEditingPrompt(true)}
          onBlur={() => {
            setIsEditingPrompt(false);
            if (typeof onPromptChange === "function") onPromptChange(localPrompt.trim());
          }}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const lines = value.split(/\r?\n/);
            if (lines.length > 2) {
              setLocalPrompt(lastValidPrompt.current);
              e.currentTarget.value = lastValidPrompt.current;
              return;
            }
            setLocalPrompt(value);
            lastValidPrompt.current = value;
          }}
          onPaste={(e) => {
            const clipboard = e.clipboardData.getData("text");
            const existingLines = localPrompt.split(/\r?\n/).length;
            const addedLines = clipboard.split(/\r?\n/).length - 1;
            if (existingLines + addedLines >= 3) {
              e.preventDefault();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const lines = localPrompt.split(/\r?\n/);
              if (lines.length >= 2) {
                e.preventDefault();
              }
            }
          }}
        />
      </div>

      <div className="flex-shrink-0 flex w-20 flex-col items-center justify-center">
        <div className="mb-1 flex h-8 w-12 items-center justify-center rounded">
          {icon}
        </div>
        <input
          value={localLabel}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.select();
          }}
          className={["text-[10px] text-white text-center", labelClassName ?? ""].join(" ")}
          aria-label="Nombre del input"
          onFocus={() => setIsEditingLabel(true)}
          onBlur={() => {
            setIsEditingLabel(false);
            if (typeof onLabelChange === "function") onLabelChange(localLabel.trim());
          }}
          onChange={(e) => setLocalLabel(e.currentTarget.value)}
        />
      </div>

      <CustomTypedHandle
        type="source"
        position={Position.Right}
        dataType={outputType}
        typeMask={outputMask}
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
        indicatorClassName={indicatorClassName ?? "border-emerald-600"}
      />
    </BaseNode>
  );
}

export default InputRectNodeShell;
