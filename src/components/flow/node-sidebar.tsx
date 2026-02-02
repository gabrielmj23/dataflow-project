import { useMemo, useRef } from "react";
import type { DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  NodePaletteCategory,
  NodePaletteItem,
} from "../../flow/node-palette";

type NodeSidebarProps = {
  open: boolean;
  search: string;
  categories: NodePaletteCategory[];
  onSearchChange: (value: string) => void;
  onToggle: () => void;
  onDragStart: (
    event: DragEvent,
    item: { type: string; label: string },
  ) => void;
};

export function NodeSidebar({
  open,
  search,
  categories,
  onSearchChange,
  onToggle,
  onDragStart,
}: NodeSidebarProps) {
  const normalizedSearch = search.trim().toLowerCase();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sectionRefs = useMemo(
    // eslint-disable-next-line react-hooks/rules-of-hooks
    () => categories.map(() => ({ ref: useRef<HTMLDivElement>(null) })),
    [categories],
  );

  const categoryColorMap: Record<string, string> = {
    inputs: "bg-emerald-500",
    math: "bg-sky-500",
    control: "bg-orange-500",
    text: "bg-fuchsia-600",
    iteration: "bg-teal-600",
    abstraction: "bg-violet-500",
    io: "bg-rose-500",
    microbit: "bg-sky-600",
  };

  const categoryBorderMap: Record<string, string> = {
    inputs: "border-emerald-600",
    math: "border-sky-700",
    control: "border-orange-600",
    text: "border-fuchsia-700",
    iteration: "border-teal-800",
    abstraction: "border-violet-700",
    io: "border-rose-700",
    microbit: "border-sky-700",
  };

  const handleScrollToCategory = (index: number) => {
    const target = sectionRefs[index]?.ref?.current;
    const container = scrollContainerRef.current;
    if (!target || !container) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    let top = targetRect.top - containerRect.top + container.scrollTop - 2;
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (top > maxScroll) top = maxScroll;
    if (top < 0) top = 0;
    smoothScrollTo(container, top, 300);
  };

  // Smooth scroll polyfill: animates `container.scrollTop` over `duration` ms.
  const smoothScrollTo = (
    container: HTMLElement,
    top: number,
    duration = 300,
  ) => {
    const start = container.scrollTop;
    const change = top - start;
    const startTime = performance.now();
    const easeInOutQuad = (t: number) =>
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      container.scrollTop = start + change * easeInOutQuad(t);
      if (elapsed < duration) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  const filteredCategories = useMemo(() => {
    if (!normalizedSearch) {
      return categories;
    }

    return categories
      .map((category) => {
        const items = category.items.filter((item) =>
          matchesSearch(item, normalizedSearch),
        );
        return { ...category, items };
      })
      .filter((category) => category.items.length > 0);
  }, [categories, normalizedSearch]);

  if (!open) {
    return null;
  }

  return (
    <aside className="flex h-full w-80 flex-col border-r bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">
            Paleta de nodos
          </span>
          <span className="text-xs text-muted-foreground">
            Arrastra nodos al lienzo
          </span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-xs"
          onClick={onToggle}
        >
          ×
        </Button>
      </div>

      <div className="border-b px-3 py-2">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          placeholder="Buscar nodo"
          className="h-8 text-xs"
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-16 flex-col items-center gap-2 border-r bg-muted/10 px-2 py-3 h-full overflow-y-auto no-scrollbar">
          {filteredCategories.map((category, index) => {
            const color = categoryColorMap[category.id] ?? "bg-muted/10";
            const borderColor =
              categoryBorderMap[category.id] ?? "border-muted";
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => handleScrollToCategory(index)}
                className="group flex w-full flex-col items-center gap-1 rounded-md px-1.5 py-1.5 text-xs text-muted-foreground transition duration-300 ease-out hover:bg-muted cursor-pointer"
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
          className="flex-1 space-y-3 overflow-y-auto px-3 py-2 text-xs"
        >
          {filteredCategories.map((category, index) => (
            <div
              key={category.id}
              ref={sectionRefs[index]?.ref}
              className="space-y-1"
            >
              <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {category.title}
              </div>
              <div className="space-y-1">
                {category.items.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    draggable
                    onDragStart={(event: DragEvent) =>
                      onDragStart(event, { type: item.type, label: item.label })
                    }
                    className="flex w-full cursor-grab items-center justify-between rounded-md border bg-card px-2 py-1 text-left text-xs shadow-sm transition hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
                  >
                    <div>
                      <div className="font-medium leading-tight">
                        {item.label}
                      </div>
                      {item.description ? (
                        <div className="line-clamp-2 text-[0.68rem] text-muted-foreground">
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                    <span className="ml-2 text-[0.6rem] text-muted-foreground">
                      {item.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="px-1 py-2 text-[0.7rem] text-muted-foreground">
              No se encontraron nodos para "{search}".
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function matchesSearch(item: NodePaletteItem, search: string): boolean {
  const label = item.label.toLowerCase();
  const type = item.type.toLowerCase();
  const description = item.description?.toLowerCase() ?? "";

  return (
    label.includes(search) ||
    type.includes(search) ||
    (description.length > 0 && description.includes(search))
  );
}
