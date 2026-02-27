import { Link } from "react-router-dom";
import { Trophy, Zap } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";

export default function ModeSelectPage() {
  const [isChallengeDialogOpen, setIsChallengeDialogOpen] = useState(false);

  return (
    <div className="relative h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="absolute top-1/2 -right-24 h-96 w-96 -translate-y-1/2 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="absolute -bottom-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-400/20 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
        <header className="flex items-center justify-start">
          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-blue-50/90 p-2.5 text-blue-600 shadow-sm border border-slate-200">
              <img
                src="/nodeland-dark.png"
                alt="NodeLand"
                className="h-10 w-10"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 leading-none ps-1">
                Bienvenido a
              </p>
              <span className="text-4xl font-semibold text-slate-900">
                NodeLand
              </span>
            </div>
          </div>
        </header>

        <main className="flex flex-col gap-12 items-center justify-center min-h-[65vh]">
          <div className="flex flex-col gap-8 text-center max-w-4xl">
            <h1 className="text-5xl font-black leading-[1.1] text-slate-900 md:text-7xl tracking-tight">
              Programa con{" "}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-fuchsia-600">
                nodos
              </span>
              , <br className="hidden md:block" /> crea magia
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-slate-500 md:text-xl leading-relaxed">
              Conecta bloques inteligentes, entiende el flujo de datos y
              descubre cómo pensar como un ingeniero creativo. Nodi es el camino
              más divertido para dominar la lógica.
            </p>

            <div className="flex flex-wrap justify-center gap-6 mt-4">
              <Link
                to="/editor"
                className="group relative inline-flex items-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-lg font-semibold text-white shadow-2xl transition hover:bg-slate-800 hover:scale-105 active:scale-95"
              >
                <Zap size={20} className="text-yellow-400 fill-yellow-400" />
                Ir al editor
              </Link>

              <button
                className="group inline-flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-8 py-4 text-lg font-semibold text-slate-900 shadow-xl transition hover:border-fuchsia-500 hover:text-fuchsia-600 hover:scale-105 active:scale-95 hover:cursor-pointer"
                onClick={() => setIsChallengeDialogOpen(true)}
              >
                <Trophy
                  size={20}
                  className="transition-colors group-hover:text-fuchsia-500"
                />
                Desafíos
              </button>
            </div>
          </div>

          <AgeSelectionDialog
            visible={isChallengeDialogOpen}
            onClose={() => setIsChallengeDialogOpen(false)}
          />
        </main>
      </div>
    </div>
  );
}

function AgeSelectionDialog({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={visible} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-8 border-none shadow-2xl rounded-2xl">
        <h2 className="text-3xl font-semibold text-center mt-2 tracking-tight">
          ¡Hola! ¿Qué edad tienes?
        </h2>
        <p className="text-center text-slate-500 mb-2 text-base">
          Adaptaremos los desafíos a tu nivel.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/desafios/1"
            className="group flex flex-col items-center gap-5 border-2 border-blue-100 rounded-3xl p-8 hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-300"
          >
            <img
              src="/lego-bricks-nobg.png"
              alt="Lego bricks"
              className="h-28 w-28 object-contain group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300"
            />
            <div className="text-center">
              <span className="block text-xl font-semibold text-slate-900">
                Niños
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-500">
                8 - 11 años
              </span>
            </div>
          </Link>

          <Link
            to="/desafios/2"
            className="group flex flex-col items-center gap-5 border-2 border-fuchsia-100 rounded-3xl p-8 hover:border-fuchsia-500 hover:bg-fuchsia-50/50 transition-all duration-300"
          >
            <img
              src="/shapes-nobg.png"
              alt="Shapes"
              className="h-28 w-28 object-contain group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300"
            />
            <div className="text-center">
              <span className="block text-xl font-semibold text-slate-900">
                Jóvenes
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-fuchsia-500">
                12 - 16 años
              </span>
            </div>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
