import stickerFutbol from "@/assets/landing/futbol.png";
import stickerCardumen from "@/assets/landing/cardumen.png";

export function DistributedProgrammingSection() {
  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-4xl font-normal tracking-tight text-amber-500">
            Programacion Distribuida
          </h2>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={stickerFutbol}
              alt="Sticker futbol"
              className="h-28 w-40 sm:h-32 sm:w-48 object-contain rounded-2xl drop-shadow-md"
            />

            <p className="max-w-xl text-xl leading-snug text-slate-900">
              NodeLand te permite ejecutar tus proyectos de forma muy sencilla y natural entre varios
              computadores conectados en una red.
            </p>

            <img
              src={stickerCardumen}
              alt="Sticker cardumen"
              className="h-28 w-40 sm:h-32 sm:w-48 object-contain rounded-2xl drop-shadow-md sm:ml-auto"
            />
          </div>
        </div>

          <button
            type="button"
            className="w-56 shrink-0 rounded-lg border border-slate-300 bg-slate-50 text-left transition-all hover:cursor-pointer hover:border-emerald-300 hover:shadow"
          >
            <div className="h-28 w-full flex items-center justify-center rounded-t-lg bg-slate-100 text-xs font-medium text-slate-500">
              Placeholder Demo
            </div>

            <div className="p-3">
              <p className="truncate text-xl font-semibold text-amber-500">Programa de demostracion</p>
              <p className="truncate text-slate-600">proximamente</p>
            </div>
          </button>
      </div>
    </section>
  );
}
