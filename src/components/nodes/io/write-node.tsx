import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useReactFlow,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { PenSquare } from "lucide-react";

import { IoRectNodeShell } from "@/components/nodes/io/io-rect-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type WriteNodeData = {
  label?: string;
  /** Number of input handles to render. We keep one extra empty input. */
  inputCount?: number;
  /** Text template to print. Use placeholders like {1}, {2}, ... */
  template?: string;
  runtimeError?: string | null;
};

const ZWSP = "\u200B";

function isHTMLElement(node: unknown): node is HTMLElement {
  return (
    Boolean(node) && typeof node === "object" && node instanceof HTMLElement
  );
}

function buildVarChip(params: { index: number }): HTMLSpanElement {
  const span = document.createElement("span");
  span.setAttribute("data-write-var", String(params.index));
  span.setAttribute("contenteditable", "false");
  // Match the same visual style as the draggable variable pills in the dialog.
  span.className =
    "inline-flex h-fit items-center whitespace-nowrap select-none rounded-md border px-2 py-1 text-xs text-white bg-teal-500";
  span.textContent = `Entrada ${params.index}`;
  return span;
}

function setEditorFromTemplate(params: {
  editor: HTMLElement;
  template: string;
}): void {
  const { editor, template } = params;
  editor.innerHTML = "";

  const frag = document.createDocumentFragment();
  const re = /\{(\d+)\}/g;
  let last = 0;
  for (;;) {
    const match = re.exec(template);
    if (!match) break;
    const start = match.index;
    const raw = match[1];
    const idx = Number(raw);

    if (start > last) {
      frag.appendChild(document.createTextNode(template.slice(last, start)));
    }

    if (Number.isFinite(idx) && idx > 0) {
      frag.appendChild(buildVarChip({ index: idx }));
      frag.appendChild(document.createTextNode(ZWSP));
    } else {
      frag.appendChild(document.createTextNode(match[0]));
    }

    last = start + match[0].length;
  }

  if (last < template.length) {
    frag.appendChild(document.createTextNode(template.slice(last)));
  }

  editor.appendChild(frag);
}

function serializeEditorToTemplate(editor: HTMLElement): string {
  const serializeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? "").replaceAll(ZWSP, "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as HTMLElement;
    const varIndex = el.getAttribute("data-write-var");
    if (varIndex) {
      const idx = Number(varIndex);
      return Number.isFinite(idx) && idx > 0 ? `{${idx}}` : "";
    }

    const tag = el.tagName;
    if (tag === "BR") return "\n";

    const children = Array.from(el.childNodes).map(serializeNode).join("");
    if (tag === "DIV" || tag === "P") {
      // contentEditable often uses DIVs for line breaks
      return children + "\n";
    }
    return children;
  };

  return Array.from(editor.childNodes).map(serializeNode).join("");
}

function caretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as unknown as {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
  };

  if (typeof doc.caretRangeFromPoint === "function") {
    return doc.caretRangeFromPoint(x, y);
  }

  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    return range;
  }

  return null;
}

function insertVarAtSelection(params: { editor: HTMLElement; index: number }) {
  const { editor, index } = params;
  try {
    console.log(`[WriteNode] insertVarAtSelection index=${index}`);
  } catch {
    /* ignore */
  }
  const selection = window.getSelection();
  const chip = buildVarChip({ index });
  const spacer = document.createTextNode(ZWSP);

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    try {
      console.log(
        `[WriteNode] insertVarAtSelection has selection; startContainer=`,
        range.startContainer,
        `offset=${range.startOffset}`
      );
    } catch {
      /* ignore */
    }

    if (!editor.contains(range.startContainer)) {
      console.debug(
        "[WriteNode] insertVarAtSelection: selection outside editor — appending at end"
      );
      editor.appendChild(chip);
      editor.appendChild(spacer);
    } else {
      range.deleteContents();
      range.insertNode(spacer);
      range.insertNode(chip);
      console.debug("[WriteNode] insertVarAtSelection: inserted at selection");
    }
  } else {
    console.debug(
      "[WriteNode] insertVarAtSelection: no selection — appending at end"
    );
    editor.appendChild(chip);
    editor.appendChild(spacer);
  }

  editor.focus();
  const nextRange = document.createRange();
  nextRange.setStartAfter(spacer);
  nextRange.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(nextRange);
}

