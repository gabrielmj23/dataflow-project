import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type LevelCompleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoHome: () => void;
  onGoEditor: () => void;
};

export default function LevelCompleteDialog({
  open,
  onOpenChange,
  onGoHome,
  onGoEditor,
}: LevelCompleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            ¡Nivel Completado!
          </DialogTitle>
        </DialogHeader>

        <img src="/trophy.png" alt="Trofeo" className="h-56 mx-auto" />

        <p className="text-foreground/75">
          ¡Felicidades por terminar todos los desafíos de este nivel! ¿Qué te
          gustaría hacer ahora?
        </p>

        <DialogFooter className="sm:justify-center">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onGoHome();
            }}
          >
            Volver al inicio
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              onOpenChange(false);
              onGoEditor();
            }}
          >
            Ir al editor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
