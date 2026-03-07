import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createExtension,
  fetchExtensions,
  type ExtensionListItem,
} from "@/lib/extensions";
import { ChevronLeft, ChevronRight, Info, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CustomNodeSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddExtension?: (extension: ExtensionListItem) => boolean | Promise<boolean>;
  existingExtensionIds?: string[];
};

export function CustomNodeSearchDialog({
  open,
  onOpenChange,
  onAddExtension,
  existingExtensionIds = [],
}: CustomNodeSearchDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"search" | "create">("search");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(
    null,
  );
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createColor, setCreateColor] = useState("#3b82f6");
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
    enabled: open && mode === "search",
  });

  const createExtensionMutation = useMutation({
    mutationFn: createExtension,
    onSuccess: (createdExtension) => {
      queryClient.invalidateQueries({ queryKey: ["extensions"] });
      setMode("search");
      setSearch("");
      setDebouncedSearch("");
      setPage(1);
      setSelectedExtensionId(createdExtension.id);
      setCreateName("");
      setCreateDescription("");
      setCreateColor("#3b82f6");
      toast.success("Extensión creada, puedes agregar subflujos a ella");
    },
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
  const canCreateExtension =
    createName.trim().length > 0 && createDescription.trim().length > 0;
  const searchErrorMessage =
    error instanceof Error
      ? error.message
      : "No se pudieron cargar las extensiones.";
  const createErrorMessage =
    createExtensionMutation.error instanceof Error
      ? createExtensionMutation.error.message
      : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setSelectedExtensionId(null);
          setMode("search");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extensiones</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "search" ? "default" : "outline"}
              className={cn(
                mode === "search" ? "bg-(--nodi-blue) hover:bg-blue-600" : "",
              )}
              onClick={() => setMode("search")}
            >
              Buscar extensiones
            </Button>
            <Button
              type="button"
              variant={mode === "create" ? "default" : "outline"}
              className={cn(
                mode === "create" ? "bg-(--nodi-blue) hover:bg-blue-600" : "",
              )}
              onClick={() => setMode("create")}
            >
              Crear extension
            </Button>
          </div>

          {mode === "search" ? (
            <>
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
                  <Info
                    className="text-muted-foreground"
                    size={54}
                    strokeWidth={1.35}
                  />
                  <span className="text-muted-foreground">
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
                        <span className="font-medium">
                          {extension.authorName}
                        </span>
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
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="extension-name" className="text-sm font-medium">
                  Nombre
                </label>
                <Input
                  id="extension-name"
                  value={createName}
                  onChange={(event) => setCreateName(event.currentTarget.value)}
                  placeholder="Mi extension"
                  disabled={createExtensionMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="extension-description"
                  className="text-sm font-medium"
                >
                  Descripcion
                </label>
                <textarea
                  id="extension-description"
                  value={createDescription}
                  onChange={(event) =>
                    setCreateDescription(event.currentTarget.value)
                  }
                  placeholder="Una descripcion corta de la extension"
                  rows={3}
                  className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={createExtensionMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="extension-color"
                  className="text-sm font-medium"
                >
                  Color
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    id="extension-color"
                    type="color"
                    value={createColor}
                    onChange={(event) =>
                      setCreateColor(event.currentTarget.value)
                    }
                    className="h-10 w-16 p-1"
                    disabled={createExtensionMutation.isPending}
                  />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {createColor}
                  </span>
                </div>
              </div>

              {createErrorMessage ? (
                <p className="text-sm text-destructive">{createErrorMessage}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setMode("search")}
                  disabled={createExtensionMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-(--nodi-blue) hover:bg-blue-600"
                  disabled={
                    !canCreateExtension || createExtensionMutation.isPending
                  }
                  onClick={() => {
                    createExtensionMutation.mutate({
                      name: createName.trim(),
                      description: createDescription.trim(),
                      color: createColor,
                    });
                  }}
                >
                  {createExtensionMutation.isPending
                    ? "Creando..."
                    : "Crear extension"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