function sanitizeInputCount(value: unknown): number {
  const n = typeof value === "number" ? value : 1;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

export const WriteNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Escribir",
    runtimeError,
    inputCount: rawInputCount,
    template: rawTemplate,
  } = (data ?? {}) as WriteNodeData;

  const inputCount = useMemo(
    () => sanitizeInputCount(rawInputCount),
    [rawInputCount]
  );

  const targetHandleIds = useMemo(
    () => Array.from({ length: inputCount }, (_, i) => `in-${i + 1}`),
    [inputCount]
  );

  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, inputCount, updateNodeInternals]);

  const { setNodes } = useReactFlow();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState<string>(
    typeof rawTemplate === "string" ? rawTemplate : "{1}"
  );
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [editorEl, setEditorEl] = useState<HTMLDivElement | null>(null);
  const didInitEditorForOpenRef = useRef(false);
  const lastDraggedVarIndexRef = useRef<number | null>(null);

  const setEditorRef = useCallback((el: HTMLDivElement | null) => {
    editorRef.current = el;
    setEditorEl(el);
  }, []);

  const openDialog = useCallback(() => {
    setDraftTemplate(typeof rawTemplate === "string" ? rawTemplate : "{1}");
    setIsDialogOpen(true);
  }, [rawTemplate]);

  const saveTemplate = useCallback(() => {
    const editor = editorRef.current;
    const nextTemplate = editor
      ? serializeEditorToTemplate(editor)
      : draftTemplate;
    setNodes((prev) =>
      prev.map((n) =>
        String(n.id) === String(id)
          ? {
              ...n,
              data: {
                ...(n.data && typeof n.data === "object"
                  ? (n.data as Record<string, unknown>)
                  : {}),
                template: nextTemplate,
              },
            }
          : n
      )
    );
    setIsDialogOpen(false);
  }, [draftTemplate, id, setNodes]);

  // Initialize editor content once per dialog open.
  // Rebuilding innerHTML on every keystroke resets the caret and causes "reversed" typing.
  useEffect(() => {
    if (!isDialogOpen) {
      didInitEditorForOpenRef.current = false;
      return;
    }

    const editor = editorEl;
    if (!editor) return;
    if (didInitEditorForOpenRef.current) return;
    didInitEditorForOpenRef.current = true;

    setEditorFromTemplate({ editor, template: draftTemplate });

    editor.focus();
  }, [draftTemplate, editorEl, isDialogOpen]);

  const onEditorInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setDraftTemplate(serializeEditorToTemplate(editor));
  }, []);

  const onEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Backspace") return;

      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;

      // Case 1: caret is in the editor element itself
      if (node === editor) {
        const idx = offset - 1;
        if (idx >= 0) {
          const prev = editor.childNodes[idx];
          if (isHTMLElement(prev) && prev.hasAttribute("data-write-var")) {
            prev.remove();
            e.preventDefault();
            onEditorInput();
          }
        }
        return;
      }

      // Case 2: caret is inside a text node
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node as Text;
        const textValue = text.data;

        // If we are at the start of a text node, check previous sibling
        if (offset === 0) {
          const prev = text.previousSibling;
          if (isHTMLElement(prev) && prev.hasAttribute("data-write-var")) {
            prev.remove();
            e.preventDefault();
            onEditorInput();
          }
          return;
        }

        // If the char before caret is ZWSP and previous sibling is a chip, remove chip
        const prevChar = textValue[offset - 1];
        if (prevChar === ZWSP) {
          const prev = text.previousSibling;
          if (isHTMLElement(prev) && prev.hasAttribute("data-write-var")) {
            prev.remove();
            // Remove the ZWSP character too
            text.deleteData(offset - 1, 1);
            e.preventDefault();
            onEditorInput();
          }
        }
      }
    },
    [onEditorInput]
  );

  const onEditorDragEnter = useCallback((e: React.DragEvent) => {
    // Required for allowing drops in many browsers.
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onEditorDragOver = useCallback((e: React.DragEvent) => {
    // Without preventDefault(), onDrop won't fire.
    e.preventDefault();
    e.stopPropagation();
    // The intended UX is to insert a variable token (copy).
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onEditorDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();

      const raw =
        e.dataTransfer.getData("application/x-write-var-index") ||
        e.dataTransfer.getData("text/plain");
      console.log(
        `[WriteNode] onEditorDrop raw='${raw}' clientX=${e.clientX} clientY=${e.clientY}`
      );
      const match = /^(?:\{)?(\d+)(?:\})?$/.exec(String(raw).trim());
      const idx = match
        ? Number(match[1])
        : lastDraggedVarIndexRef.current ?? NaN;
      console.log(
        `[WriteNode] onEditorDrop resolved idx=${idx} lastDragged=${lastDraggedVarIndexRef.current}`
      );
      if (!Number.isFinite(idx) || idx <= 0) return;

      const rangeFromPoint = caretRangeFromPoint(e.clientX, e.clientY);
      console.log("[WriteNode] onEditorDrop rangeFromPoint=", rangeFromPoint);

      const fallbackRange = (() => {
        const r = document.createRange();
        r.selectNodeContents(editor);
        r.collapse(false);
        return r;
      })();

      const rangeToUse =
        rangeFromPoint && editor.contains(rangeFromPoint.startContainer)
          ? rangeFromPoint
          : fallbackRange;

      console.log("[WriteNode] onEditorDrop using range=", rangeToUse);

      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(rangeToUse);

      console.log(
        "[WriteNode] onEditorDrop selection after set",
        window.getSelection()
      );

      insertVarAtSelection({ editor, index: idx });
      onEditorInput();
    },
    [onEditorInput]
  );

  return (
    <>
      <IoRectNodeShell
        nodeType="write"
        icon={<PenSquare className="h-6 w-6" />}
        label={label}
        variant="sink"
        targetHandleIds={targetHandleIds}
        onConfigClick={openDialog}
        runtimeError={runtimeError}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Configurar Escribir</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escribe un texto y arrastra variables (Entrada 1, Entrada 2, ...)
              al editor.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Texto a escribir
              </label>

              <div
                className={
                  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 block min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] md:text-sm wrap-break-word"
                }
                style={{
                  whiteSpace: "pre-wrap",
                  direction: "ltr",
                  unicodeBidi: "plaintext",
                }}
                ref={setEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={onEditorInput}
                onKeyDown={onEditorKeyDown}
                onDragEnter={onEditorDragEnter}
                onDragOver={onEditorDragOver}
                onDrop={onEditorDrop}
                data-placeholder="Ej: Resultado: {1} + {2} = {3}"
              />

              <div className="mt-4 flex items-center justify-between">
                <span className="font-medium text-sm">Variables</span>
                <div className="text-xs text-muted-foreground">
                  Arrastra y suelta al editor
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-y-1.5 gap-2 rounded-md border p-2">
                {Array.from({ length: inputCount - 1 }, (_, i) => i + 1).map(
                  (idx) => (
                    <div
                      key={`var-${idx}`}
                      draggable
                      onDragStart={(e) => {
                        lastDraggedVarIndexRef.current = idx;
                        // Set data and effectAllowed early so the drag operation
                        // is properly initialized by the browser.
                        e.dataTransfer.setData(
                          "application/x-write-var-index",
                          String(idx)
                        );
                        e.dataTransfer.setData("text/plain", `{${idx}}`);
                        e.dataTransfer.effectAllowed = "copy";
                        console.log(
                          `[WriteNode] onDragStart idx=${idx} types=`,
                          Array.from(e.dataTransfer.types || []),
                          "effectAllowed=",
                          e.dataTransfer.effectAllowed
                        );
                      }}
                      onDragEnd={(e) => {
                        console.log(
                          `[WriteNode] onDragEnd types=`,
                          Array.from(e.dataTransfer.types || []),
                          "dropEffect=",
                          e.dataTransfer.dropEffect
                        );
                      }}
                      className="cursor-grab select-none rounded-md border px-2 py-1 text-sm text-white bg-teal-500 w-fit"
                    >
                      Entrada {idx}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={saveTemplate}>
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

WriteNode.displayName = "WriteNode";
