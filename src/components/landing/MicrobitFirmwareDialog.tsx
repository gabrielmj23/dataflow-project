import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Info } from "lucide-react";

interface MicrobitFirmwareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function MicrobitFirmwareDialog({
  open,
  onOpenChange,
  onConfirm,
}: MicrobitFirmwareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <Info className="h-5 w-5" />
            Instrucciones para Micro:bit
          </DialogTitle>
          <DialogDescription className="text-slate-600 pt-2">
            Para que NodeLand pueda comunicarse con tu tarjeta Micro:bit, debes
            instalar el firmware necesario.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mt-2">
          <p className="text-sm text-emerald-900 font-medium">
            ¿Qué debo hacer?
          </p>
          <ul className="mt-2 space-y-2 text-sm text-emerald-800 list-disc pl-5">
            <li>Haz clic en el botón de abajo para descargar el archivo.</li>
            <li>Conecta tu Micro:bit a tu computadora por USB.</li>
            <li>
              Copia o mueve el archivo descargado directamente a la unidad de
              disco de la <span className="font-medium">MICROBIT</span> en tu
              explorador de archivos.
            </li>
          </ul>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-2">
          <p className="text-sm text-amber-900 font-medium">Importante</p>
          <p className="mt-1 text-sm text-amber-800">
            Esta funcionalidad solo es compatible con tarjetas Micro:bit v2.
            Asegúrate de tener la versión correcta para evitar problemas de
            compatibilidad.
          </p>
        </div>

        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            <Download className="h-4 w-4" />
            Descargar .hex
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
