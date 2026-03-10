import microbitSticker from "@/assets/landing/microbit.png";

type PhysicalComputingSectionProps = {
  onDownloadFirmware: () => void;
  onOpenDemo?: () => void;
};

export function PhysicalComputingSection({
  onDownloadFirmware,
}: PhysicalComputingSectionProps) {
  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="text-4xl font-normal tracking-tight text-emerald-700">Computacion Fisica</h2>

      <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <img
            src={microbitSticker}
            alt="Sticker microbit"
            className="h-28 w-40 object-contain rounded-2xl drop-shadow-md"
          />

          <p className="max-w-xl text-lg leading-snug text-slate-900">
            NodeLand entre infinitas posibilidades, te permite interactuar con el mundo fisico
            usando las increibles tarjetas Micro:Bit.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onDownloadFirmware}
            className="rounded-xl bg-emerald-700 px-6 py-3 text-base font-medium text-white transition hover:brightness-95 hover:cursor-pointer"
          >
            Descargar Firmware para Micro:Bit
          </button>

          <button
            type="button"
            className="w-56 shrink-0 rounded-lg border border-emerald-200 bg-slate-50 text-left transition-all hover:cursor-pointer hover:border-emerald-300 hover:shadow"
          >
            <div className="h-28 w-full flex items-center justify-center rounded-t-lg bg-emerald-50 text-xs font-medium text-emerald-700">
              Placeholder Demo
            </div>

            <div className="p-3">
              <p className="truncate text-xl font-semibold text-emerald-700">Programa de demostracion</p>
              <p className="truncate text-slate-600">proximamente</p>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
