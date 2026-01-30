import * as React from "react";
import type { DragEvent } from "react";
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
import type { NodePaletteCategory, NodePaletteItem } from "@/flow/node-palette";

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
      processing: "bg-sky-500",
      control: "bg-orange-500",
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
      processing: "border-sky-700",
      control: "border-orange-600",
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
                            <div className="flex w-full items-start gap-1">
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
                              {item.templateId && onDeleteTemplate ? (
                                <button
                                  type="button"
                                  className="ml-1 self-start rounded px-1 py-0.5 text-[0.65rem] text-destructive hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDeleteTemplate(item.templateId!);
                                  }}
                                >
                                  Eliminar
                                </button>
                              ) : null}
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
