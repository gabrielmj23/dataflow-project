import { Link } from "react-router-dom";
import { ArrowLeft, Award, ChevronRight, Clock8, Trophy } from "lucide-react";

const challengeTracks = [
  {
    id: "starter-kit",
    title: "Kit inicial",
    difficulty: "Fácil",
    duration: "10 min",
    description:
      "Descubre los nodos básicos y aprende a crear tu primer flujo interactivo paso a paso.",
    objectives: ["Conectar entradas y salidas", "Usar nodos de control"],
  },
  {
    id: "sensors-101",
    title: "Sensores 101",
    difficulty: "Medio",
    duration: "20 min",
    description:
      "Procesa lecturas simuladas y envía avisos usando combinaciones de nodos lógicos y de lista.",
    objectives: ["Filtrar datos", "Crear acciones por umbral"],
  },
  {
    id: "micro-retos",
    title: "Micro retos",
    difficulty: "Medio",
    duration: "15 min",
    description:
      "Pequeños puzzles para practicar condicionales, secuencias y subflujos reutilizables.",
    objectives: ["Duplicar subflujos", "Refinar conexiones"],
  },
];

export default function ChallengesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-white/60">Modo desafíos</p>
            <h1 className="text-3xl font-black">Misiones interactivas</h1>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
          >
            <ArrowLeft size={16} /> Volver
          </Link>
        </div>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="grid gap-5">
            {challengeTracks.map((track) => (
              <article
                key={track.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_40px_80px_rgba(15,23,42,0.45)]"
              >
                <header className="flex flex-wrap items-center gap-3 text-sm text-white/60">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                    <Award size={14} /> {track.difficulty}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1">
                    <Clock8 size={14} /> {track.duration}
                  </span>
                </header>
                <div className="mt-4 flex flex-col gap-3">
                  <h2 className="text-2xl font-bold">{track.title}</h2>
                  <p className="text-sm text-white/80">{track.description}</p>
                </div>
                <ul className="mt-4 flex flex-wrap gap-3 text-xs text-white/70">
                  {track.objectives.map((objective) => (
                    <li
                      key={objective}
                      className="rounded-full border border-white/15 px-3 py-1"
                    >
                      {objective}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex justify-end">
                  <Link
                    to={`/editor/${track.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
                  >
                    Jugar este reto <ChevronRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600 to-purple-700 p-6 shadow-[0_30px_60px_rgba(99,102,241,0.5)]">
            <div>
              <p className="text-xs uppercase tracking-[0.6em] text-white/70">Tu avance</p>
              <h3 className="text-2xl font-black">Colecciona trofeos</h3>
            </div>
            <p className="text-sm text-white/80">
              Completa misiones para ganar insignias, desbloquear nuevos nodos y recibir pistas
              especiales dentro del editor.
            </p>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Próximo logro</p>
              <p className="text-white/80">Termina 2 retos de nivel medio.</p>
            </div>
            <Link
              to="/editor"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            >
              <Trophy size={16} className="text-amber-500" /> Continuar en el editor
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
