import { Link } from "react-router-dom";
import { Sparkles, Trophy, Zap } from "lucide-react";

export default function ModeSelectPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-10">
        <header className="flex items-center justify-start">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-600/10 p-3 text-blue-600">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Bienvenido a
              </p>
              <p className="text-lg font-semibold text-blue-700">Nodi</p>
            </div>
          </div>
        </header>

        <main className="flex flex-col gap-10 rounded-3xl bg-white/90 p-10 shadow-[0_30px_80px_rgba(14,63,119,0.07)]">
          <div className="flex flex-col gap-6 text-center">
            
            <h1 className="text-4xl font-black leading-tight text-slate-900 md:text-5xl">
              Programa con nodos, crea magia
            </h1>
            <p className="mx-auto max-w-2xl text-base text-slate-500 md:text-lg">
              Conecta bloques inteligentes, entiende el flujo de datos y descubre cómo pensar
              como un ingeniero creativo. Nodi es el camino más divertido para dominar la lógica.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/editor"
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:translate-y-0.5"
              >
                <Zap size={18} /> Ir al editor
              </Link>
              <Link
                to="/challenges"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:translate-y-0.5"
              >
                <Trophy size={18} /> Desafíos
              </Link>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
