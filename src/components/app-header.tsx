import { Play, Pause, Download, Upload, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";

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
            <Button
              variant="secondary"
              className="bg-green-600 text-white hover:bg-green-700"
              type="button"
              onClick={onRun}
              disabled={nodesCount === 0 || isRunning}
            >
              Ejecutar
              <Play fill="white" className="text-white" />
            </Button>

            <Button
              variant="secondary"
              className="bg-red-600 text-white hover:bg-red-700"
              type="button"
              onClick={onStop}
              disabled={!isRunning}
            >
              Detener
              <Pause className="text-white" />
            </Button>

            <Button
              variant="secondary"
              className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-600"
              type="button"
              onClick={onDownload}
              disabled={nodesCount === 0}
            >
              Descargar
              <Download className="text-white" />
            </Button>

            <Button
              variant="secondary"
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-600"
              type="button"
              onClick={onLoad}
            >
              Cargar
              <Upload className="text-white" />
            </Button>

            <Button
              variant="secondary"
              className="bg-slate-600 text-white hover:bg-slate-700 disabled:bg-gray-300 disabled:text-gray-600"
              type="button"
              onClick={onOpenRemoteConfig}
            >
              Configurar remoto
              <Settings className="text-white" />
            </Button>
      </div>
    </header>
  );
}
