import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchCustomNodes, type CustomNodeSummary } from "@/lib/custom-nodes";
import { ChevronLeft, ChevronRight, Info, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type CustomNodeSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCustomNode?: (node: CustomNodeSummary) => boolean;
  existingTemplateIds?: string[];
};

function resolveTemplateId(customNode: CustomNodeSummary): string {
  try {
    const parsed = JSON.parse(customNode.code) as { templateId?: unknown };
    if (typeof parsed.templateId === "string" && parsed.templateId.trim()) {
      return parsed.templateId;
    }
  } catch {
    // no-op
  }

  return customNode.id;
}

export function CustomNodeSearchDialog({
  open,
  onOpenChange,
  onAddCustomNode,
  existingTemplateIds = [],
}: CustomNodeSearchDialogProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCustomNodeId, setSelectedCustomNodeId] = useState<
    string | null
  >(null);
  const pageSize = 8;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      window.clearTimeout(handle);
    };
  }, [search]);

  const normalizedSearch = useMemo(
    () => debouncedSearch.trim(),
    [debouncedSearch],
  );

  const {
    data: customNodes = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["custom-nodes", "search", normalizedSearch, page, pageSize],
    queryFn: () =>
      fetchCustomNodes({
        search: normalizedSearch || undefined,
        page,
        pageSize,
      }),
    enabled: open,
  });

  const canGoPrev = page > 1 && !isLoading;
  const canGoNext = !isLoading && customNodes.length >= pageSize;
  const selectedNode = useMemo(
    () => customNodes.find((item) => item.id === selectedCustomNodeId) ?? null,
    [customNodes, selectedCustomNodeId],
  );
  const selectedTemplateId = selectedNode
    ? resolveTemplateId(selectedNode)
    : "";
  const isDuplicateSelection =
    !!selectedTemplateId && existingTemplateIds.includes(selectedTemplateId);
  const canAddSelection = !!selectedNode && !isDuplicateSelection;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setSelectedCustomNodeId(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agrega nuevos nodos</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setPage(1);
              }}
              placeholder="Buscar nodo personalizado"
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando nodos...</p>
          ) : null}

          {isError ? (
            <p className="text-sm text-destructive">
              No se pudieron cargar los nodos personalizados.
            </p>
          ) : null}

          {!isLoading && !isError && customNodes.length === 0 ? (
            <div className="flex flex-col justify-center items-center pt-12 pb-14 gap-2">
              <Info
                className="text-muted-foreground"
                size={54}
                strokeWidth={1.35}
              />
              <span className="text-muted-foreground">
                No hay nodos personalizados disponibles...
              </span>
            </div>
          ) : null}

          {!isLoading && !isError && customNodes.length > 0 ? (
            <div className="grid max-h-90 grid-cols-1 gap-3 overflow-y-auto overflow-x-hidden py-2 sm:grid-cols-2">
              {customNodes.map((customNode) => (
                <div
                  key={customNode.id}
                  className={cn(
                    "flex flex-col px-2 justify-center py-3 border-2 rounded-lg transition-all hover:cursor-pointer",
                    {
                      "border-(--nodi-blue)":
                        selectedCustomNodeId === customNode.id,
                      "border-neutral-200 hover:scale-105":
                        selectedCustomNodeId !== customNode.id,
                    },
                  )}
                  onClick={() => {
                    setSelectedCustomNodeId(customNode.id);
                  }}
                >
                  <div className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl bg-violet-500 px-3 text-center text-white shadow-md self-center">
                    <span className="text-sm leading-tight line-clamp-2">
                      {customNode.name}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Por{" "}
                    <span className="font-medium">{customNode.authorName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {customNode.description}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {isDuplicateSelection ? (
            <p className="text-xs text-destructive">
              Este nodo ya está agregado en Subflujos.
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="default"
              className="bg-(--nodi-blue) hover:bg-blue-600"
              disabled={!canAddSelection}
              onClick={() => {
                if (!selectedNode || !onAddCustomNode) return;
                const added = onAddCustomNode(selectedNode);
                if (added) {
                  onOpenChange(false);
                  setSelectedCustomNodeId(null);
                }
              }}
            >
              Agregar a la paleta
            </Button>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={!canGoPrev}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-10 text-center text-sm text-muted-foreground">
                {page}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={!canGoNext}
                onClick={() => setPage((prev) => prev + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
