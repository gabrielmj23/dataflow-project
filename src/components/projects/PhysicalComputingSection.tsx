import microbitSticker from "@/assets/landing/microbit.png";
import avionPapel from "@/assets/landing/avion-papel.png";
import microbitDemoSticker from "@/assets/landing/microbit-demo.png";
import { useState } from "react";
import { Link } from "react-router-dom";
import { MicrobitFirmwareDialog } from "./MicrobitFirmwareDialog";

type PhysicalComputingSectionProps = {
  onDownloadFirmware: () => void;
  onOpenDemo?: () => void;
};

export function PhysicalComputingSection({
  onDownloadFirmware,
}: PhysicalComputingSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="text-4xl font-medium tracking-tight text-emerald-700">
        Computación física
      </h2>

      <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <img
            src={microbitSticker}
            alt="Sticker microbit"
            className="h-28 w-40 object-contain rounded-2xl drop-shadow-md"
          />

          <div className="ps-5">
            <p className="max-w-xl text-lg leading-snug text-slate-900">
              Entre infinitas posibilidades, NodeLand te permite interactuar con
              el mundo físico usando las tarjetas Micro:Bit.
            </p>
            <button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="rounded-xl bg-emerald-700 mt-3 px-6 py-3 text-base font-medium text-white transition hover:brightness-95 hover:cursor-pointer"
            >
              Descargar Firmware para Micro:Bit
            </button>
          </div>
        </div>

        <MicrobitFirmwareDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onConfirm={onDownloadFirmware}
        />

        <img
          src={avionPapel}
          alt="Sticker avión de papel"
          className="h-28 w-40 sm:h-36 sm:w-48 object-contain rounded-2xl drop-shadow-md sm:ml-auto"
        />

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to="/editor?demo=microbit"
            className="w-56 shrink-0 rounded-lg border border-emerald-200 bg-slate-50 text-left transition-all hover:cursor-pointer hover:border-emerald-300 hover:shadow"
          >
            <div className="h-32 w-full flex items-center justify-center rounded-t-lg bg-emerald-50 text-xs font-medium text-emerald-700">
              <img
                src={microbitDemoSticker}
                alt="Sticker demo Micro:Bit"
                className="h-full w-full object-contain drop-shadow-md"
              />
            </div>

            <div className="p-3">
              <p className="text-xl font-semibold text-emerald-700">
                Leer temperatura con Micro:Bit
              </p>
              <p className="truncate text-slate-600">
                Interactúa con tu tarjeta
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
