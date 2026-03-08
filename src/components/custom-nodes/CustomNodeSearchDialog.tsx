import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchExtensions, type ExtensionListItem } from "@/lib/extensions";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

type CustomNodeSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddExtension?: (extension: ExtensionListItem) => Promise<boolean> | boolean;
  existingExtensionIds?: string[];
};

export function CustomNodeSearchDialog({
  open,
  onOpenChange,
  onAddExtension,
  existingExtensionIds = [],
}: CustomNodeSearchDialogProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(
    null,
  );
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
    data: extensions = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["extensions", "search", normalizedSearch, page, pageSize],
    queryFn: () =>
      fetchExtensions({
        search: normalizedSearch || undefined,
        page,
        pageSize,
      }),
    enabled: open,
  });

  const canGoPrev = page > 1 && !isLoading;
  const canGoNext = !isLoading && extensions.length >= pageSize;
  const selectedExtension = useMemo(
    () => extensions.find((item) => item.id === selectedExtensionId) ?? null,
    [extensions, selectedExtensionId],
  );
  const isDuplicateSelection =
    !!selectedExtension && existingExtensionIds.includes(selectedExtension.id);
  const canAddSelection = !!selectedExtension && !isDuplicateSelection;
  const searchErrorMessage =
    error instanceof Error
      ? error.message
      : "No se pudieron cargar las extensiones.";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setSelectedExtensionId(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extensiones</DialogTitle>
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
              placeholder="Buscar extensión"
              className="pl-9"
            />
          </div>

          <div className="rounded-md border border-blue-100 bg-blue-50/50 p-3 text-center">
            <p className="text-xs text-blue-700">
              Para crear una extensión, primero comparte un subflujo desde su
              menú.
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Cargando extensiones...
            </p>
          ) : null}

          {isError ? (
            <p className="text-sm text-destructive">{searchErrorMessage}</p>
          ) : null}

          {!isLoading && !isError && extensions.length === 0 ? (
            <div className="flex flex-col justify-center items-center pt-12 pb-14 gap-2">
              <Search
                className="text-muted-foreground opacity-20"
                size={54}
                strokeWidth={1.35}
              />
              <span className="text-muted-foreground text-sm">
                No hay extensiones disponibles...
              </span>
            </div>
          ) : null}

          {!isLoading && !isError && extensions.length > 0 ? (
            <div className="grid max-h-90 grid-cols-1 gap-3 overflow-y-auto overflow-x-hidden py-2 sm:grid-cols-2">
              {extensions.map((extension) => (
                <button
                  type="button"
                  key={extension.id}
                  className={cn(
                    "flex flex-col px-2 justify-center py-3 border-2 rounded-lg transition-all text-left",
                    {
                      "border-(--nodi-blue)":
                        selectedExtensionId === extension.id,
                      "border-neutral-200 hover:scale-105 hover:cursor-pointer":
                        selectedExtensionId !== extension.id,
                    },
                  )}
                  onClick={() => {
                    setSelectedExtensionId(extension.id);
                  }}
                >
                  <div
                    className="node-preview flex h-14 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl px-3 text-center text-white shadow-md self-center"
                    style={{ backgroundColor: extension.color }}
                  >
                    <span className="text-sm leading-tight line-clamp-2">
                      {extension.name}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Por{" "}
                    <span className="font-medium">{extension.authorName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {extension.description}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {isDuplicateSelection ? (
            <p className="text-xs text-destructive">
              Esta extension ya esta agregada en la paleta.
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="default"
              className="bg-(--nodi-blue) hover:bg-blue-600"
              disabled={!canAddSelection}
              onClick={async () => {
                if (!selectedExtension || !onAddExtension) return;
                const added = await onAddExtension(selectedExtension);
                if (added) {
                  onOpenChange(false);
                  setSelectedExtensionId(null);
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
                aria-label="Pagina anterior"
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
                aria-label="Pagina siguiente"
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
