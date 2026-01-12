import { memo, useEffect, useRef, useState } from "react";
import { type NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";

export type CommentNodeData = {
  text?: string;
};

export const CommentNode = memo(({ id, data, selected }: NodeProps) => {
  const { text = "" } = (data ?? {}) as CommentNodeData;
  const { setNodes } = useReactFlow();
  const [value, setValue] = useState<string>(String(text ?? ""));
  const isFirstRef = useRef(true);

  // sync external changes into local state
  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      setValue(String(text ?? ""));
      return;
    }
    if (String(text ?? "") !== value) {
      setValue(String(text ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.currentTarget.value;
    setValue(next);
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, data: { ...(n.data ?? {}), text: next } } : n
      )
    );
  };

  return (
    <>
      <NodeResizer nodeId={id} isVisible={selected} />
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#fff59d",
          padding: 8,
          borderRadius: 8,
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <textarea
          value={value}
          onChange={onChange}
          className="w-full h-full resize-none bg-transparent outline-none p-0 m-0"
          style={{
            border: "none",
            padding: 0,
            margin: 0,
            width: "100%",
            height: "100%",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        />
      </div>
    </>
  );
});

CommentNode.displayName = "CommentNode";
