import { Download, Upload, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  nodesCount?: number;
  onDownload?: () => void;
  onLoad?: () => void;
  onOpenRemoteConfig?: () => void;
  centerTitle?: string;
};

export default function AppHeader({
  onDownload,
  onLoad,
  onOpenRemoteConfig,
  centerTitle,
}: AppHeaderProps) {
  return (
    <header
      data-app-header
      className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 border-b-[0.5px] border-(--nodi-blue-border) bg-(--nodi-blue) px-4 py-0.5"
    >
      <div className="flex items-center">
        <img src="/nodi-robot-head-nobg.png" className="h-12 mb-1" />
        <img src="/logo-nodi.png" alt="Nodi" className="h-12 mt-1" />
      </div>

      <div className="flex flex-1 items-center justify-center px-2">
        {centerTitle ? (
          <h1 className="truncate text-3xl  text-white">{centerTitle}</h1>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {onDownload && (
          <Button
            variant="secondary"
            className="bg-transparent text-white hover:bg-white/10"
            type="button"
            onClick={onDownload}
          >
            Descargar
            <Download className="text-white" />
          </Button>
        )}
        {onLoad && (
          <Button
            variant="secondary"
            className="bg-transparent text-white hover:bg-white/10 disabled:bg-gray-300 disabled:text-gray-600"
            type="button"
            onClick={onLoad}
          >
            Cargar
            <Upload className="text-white" />
          </Button>
        )}
        {onOpenRemoteConfig && (
          <Button
            variant="secondary"
            className="bg-transparent text-white hover:bg-white/10 disabled:bg-gray-300 disabled:text-gray-600"
            type="button"
            onClick={onOpenRemoteConfig}
          >
            Conectar
            <Unplug className="text-white" />
          </Button>
        )}
      </div>
    </header>
  );
}
