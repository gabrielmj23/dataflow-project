import * as React from "react";
import type { DragEvent } from "react";
import {
  Ampersand,
  Divide,
  Link2,
  PenSquare,
  Plus,
  Shuffle,
  Timer,
  ToggleRight,
  X,
} from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide-react";

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
import type { NodePaletteCategory } from "@/flow/node-palette";

type AppSidebarProps = {
  categories: NodePaletteCategory[];
  onDragStart: (event: DragEvent, item: { type: string; label: string }) => void;
};

export function AppSidebar({ categories, onDragStart }: AppSidebarProps) {
  const [search, setSearch] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"text" | "nodes">("nodes");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

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

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between gap-2">
            <span>Paleta de nodos</span>
            <span className="inline-flex rounded-md border bg-background p-0.5 text-[0.65rem]">
              <button
                type="button"
                onClick={() => setViewMode("text")}
                className={`px-1.5 py-0.5 rounded-sm ${
                  viewMode === "text"
                    ? "bg-foreground text-background"
                    : "text-foreground/70 hover:bg-muted"
                }`}
              >
                Texto
              </button>
              <button
                type="button"
                onClick={() => setViewMode("nodes")}
                className={`px-1.5 py-0.5 rounded-sm ${
                  viewMode === "nodes"
                    ? "bg-foreground text-background"
                    : "text-foreground/70 hover:bg-muted"
                }`}
              >
                Nodos
              </button>
            </span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarInput
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Buscar nodo por nombre..."
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarHeader>

      <SidebarContent>
        {filteredCategories.map((category) => (
          <SidebarGroup key={category.id}>
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
                    <SidebarMenuItem key={item.type}>
                    <SidebarMenuButton
                      type="button"
                      draggable
                      onDragStart={(event: DragEvent) =>
                        onDragStart(event, { type: item.type, label: item.label })
                      }
                      className={`items-start justify-start gap-1 text-xs h-auto min-h-[3rem] overflow-visible py-1.5 ${
                        viewMode === "nodes"
                          ? "bg-transparent hover:bg-transparent active:bg-transparent shadow-none"
                          : ""
                      }`}
                    >
                      {viewMode === "text" ? (
                        <div className="flex flex-1 flex-col gap-0.5">
                          <span className="font-medium leading-snug">
                            {item.label}
                          </span>
                          {item.description ? (
                            <span className="text-[0.75rem] leading-snug text-foreground/80 whitespace-normal">
                              {item.description}
                            </span>
                          ) : null}
                          <span className="mt-0.5 text-[0.65rem] text-muted-foreground">
                            {item.type}
                          </span>
                        </div>
                      ) : (
                        <div className="flex w-full items-center justify-center py-1">
                          <div className="scale-100 origin-center">
                            <NodePreview type={item.type} label={item.label} />
                          </div>
                        </div>
                      )}
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
      </SidebarContent>
    </Sidebar>
  );
}

type NodePreviewProps = {
  type: string;
  label: string;
};

function NodePreview({ type, label }: NodePreviewProps) {
  switch (type) {
    case "constantInput":
    case "timerInput":
    case "randomInput": {
      return (
        <div className="flex h-18 w-18 flex-col items-center justify-center rounded-full bg-emerald-500 px-2 text-center text-white shadow-md">
          <span className="mb-1 flex items-center justify-center">
            {type === "constantInput" && (
              <span className="text-lg font-bold">0</span>
            )}
            {type === "timerInput" && <Timer className="h-6 w-6" />}
            {type === "randomInput" && <Shuffle className="h-6 w-6" />}
          </span>
          <span className="px-1 text-[0.7rem] leading-tight">{label}</span>
        </div>
      );
    }
    case "sum":
    case "subtract":
    case "multiply":
    case "divide":
    case "power":
    case "concat": {
      const symbolMap: Record<string, string> = {
        sum: "plus",
        subtract: "minus",
        multiply: "x",
        divide: "divide",
        power: "power",
        concat: "concat",
      };
      return (
        <div className="flex h-18 w-32 flex-col items-center justify-center gap-0.5 rounded-2xl bg-sky-500 px-3 text-center text-white shadow-md">
          <span className="text-xl font-bold leading-none">
            {symbolMap[type] === "plus" && <Plus className="h-6 w-6" />}
            {symbolMap[type] === "minus" && <span>-</span>}
            {symbolMap[type] === "x" && <X className="h-6 w-6" />}
            {symbolMap[type] === "divide" && <Divide className="h-6 w-6" />}
            {symbolMap[type] === "power" && (
              <span className="text-sm font-bold">x²</span>
            )}
            {symbolMap[type] === "concat" && <Link2 className="h-5 w-5" />}
          </span>
          <span className="text-[0.75rem] leading-tight">{label}</span>
        </div>
      );
    }
    case "comparison":
    case "and":
    case "or":
    case "not":
    case "switch": {
      const symbolMap: Record<string, string> = {
        comparison: "comparison",
        and: "and",
        or: "or",
        not: "not",
        switch: "switch",
      };
      return (
        <div className="flex h-18 w-32 flex-col items-center justify-center gap-0.5 rounded-2xl bg-orange-500 px-3 text-center text-white shadow-md">
          <span className="text-xl font-bold leading-none">
            {symbolMap[type] === "comparison" && (
              <span className="-rotate-90 text-2xl font-bold">=</span>
            )}
            {symbolMap[type] === "and" && <Ampersand className="h-6 w-6" />}
            {symbolMap[type] === "or" && <span className="text-sm font-bold">∨</span>}
            {symbolMap[type] === "not" && <span className="text-sm font-bold">¬</span>}
            {symbolMap[type] === "switch" && (
              <ToggleRight className="h-5 w-5" />
            )}
          </span>
          <span className="text-[0.75rem] leading-tight">{label}</span>
        </div>
      );
    }
    case "sequence":
    case "zip":
    case "filter":
    case "accumulate":
    case "count": {
      const symbolMap: Record<string, string> = {
        sequence: "1..N",
        zip: "⇆",
        filter: "↓",
        accumulate: "Σ",
        count: "#",
      };
      return (
        <div className="flex h-18 w-32 flex-col items-center justify-center gap-0.5 rounded-2xl bg-teal-600 px-3 text-center text-white shadow-md">
          <span className="text-xl font-bold leading-none">
            {symbolMap[type] ?? ""}
          </span>
          <span className="text-[0.75rem] leading-tight">{label}</span>
        </div>
      );
    }
    case "write": {
      return (
        <div className="flex h-18 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl bg-rose-500 px-3 text-center text-white shadow-md">
          <span className="text-xl font-bold leading-none">
            <PenSquare className="h-6 w-6" />
          </span>
          <span className="text-[0.75rem] leading-tight">{label}</span>
        </div>
      );
    }
    default:
      return (
        <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
          {label}
        </div>
      );
  }
}
