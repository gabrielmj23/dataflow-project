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
  ArrowUpAZ,
  ArrowLeft,
  ArrowRight,
  EqualApproximately,
  Funnel,
  SquareFunction,
  Link2,
  Ampersand,
  ToggleRight,
  ListChecks,
  PenSquare,
  MessageSquareText,
  Volume2,
  Thermometer,
  PictureInPicture2,
  Copy,
  GitFork,
  Replace as ReplaceIcon,
  Eraser,
  Search,
  Scissors,
  Dices,
  Split,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isNodeVisibleInLevel,
  type AbstractionLevel,
  type NodePaletteCategory,
  type NodePaletteItem,
} from "@/flow/node-palette";
import { NODE_TYPES } from "@/common/constants";
import { CustomNodeSearchDialog } from "@/components/custom-nodes/CustomNodeSearchDialog";
import type { ExtensionListItem } from "@/lib/extensions";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  categories: NodePaletteCategory[];
  onDragStart: (event: DragEvent, item: NodePaletteItem) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onAddExtension?: (extension: ExtensionListItem) => boolean | Promise<boolean>;
  existingExtensionIds?: string[];
  showAbstractionFilter?: boolean;
  className?: string;
};

export function AppSidebar({
  categories,
  onDragStart,
  onDeleteTemplate,
  onAddExtension,
  existingExtensionIds = [],
  showAbstractionFilter = true,
  className,
}: AppSidebarProps) {
  const [search, setSearch] = React.useState("");
  const [abstractionLevel, setAbstractionLevel] =
    React.useState<AbstractionLevel>(3);
  const [customNodeDialogOpen, setCustomNodeDialogOpen] = React.useState(false);
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
    return categories
      .map((category) => {
        const items = (category.items ?? []).filter((item) => {
          if (
            showAbstractionFilter &&
            !isNodeVisibleInLevel(item.type, abstractionLevel)
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          const label = item.label.toLowerCase();
          const type = item.type.toLowerCase();
          const description = item.description?.toLowerCase() ?? "";
          return (
            label.includes(normalizedSearch) ||
            type.includes(normalizedSearch) ||
            (!!description && description.includes(normalizedSearch))
          );
        });

        const subcategories = (category.subcategories ?? [])
          .map((sub) => {
            const subItems = (sub.items ?? []).filter((item) => {
              if (
                showAbstractionFilter &&
                !isNodeVisibleInLevel(item.type, abstractionLevel)
              ) {
                return false;
              }

              if (!normalizedSearch) return true;

              const label = item.label.toLowerCase();
              const type = item.type.toLowerCase();
              const description = item.description?.toLowerCase() ?? "";
              return (
                label.includes(normalizedSearch) ||
                type.includes(normalizedSearch) ||
                (!!description && description.includes(normalizedSearch))
              );
            });
            return { ...sub, items: subItems };
          })
          .filter((s) => s.items.length > 0);

        return { ...category, items, subcategories };
      })
      .filter(
        (category) =>
          category.items.length > 0 ||
          (category.subcategories && category.subcategories.length > 0),
      );
  }, [abstractionLevel, categories, normalizedSearch, showAbstractionFilter]);

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
            {showAbstractionFilter && (
              <>
                <p className="mt-2 px-1 text-[11px] font-medium text-muted-foreground">
                  Nivel de abstracción
                </p>
                <div className="mx-auto mt-1 w-40 overflow-hidden rounded-full border border-border">
                  <div className="grid grid-cols-3">
                    {([1, 2, 3] as const).map((level, index) => {
                      const active = level <= abstractionLevel;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setAbstractionLevel(level)}
                          className={cn(
                            "h-7 text-xs font-semibold transition-colors hover:cursor-pointer",
                            index > 0 ? "border-l border-border" : "",
                            active
                              ? "bg-(--nodi-blue) text-white"
                              : "bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
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
              const hasCustomAccent = Boolean(category.accentColor);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleScrollToCategory(index)}
                  className="group flex w-full flex-col items-center gap-1 rounded-md px-1.5 py-1 text-[0.7rem] text-muted-foreground transition duration-300 ease-out hover:bg-muted cursor-pointer"
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full shadow-sm border-2",
                      hasCustomAccent ? "" : `${color} ${borderColor}`,
                    )}
                    style={
                      hasCustomAccent
                        ? {
                            backgroundColor: category.accentColor,
                            borderColor: category.accentColor,
                          }
                        : undefined
                    }
                  />
                  <span className="text-[11px] leading-tight text-center line-clamp-2">
                    {category.title.split(" ")[0]}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustomNodeDialogOpen(true)}
              className="group flex w-full flex-col items-center gap-1 rounded-md px-1.5 py-1 text-[0.7rem] text-muted-foreground transition duration-300 ease-out hover:bg-muted cursor-pointer"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-neutral-400 text-neutral-400 shadow-sm">
                <Plus className="h-4 w-4" />
              </span>
              <span className="text-[11px] leading-tight text-center line-clamp-2">
                Extensiones
              </span>
            </button>
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
                                  accentColor={item.accentColor}
                                  description={item.description}
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

                      {/* Render subcategories (if any) */}
                      {category.subcategories?.map((sub) => (
                        <div key={sub.id} className="px-2">
                          <div className="mb-1 mt-2 text-[11px] font-semibold text-muted-foreground">
                            {sub.title}
                          </div>
                          {sub.items.map((item) => (
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
                                className={`items-start justify-start gap-1 text-xs h-auto min-h-12 overflow-visible py-1.5 pl-3 ${
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
                                      accentColor={item.accentColor}
                                      description={item.description}
                                      isCustom={
                                        !!item.templateId && !!onDeleteTemplate
                                      }
                                      onDelete={
                                        item.templateId && onDeleteTemplate
                                          ? () =>
                                              onDeleteTemplate(item.templateId!)
                                          : undefined
                                      }
                                    />
                                  </div>
                                </div>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </div>
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
      <CustomNodeSearchDialog
        open={customNodeDialogOpen}
        onOpenChange={setCustomNodeDialogOpen}
        onAddExtension={onAddExtension}
        existingExtensionIds={existingExtensionIds}
      />
    </Sidebar>
  );
}
type NodePreviewProps = {
  type: string;
  label: string;
  accentColor?: string;
  description?: string;
  isCustom?: boolean;
  onDelete?: () => void;
};

function NodePreview({
  type,
  label,
  accentColor,
  description,
  isCustom,
  onDelete,
}: NodePreviewProps) {
  const [isInfoVisible, setIsInfoVisible] = React.useState(false);

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
                  {type === "randomInput" && <Dices className="h-6 w-6" />}
                  {type === "runtimeInput" && <Keyboard className="h-6 w-6" />}
                  {type === "choiceInput" && <Dices className="h-6 w-6" />}
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
      case "microbitReadTemperature": {
        return (
          <div
            data-drag-preview
            className="node-preview flex h-20 w-20 flex-col items-center justify-center rounded-full border-sky-700 bg-sky-600 px-2 text-center text-white shadow-md"
          >
            <span className="mb-1 flex items-center justify-center">
              <Thermometer className="h-6 w-6" />
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
      case "mathOperation":
      case "root":
      case "logarithm":
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
          mathOperation: "mathOperation",
          root: "root",
          logarithm: "logarithm",
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
            <span className="text-2xl font-bold leading-none">
              {symbolMap[type] === "plus" && <Plus className="h-5 w-5" />}
              {symbolMap[type] === "minus" && <span>-</span>}
              {symbolMap[type] === "x" && <X className="h-5 w-5" />}
              {symbolMap[type] === "divide" && <Divide className="h-5 w-5" />}
              {symbolMap[type] === "mod" && <Percent className="h-5 w-5" />}
              {symbolMap[type] === "power" && (
                <span className="text-base font-normal leading-none">xⁿ</span>
              )}
              {symbolMap[type] === "mathOperation" && (
                <span className="text-base font-normal leading-none">±×÷</span>
              )}
              {symbolMap[type] === "root" && (
                <span className="text-base font-normal leading-none">√</span>
              )}
              {symbolMap[type] === "logarithm" && (
                <span className="text-xs font-semibold leading-none">log</span>
              )}
              {symbolMap[type] === "floor" && (
                <span className="text-sm font-normal leading-none">⎣ ⎦</span>
              )}
              {symbolMap[type] === "ceiling" && (
                <span className="text-sm font-normal leading-none">⎡ ⎤</span>
              )}
              {symbolMap[type] === "round" && (
                <EqualApproximately className="h-5 w-5" />
              )}
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
            <span className="text-2xl font-bold leading-none">
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
      case "comparisonEqual":
      case "comparisonNotEqual":
      case "comparisonLess":
      case "comparisonLessOrEqual":
      case "comparisonGreater":
      case "comparisonGreaterOrEqual":
      case "and":
      case "nand":
      case "or":
      case "nor":
      case "xor":
      case "not":
      case "desvio":
      case "switch":
      case "conditionalPair": {
        const symbolMap: Record<string, string> = {
          comparison: "comparison",
          comparisonEqual: "comparisonEqual",
          comparisonNotEqual: "comparisonNotEqual",
          comparisonLess: "comparisonLess",
          comparisonLessOrEqual: "comparisonLessOrEqual",
          comparisonGreater: "comparisonGreater",
          comparisonGreaterOrEqual: "comparisonGreaterOrEqual",
          and: "and",
          nand: "nand",
          or: "or",
          nor: "nor",
          xor: "xor",
          not: "not",
          desvio: "desvio",
          switch: "switch",
          conditionalPair: "conditionalPair",
        };

        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl bg-orange-500 px-3 text-center text-white shadow-md"
          >
            <span className="text-2xl font-bold leading-none">
              {symbolMap[type] === "comparison" && (
                <span className="-rotate-90 text-xl font-bold">{"> < ="}</span>
              )}
              {symbolMap[type] === "comparisonEqual" && (
                <span className="text-2xl font-bold leading-none">=</span>
              )}
              {symbolMap[type] === "comparisonNotEqual" && (
                <span className="text-2xl font-bold leading-none">≠</span>
              )}
              {symbolMap[type] === "comparisonLess" && (
                <span className="text-2xl font-bold leading-none">{"<"}</span>
              )}
              {symbolMap[type] === "comparisonLessOrEqual" && (
                <span className="text-2xl font-bold leading-none">{"≤"}</span>
              )}
              {symbolMap[type] === "comparisonGreater" && (
                <span className="text-2xl font-bold leading-none">{">"}</span>
              )}
              {symbolMap[type] === "comparisonGreaterOrEqual" && (
                <span className="text-2xl font-bold leading-none">{"≥"}</span>
              )}
              {symbolMap[type] === "and" && <Ampersand className="h-7 w-7" />}
              {symbolMap[type] === "nand" && (
                <span className="text-xl font-medium leading-none">⊼</span>
              )}
              {symbolMap[type] === "or" && (
                <span className="text-xl font-medium leading-none">∨</span>
              )}
              {symbolMap[type] === "nor" && (
                <span className="text-xl font-medium leading-none">⊽</span>
              )}
              {symbolMap[type] === "xor" && (
                <span className="text-xl font-medium leading-none">⊕</span>
              )}
              {symbolMap[type] === "not" && (
                <span className="text-xl font-medium leading-none">¬</span>
              )}
              {symbolMap[type] === "desvio" && (
                <span className="text-lg font-medium leading-none">
                  <Split className="rotate-90" />
                </span>
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
            </span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      case NODE_TYPES.REPLICATE_FLOW:
      case NODE_TYPES.SCATTER_NODE:
      case NODE_TYPES.GATHER_NODE: {
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
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-none border border-yellow-600 bg-yellow-500 px-3 text-center text-white shadow-md"
          >
            <span className="text-2xl font-bold leading-none">
              <Copy className="h-5 w-5 rotate-90" />
            </span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      case "pulseSequence": {
        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl border-emerald-600 bg-emerald-500 px-3 text-center text-white shadow-md"
          >
            <span className="text-2xl font-bold leading-none">1..N</span>
            <span className="text-[0.65rem] leading-tight">{label}</span>
          </div>
        );
      }
      case "sequence":
      case "zip":
      case "unzip":
      case "filter":
      case "map":
      case "sortList":
      case "accumulate":
      case "product":
      case "count":
      case "listFirst":
      case "listLast":
      case "listAtPosition":
      case "listFindElement":
      case "listRemoveFirst":
      case "listRemoveLast":
      case "listPrepend":
      case "listAppend":
      case "listIsEmpty":
      case "listReverse":
      case "splitList":
      case "listEvenPositions":
      case "listOddPositions": {
        const symbolMap: Record<string, string> = {
          sequence: "1..N",
          pulseSequence: "1..N",
          zip: "⇆",
          unzip: "⇅",
          filter: "↓",
          map: "↦",
          sortList: "sort",
          accumulate: "Σ",
          product: "Π",
          count: "#",
          listFirst: "1°",
          listLast: "N°",
          listRemoveLast: "N°−",
          listReverse: "⇄",
          splitList: "A→[]",
          listEvenPositions: "2n",
          listOddPositions: "2n+1",
        };
        return (
          <div
            data-drag-preview
            className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl bg-teal-600 px-3 text-center text-white shadow-md"
          >
            <span className="text-2xl font-bold leading-none">
              {type === "listAtPosition" ? (
                <Search className="h-5 w-5" />
              ) : type === "listFindElement" ? (
                <Search className="h-5 w-5" />
              ) : type === "listRemoveFirst" ? (
                <Scissors className="h-5 w-5" />
              ) : type === "listPrepend" ? (
                <span className="inline-flex items-center gap-0.5">
                  <Plus className="h-4 w-4" />
                  <ArrowLeft className="h-4 w-4" />
                </span>
              ) : type === "listAppend" ? (
                <span className="inline-flex items-center gap-0.5">
                  <Plus className="h-4 w-4" />
                  <ArrowRight className="h-4 w-4" />
                </span>
              ) : type === "listIsEmpty" ? (
                <ListChecks className="h-5 w-5" />
              ) : symbolMap[type] === "sort" ? (
                <ArrowUpAZ className="h-5 w-5" />
              ) : type === "zip" ? (
                <img
                  src="/zipper.png"
                  className="h-10 -mb-2.25 -mt-2.5 -rotate-90"
                />
              ) : type === "unzip" ? (
                <img
                  src="/zipper.png"
                  className="h-11 -mb-2.25 -mt-2.5 rotate-90"
                />
              ) : type === "filter" ? (
                <Funnel className="h-5 w-5" />
              ) : type === "map" ? (
                <SquareFunction className="h-5 w-5" />
              ) : symbolMap[type] === "1..N" ? (
                <span className="font-semibold">1..N</span>
              ) : type === "splitList" ||
                type === "listEvenPositions" ||
                type === "listOddPositions" ? (
                <span className="text-lg font-medium leading-none">
                  {symbolMap[type]}
                </span>
              ) : symbolMap[type] === "#" ||
                symbolMap[type] === "1°" ||
                symbolMap[type] === "N°" ? (
                <span className="text-xl font-medium leading-none">
                  {symbolMap[type]}
                </span>
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
            <span className="text-2xl font-bold leading-none">
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
            <span className="text-2xl font-bold leading-none">
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
            <span className="text-2xl font-bold leading-none">
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
            className={cn(
              "node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl px-3 text-center text-white shadow-md",
              !accentColor && "bg-violet-500",
            )}
            style={
              accentColor
                ? {
                    backgroundColor: accentColor,
                    backgroundImage: `linear-gradient(135deg, ${accentColor} 0%, rgba(0,0,0,0.2) 100%)`,
                  }
                : undefined
            }
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
            className={cn(
              "node-preview flex h-18 w-32 items-center justify-center rounded-lg border border-dashed text-xs text-white shadow-md",
              !accentColor && "border-violet-700 bg-violet-500",
            )}
            style={
              accentColor
                ? {
                    backgroundColor: accentColor,
                    borderColor: "rgba(0,0,0,0.3)",
                  }
                : undefined
            }
          >
            {label}
          </div>
        );
    }
  })();
  const nodeDescription = description?.trim() || "Sin descripción disponible.";

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsInfoVisible(true)}
      onMouseLeave={() => setIsInfoVisible(false)}
      onFocusCapture={() => setIsInfoVisible(true)}
      onBlurCapture={() => setIsInfoVisible(false)}
    >
      {core}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            draggable={false}
            aria-label={`Información de ${label}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={cn(
              "absolute right-0 top-0 z-10 -translate-y-1/2 translate-x-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 bg-background text-slate-500 shadow-sm transition-opacity duration-150",
              isInfoVisible
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none",
            )}
          >
            <span className="text-sm font-semibold leading-none">i</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-56">
          {nodeDescription}
        </TooltipContent>
      </Tooltip>
      {isCustom && onDelete ? (
        <button
          type="button"
          className="absolute left-0 top-0 z-10 -translate-y-1/2 -translate-x-1/2 rounded-full bg-destructive px-1 py-px text-[0.6rem] leading-none shadow text-white hover:cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
