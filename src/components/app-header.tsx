import { Play, Square, Download, Upload, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type AppHeaderProps = {
  title?: string;
  nodesCount?: number;
  onRun?: () => void;
  onStop?: () => void;
  onDownload?: () => void;
  onLoad?: () => void;
  onOpenRemoteConfig?: () => void;
  isRunning?: boolean;
};

export default function AppHeader({
  title = "Nodi",
  nodesCount = 0,
  onRun,
  onStop,
  onDownload,
  onLoad,
  onOpenRemoteConfig,
  isRunning = false,
}: AppHeaderProps) {
  return (
    <header data-app-header className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 border-b bg-background px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80 text-white">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 3v18l15-9L5 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              className="hover:cursor-pointer shadow-md"
              type="button"
              onClick={onRun}
              disabled={nodesCount === 0 || isRunning}
            >
              Ejecutar
              <Play fill="oklch(72.3% 0.219 149.579)" className="text-green-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ejecutar programa</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              className="hover:cursor-pointer shadow-md"
              type="button"
              onClick={onStop}
              disabled={nodesCount === 0}
              title="Detener ejecución y resetear nodos"
            >
              Detener
              <Square className="text-red-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Detener ejecución</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              className="hover:cursor-pointer shadow-md"
              type="button"
              onClick={onDownload}
              disabled={nodesCount === 0}
            >
              Descargar
              <Download />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Descargar programa</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              className="hover:cursor-pointer shadow-md"
              type="button"
              onClick={onLoad}
            >
              Cargar
              <Upload />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cargar archivo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              className="hover:cursor-pointer shadow-md"
              type="button"
              onClick={onOpenRemoteConfig}
            >
              Configurar remoto
              <Settings />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Configurar remoto</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
