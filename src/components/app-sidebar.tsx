import * as React from "react";
import type { DragEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  Timer,
  Shuffle,
  Keyboard,
  Cpu,
  Plus,
  X,
  Divide,
  Percent,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Circle,
  Link2,
  Ampersand,
  ToggleRight,
  ListChecks,
  PenSquare,
  MessageSquareText,
  Volume2,
  PictureInPicture2,
  GitFork,
  Replace as ReplaceIcon,
  Eraser,
  Scissors,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { NodePaletteCategory, NodePaletteItem } from "@/flow/node-palette";
import { NODE_TYPES } from "@/common/constants";

type AppSidebarProps = {
  categories: NodePaletteCategory[];
  onDragStart: (event: DragEvent, item: NodePaletteItem) => void;
  onDeleteTemplate?: (templateId: string) => void;
  className?: string;
};

export function AppSidebar({
  categories,
  onDragStart,
  onDeleteTemplate,
  className,
}: AppSidebarProps) {
  const [search, setSearch] = React.useState("");
  const viewMode = "nodes";
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const categoryColorMap: Record<string, string> = React.useMemo(
    () => ({
      inputs: "bg-emerald-500",
      math: "bg-sky-500",
      control: "bg-orange-500",
      distribution: "bg-yellow-500",
      text: "bg-fuchsia-600",
      iteration: "bg-teal-600",
      abstraction: "bg-violet-500",
      io: "bg-rose-500",
      microbit: "bg-sky-600",
    }),
    [],
  );

  const categoryBorderMap: Record<string, string> = React.useMemo(
    () => ({
      inputs: "border-emerald-600",
      math: "border-sky-700",
      control: "border-orange-600",
      distribution: "border-yellow-600",
      text: "border-fuchsia-700",
      iteration: "border-teal-800",
      abstraction: "border-violet-700",
      io: "border-rose-700",
      microbit: "border-sky-700",
    }),
    [],
  );

  const sectionRefs = React.useMemo(
    () => categories.map(() => React.createRef<HTMLDivElement>()),
    [categories],
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredCategories = React.useMemo(() => {
    if (!normalizedSearch) {
      return categories;
    }

    return categories
      .map((category) => {
        const items = category.items.filter((item) => {
          const label = item.label.toLowerCase();
          const type = item.type.toLowerCase();
          const description = item.description?.toLowerCase() ?? "";
          return (
            label.includes(normalizedSearch) ||
            type.includes(normalizedSearch) ||
            (!!description && description.includes(normalizedSearch))
          );
        });
        return { ...category, items };
      })
      .filter((category) => category.items.length > 0);
  }, [categories, normalizedSearch]);

  const handleScrollToCategory = (index: number) => {
    const target = sectionRefs[index]?.current;
    const container = scrollContainerRef.current;
    if (!target || !container) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    let top = targetRect.top - containerRect.top + container.scrollTop - 2;
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (top > maxScroll) top = maxScroll;
    smoothScrollTo(container, top, 300);
  };

  function smoothScrollTo(element: HTMLElement, to: number, duration = 300) {
    const start = element.scrollTop;
    const change = to - start;
    // eslint-disable-next-line react-hooks/purity
    const startTime = performance.now();

    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = easeInOutCubic(t);
      element.scrollTop = Math.round(start + change * eased);
      if (elapsed < duration) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }

  return (
    <Sidebar className={className}>
      <SidebarHeader>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarInput
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Buscar nodo"
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden">
        <div className="flex h-full min-h-0">
          <div className="flex w-16 flex-col items-center gap-1 border-r bg-muted/10 px-2 py-2 h-full overflow-y-auto no-scrollbar">
            {filteredCategories.map((category, index) => {
              const color = categoryColorMap[category.id] ?? "bg-gray-500";
              const borderColor =
                categoryBorderMap[category.id] ?? "border-gray-500";
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleScrollToCategory(index)}
                  className="group flex w-full flex-col items-center gap-1 rounded-md px-1.5 py-1 text-[0.7rem] text-muted-foreground transition duration-300 ease-out hover:bg-muted cursor-pointer"
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full shadow-sm ${color} ${borderColor} border-2`}
                  />
                  <span className="text-[11px] leading-tight text-center line-clamp-2">
                    {category.title.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden pr-3"
          >
            {filteredCategories.map((category, index) => (
              <SidebarGroup key={category.id} ref={sectionRefs[index]}>
                <SidebarGroupLabel
                  className="flex cursor-pointer items-center justify-between gap-2"
                  onClick={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [category.id]: !prev[category.id],
                    }))
                  }
                >
                  <span>{category.title}</span>
                  <span className="text-muted-foreground">
                    {collapsed[category.id] ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </span>
                </SidebarGroupLabel>
                {!collapsed[category.id] && (
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-1">
                      {category.items.map((item) => (
                        <SidebarMenuItem
                          key={
                            item.templateId
                              ? `${item.type}-${item.templateId}`
                              : item.type
                          }
                        >
                          <SidebarMenuButton
                            type="button"
                            draggable
                            onDragStart={(event: DragEvent) =>
                              onDragStart(event, item)
                            }
                            className={`items-start justify-start gap-1 text-xs h-auto min-h-12 overflow-visible py-1.5 ${
                              viewMode === "nodes"
                                ? "bg-transparent hover:bg-transparent active:bg-transparent shadow-none"
                                : ""
                            }`}
                          >
                            <div className="flex w-full items-center justify-center py-1">
                              <div className="scale-100 origin-center">
                                <NodePreview
                                  type={item.type}
                                  label={item.label}
                                  isCustom={
                                    !!item.templateId && !!onDeleteTemplate
                                  }
                                  onDelete={
                                    item.templateId && onDeleteTemplate
                                      ? () => onDeleteTemplate(item.templateId!)
                                      : undefined
                                  }
                                />
                              </div>
                            </div>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            ))}

            {filteredCategories.length === 0 && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <p className="px-2 text-[0.7rem] text-muted-foreground">
                    No se encontraron nodos para "{search}".
                  </p>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
type NodePreviewProps = {
  type: string;
  label: string;
  isCustom?: boolean;
  onDelete?: () => void;
};

function NodePreview({ type, label, isCustom, onDelete }: NodePreviewProps) {
  const core = (() => {
    switch (type) {
      case "constantInput":
      case "constantNumber":
      case "constantBoolean":
      case "constantText":
      case "constantList":
      case "runtimeInput":
      case "timerInput":
      case "randomInput":
      case "choiceInput": {
        return (
          <div
            data-drag-preview
            className="node-preview flex h-20 w-20 flex-col items-center justify-center rounded-full border-emerald-600 bg-emerald-500 px-2 text-center text-white shadow-md"
          >
            {type === "timerInput" ||
            type === "randomInput" ||
            type === "runtimeInput" ||
            type === "choiceInput" ? (
              <>
                <span className="mb-1 flex items-center justify-center">
                  {type === "timerInput" && <Timer className="h-6 w-6" />}
                  {type === "randomInput" && <Shuffle className="h-6 w-6" />}
                  {type === "runtimeInput" && <Keyboard className="h-6 w-6" />}
                  {type === "choiceInput" && <Shuffle className="h-6 w-6" />}
                </span>
                <span className="px-1 text-xs leading-tight">{label}</span>
              </>
            ) : (
              <span className="px-1 text-xs leading-tight">{label}</span>
            )}
          </div>
        );
      }
      case "microbitReadButton": {
        return (
          <div
            data-drag-preview
            className="node-preview flex h-20 w-20 flex-col items-center justify-center rounded-full border-sky-700 bg-sky-600 px-2 text-center text-white shadow-md"
          >
            <span className="mb-1 flex items-center justify-center">
              <Cpu className="h-6 w-6" />
            </span>
            <span className="px-1 text-xs leading-tight">{label}</span>
          </div>
        );
      }
      case "sum":
      case "subtract":
      case "multiply":
      case "divide":
      case "mod":
      case "power":
      case "floor":
      case "ceiling":
      case "round":
      case "formulaEditor": {
        const symbolMap: Record<string, string> = {
          sum: "plus",
          subtract: "minus",
          multiply: "x",
          divide: "divide",
          mod: "mod",
          power: "power",
          floor: "floor",
          ceiling: "ceiling",
          round: "round",
          formulaEditor: "formula",
        };
        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl bg-sky-500 px-3 text-center text-white shadow-md"
          >
            <span className="text-xl font-bold leading-none">
              {symbolMap[type] === "plus" && <Plus className="h-5 w-5" />}
              {symbolMap[type] === "minus" && <span>-</span>}
              {symbolMap[type] === "x" && <X className="h-5 w-5" />}
              {symbolMap[type] === "divide" && <Divide className="h-5 w-5" />}
              {symbolMap[type] === "mod" && <Percent className="h-5 w-5" />}
              {symbolMap[type] === "power" && (
                <span className="text-xs font-bold">x²</span>
              )}
              {symbolMap[type] === "floor" && <ArrowDown className="h-5 w-5" />}
              {symbolMap[type] === "ceiling" && <ArrowUp className="h-5 w-5" />}
              {symbolMap[type] === "round" && <Circle className="h-5 w-5" />}
              {symbolMap[type] === "formula" && (
                <span className="text-xs font-bold">ƒx</span>
              )}
            </span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      case "concat":
      case "replaceText":
      case "subtractText":
      case "sliceText": {
        const symbolMap: Record<string, string> = {
          concat: "concat",
          replaceText: "replaceText",
          subtractText: "subtractText",
          sliceText: "sliceText",
        };
        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl bg-fuchsia-600 px-3 text-center text-white shadow-md"
          >
            <span className="text-xl font-bold leading-none">
              {symbolMap[type] === "concat" && <Link2 className="h-4 w-4" />}
              {symbolMap[type] === "replaceText" && (
                <ReplaceIcon className="h-5 w-5" />
              )}
              {symbolMap[type] === "subtractText" && (
                <Eraser className="h-5 w-5" />
              )}
              {symbolMap[type] === "sliceText" && (
                <Scissors className="h-5 w-5" />
              )}
            </span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      case "comparison":
      case "and":
      case "nand":
      case "or":
      case "nor":
      case "xor":
      case "not":
      case "switch":
      case "conditionalPair":
      case NODE_TYPES.SCATTER_NODE:
      case NODE_TYPES.GATHER_NODE: {
        const symbolMap: Record<string, string> = {
          comparison: "comparison",
          and: "and",
          nand: "nand",
          or: "or",
          nor: "nor",
          xor: "xor",
          not: "not",
          switch: "switch",
          conditionalPair: "conditionalPair",
          [NODE_TYPES.SCATTER_NODE]: NODE_TYPES.SCATTER_NODE,
          [NODE_TYPES.GATHER_NODE]: NODE_TYPES.GATHER_NODE,
        };

        if (type === NODE_TYPES.SCATTER_NODE) {
          return (
            <div
              data-drag-preview
              className="node-preview relative flex h-24 w-16 flex-col items-center justify-center rounded-none border-yellow-600 bg-yellow-500 px-5 text-center text-white shadow-md"
              style={{
                clipPath: "polygon(0% 25%, 100% 0%, 100% 100%, 0% 75%)",
              }}
            >
              <span className="mb-1 flex items-center justify-center">
                <GitFork className="h-5 w-5 rotate-90" />
              </span>
              <span className="text-[0.65rem] leading-tight">{label}</span>
            </div>
          );
        }

        if (type === NODE_TYPES.GATHER_NODE) {
          return (
            <div
              data-drag-preview
              className="node-preview relative flex h-24 w-16 flex-col items-center justify-center rounded-none border-yellow-600 bg-yellow-500 px-5 text-center text-white shadow-md"
              style={{
                clipPath: "polygon(0% 0%, 100% 25%, 100% 75%, 0% 100%)",
              }}
            >
              <span className="mb-1 flex items-center justify-center">
                <GitFork className="h-5 w-5 -rotate-90" />
              </span>
              <span className="text-[0.65rem] leading-tight">{label}</span>
            </div>
          );
        }

        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl bg-orange-500 px-3 text-center text-white shadow-md"
          >
            <span className="text-xl font-bold leading-none">
              {symbolMap[type] === "comparison" && (
                <span className="-rotate-90 text-2xl font-bold">=</span>
              )}
              {symbolMap[type] === "and" && <Ampersand className="h-5 w-5" />}
              {symbolMap[type] === "nand" && (
                <span className="text-xs font-bold">⊼</span>
              )}
              {symbolMap[type] === "or" && (
                <span className="text-xs font-bold">∨</span>
              )}
              {symbolMap[type] === "nor" && (
                <span className="text-xs font-bold">⊽</span>
              )}
              {symbolMap[type] === "xor" && (
                <span className="text-xs font-bold">⊕</span>
              )}
              {symbolMap[type] === "not" && (
                <span className="text-xs font-bold">¬</span>
              )}
              {symbolMap[type] === "switch" && (
                <ToggleRight className="h-4 w-4" />
              )}
              {symbolMap[type] === "conditionalPair" && (
                <span className="flex items-center gap-1">
                  <ListChecks className="h-4 w-4" />
                  <Shuffle className="h-4 w-4" />
                </span>
              )}
              {symbolMap[type] === NODE_TYPES.SCATTER_NODE && (
                <span>
                  <GitFork className="h-4 w-4 rotate-90" />
                </span>
              )}
            </span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      case "sequence":
      case "pulseSequence":
      case "zip":
      case "unzip":
      case "filter":
      case "map":
      case "sortList":
      case "accumulate":
      case "count": {
        const symbolMap: Record<string, string> = {
          sequence: "1..N",
          pulseSequence: "1..N",
          zip: "⇆",
          unzip: "⇅",
          filter: "↓",
          map: "↦",
          sortList: "sort",
          accumulate: "Σ",
          count: "#",
        };
        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl bg-teal-600 px-3 text-center text-white shadow-md"
          >
            <span className="text-xl font-bold leading-none">
              {symbolMap[type] === "sort" ? (
                <ArrowUpDown className="h-5 w-5" />
              ) : (
                (symbolMap[type] ?? "")
              )}
            </span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      case "write": {
        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-24 flex-col items-center justify-center gap-0.5 rounded-2xl bg-rose-500 px-3 text-center text-white shadow-md"
          >
            <span className="text-xl font-bold leading-none">
              <PenSquare className="h-5 w-5" />
            </span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      case "microbitWrite": {
        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl border border-sky-700 bg-sky-600 px-3 text-center text-white shadow-md"
          >
            <span className="text-xl font-bold leading-none">
              <MessageSquareText className="h-5 w-5" />
            </span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      case "microbitSound": {
        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl border border-sky-700 bg-sky-600 px-3 text-center text-white shadow-md"
          >
            <span className="text-xl font-bold leading-none">
              <Volume2 className="h-5 w-5" />
            </span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      case "subflow": {
        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl bg-violet-500 px-3 text-center text-white shadow-md"
          >
            <span className="text-xl font-bold leading-none">
              <PictureInPicture2 className="h-6 w-6" />
            </span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      default:
        return (
          <div
            data-drag-preview
            className="node-preview flex h-18 w-32 items-center justify-center rounded-lg border border-dashed text-xs border-violet-700 bg-violet-500 text-white shadow-md"
          >
            {label}
          </div>
        );
    }
  })();

  if (!isCustom || !onDelete) {
    return core;
  }

  return (
    <div className="relative inline-block">
      {core}
      <button
        type="button"
        className="absolute right-0 top-0 z-10 -translate-y-1/2 translate-x-1/2 rounded-full bg-destructive px-1 py-px text-[0.6rem] leading-none shadow text-white hover:cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </div>
  );
}
