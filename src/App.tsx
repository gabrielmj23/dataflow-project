import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ChallengeProgressProvider } from "@/challenges/progress-context";
import ChallengesPage from "./pages/ChallengesPage";
import EditorPage from "./pages/EditorPage";
import ModeSelectPage from "./pages/ModeSelectPage";

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
      <h1 className="text-3xl font-bold">Página no encontrada</h1>
      <p className="text-white/70">Revisa la URL o regresa al inicio.</p>
      <a
        href="/"
        className="rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
      >
        Regresar a NodeLand
      </a>
    </div>
  );
}

export default function App() {
  return (
    <ChallengeProgressProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ModeSelectPage />} />
          <Route path="/desafios" element={<ChallengesPage />} />
          <Route path="/desafios/:groupId" element={<ChallengesPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/editor/:challengeId" element={<EditorPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ChallengeProgressProvider>
  );
}
