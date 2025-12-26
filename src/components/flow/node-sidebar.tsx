import { useMemo } from "react";
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
  onDragStart: (event: DragEvent, item: { type: string; label: string }) => void;
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

  const filteredCategories = useMemo(() => {
    if (!normalizedSearch) {
      return categories;
    }

    return categories
      .map((category) => {
        const items = category.items.filter((item) =>
          matchesSearch(item, normalizedSearch)
        );
        return { ...category, items };
      })
      .filter((category) => category.items.length > 0);
  }, [categories, normalizedSearch]);

  if (!open) {
    return null;
  }

  return (
    <aside className="flex h-full w-72 flex-col border-r bg-background/80 backdrop-blur-sm">
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
          placeholder="Buscar nodo por nombre..."
          className="h-8 text-xs"
        />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2 text-xs">
        {filteredCategories.map((category) => (
          <div key={category.id} className="space-y-1">
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
                    <div className="font-medium leading-tight">{item.label}</div>
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
