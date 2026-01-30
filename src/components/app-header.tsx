import { Download, Upload, Settings } from "lucide-react";

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
    <header data-app-header className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 border-b border-[var(--nodi-blue-border)] bg-[var(--nodi-blue)] px-4 py-2">
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
        <div className="flex items-center gap-2 ml-4">
          <h1 className="text-xl font-semibold tracking-tight text-white">{title}</h1>

          <div className="flex flex-wrap items-center gap-2 ml-4">
            <Button
              variant="secondary"
              className="bg-transparent text-white hover:bg-white/10"
              type="button"
              onClick={onDownload}
            >
              Descargar
              <Download className="text-white" />
            </Button>

            <Button
              variant="secondary"
              className="bg-transparent text-white hover:bg-white/10 disabled:bg-gray-300 disabled:text-gray-600"
              type="button"
              onClick={onLoad}
            >
              Cargar
              <Upload className="text-white" />
            </Button>

            <Button
              variant="secondary"
              className="bg-transparent text-white hover:bg-white/10 disabled:bg-gray-300 disabled:text-gray-600"
              type="button"
              onClick={onOpenRemoteConfig}
            >
              Configurar remoto
              <Settings className="text-white" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
