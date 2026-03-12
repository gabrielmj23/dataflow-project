import { Link } from "react-router-dom";
import { LogIn, LogOut, Trophy, UserRound, Zap } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { clearStoredAuthSession, getStoredAuthUser } from "@/lib/auth";
import type { AuthMode, AuthSessionUser } from "@/types";
import { RecentPublishedProjectsSection } from "@/components/projects/RecentPublishedProjectsSection";
import { MyProjectsSection } from "@/components/projects/MyProjectsSection";
import { DistributedProgrammingSection } from "@/components/projects/DistributedProgrammingSection";
import { PhysicalComputingSection } from "@/components/projects/PhysicalComputingSection";
import makecodeSubflowSource from "../../makecode/nodeland-microbit.hex?raw";
import stickerCohete from "@/assets/landing/cohete.png";
import stickerCompas from "@/assets/landing/compas.png";
import stickerFlor from "@/assets/landing/flor.png";
import stickerLoro from "@/assets/landing/loro.png";
import stickerRegla from "@/assets/landing/regla.png";
import ucabLogo from "@/assets/landing/ucab-logo.png";
import labLogo from "@/assets/landing/lab-logo.png";

export default function ModeSelectPage() {
  const [isChallengeDialogOpen, setIsChallengeDialogOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [currentUser, setCurrentUser] = useState<AuthSessionUser | null>(() =>
    getStoredAuthUser(),
  );

  const handleAuthSuccess = (user: AuthSessionUser) => {
    setCurrentUser(user);
    setIsAuthDialogOpen(false);
  };

  const handleLogout = () => {
    clearStoredAuthSession();
    setCurrentUser(null);
  };

  const handleDownloadMicrobitFirmware = () => {
    const blob = new Blob([makecodeSubflowSource], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nodeland-microbit.hex";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-sky-50 via-blue-50 to-cyan-100 text-slate-900">
      <header className="sticky top-0 z-40 w-full bg-(--nodi-blue) text-white shadow-md">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-2.5 sm:px-7 sm:py-3">
          <div className="flex items-center gap-2">
            <img
              src="/nodeland-mini-white.png"
              alt="NodeLand"
              className="h-10 w-10"
            />

            <span className="text-[2.15rem] font-medium tracking-tight">
              NodeLand
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/editor"
              className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-white/15 hover:cursor-pointer"
            >
              Programar
            </Link>

            <button
              type="button"
              className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-white/15 hover:cursor-pointer"
              onClick={() => setIsChallengeDialogOpen(true)}
            >
              Completar desafíos
            </button>

            {currentUser ? (
              <>
                <div className="hidden items-center gap-2 rounded-xl border border-white/40 bg-white/20 px-3 py-2 text-sm font-normal text-white sm:inline-flex">
                  <UserRound size={16} className="text-white" />
                  <span className="max-w-32 truncate">{currentUser.name}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-white bg-white text-(--nodi-blue) hover:bg-blue-50"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  Cerrar sesión
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-white bg-white text-(--nodi-blue) hover:bg-blue-50"
                onClick={() => {
                  setAuthMode("login");
                  setIsAuthDialogOpen(true);
                }}
              >
                <LogIn size={16} />
                Ingresar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
        <StickerImage
          floating
          src={stickerCohete}
          alt="Sticker cohete"
          className="left-8 top-5 -rotate-12 -translate-x-12 z-0 pointer-events-none"
        />
        <StickerImage
          floating
          src={stickerFlor}
          alt="Sticker flor"
          className="left-6 bottom-6 -rotate-6 -translate-x-16 z-0 pointer-events-none"
        />

        <StickerImage
          floating
          src={stickerLoro}
          alt="Sticker loro"
          className="right-14 top-2 rotate-8 translate-x-8 z-0 pointer-events-none"
        />
        <StickerImage
          floating
          src={stickerCompas}
          alt="Sticker compás"
          className="right-10 top-46 -rotate-12 translate-x-12 z-0 pointer-events-none"
          size="small"
        />
        <StickerImage
          floating
          src={stickerRegla}
          alt="Sticker regla"
          className="right-10 bottom-0 rotate-6 translate-x-16 translate-y-4 z-0 pointer-events-none"
        />

        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-7 text-center">
          <div>
            <h1 className="text-4xl font-semibold leading-tight text-slate-800 sm:text-5xl md:text-6xl mb-3">
              <span className="font-medium text-amber-600/90">
                La forma más fácil de
              </span>
              <br />
              <span className="text-blue-500">programar computadoras</span>
            </h1>

            <p className="max-w-2xl text-2xl text-emerald-700">
              Solo con conectar nodos de forma creativa
            </p>
          </div>

          <div className="mt-1 flex flex-wrap justify-center gap-4">
            <Link
              to="/editor"
              className="inline-flex items-center gap-2 rounded-xl bg-(--nodi-blue) px-8 py-3 text-lg font-medium text-white shadow-lg transition hover:brightness-95"
            >
              <Zap size={18} className="fill-yellow-300 text-yellow-300" />
              Programar
            </Link>

            <button
              type="button"
              onClick={() => setIsChallengeDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-(--nodi-blue) px-8 py-3 text-lg font-medium text-white shadow-lg transition hover:brightness-95 hover:cursor-pointer"
            >
              <Trophy size={18} className="fill-yellow-300 text-yellow-300" />
              Completar Desafíos
            </button>
          </div>

          <p className="max-w-3xl pt-2 text-base text-slate-700 sm:text-lg">
            Con NodeLand, recorre de forma divertida el camino que te lleva
            desde aprender a programar en el modelo de DataFlow, hasta la
            interesante computación distribuida.
          </p>

          <div className="grid w-full grid-cols-2 gap-2 pt-2 md:hidden">
            <StickerImage src={stickerCohete} alt="Sticker cohete" />
            <StickerImage src={stickerLoro} alt="Sticker loro" />
            <StickerImage src={stickerFlor} alt="Sticker flor" />
            <StickerImage src={stickerRegla} alt="Sticker regla" />
          </div>
        </div>
      </main>

      <section className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-4 pb-8 sm:px-8">
        <MyProjectsSection />
        <RecentPublishedProjectsSection />
        <DistributedProgrammingSection />
        <PhysicalComputingSection
          onDownloadFirmware={handleDownloadMicrobitFirmware}
        />

        <AgeSelectionDialog
          visible={isChallengeDialogOpen}
          onClose={() => setIsChallengeDialogOpen(false)}
        />

        <AuthDialog
          visible={isAuthDialogOpen}
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setIsAuthDialogOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </section>

      <DevelopedByFooter />
    </div>
  );
}

function DevelopedByFooter() {
  return (
    <footer className="w-full border-t border-slate-200 bg-slate-100/90 mt-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-5 sm:px-8">
        <p className="text-3xl font-normal leading-none text-sky-500 text-center">
          Desarrollado en:
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <FooterLogo
            src={ucabLogo}
            alt="Logo UCAB"
            fallbackLabel="UCAB"
            className="h-18 w-auto"
          />

          <FooterLogo
            src={labLogo}
            alt="Logo Laboratorio"
            fallbackLabel="LAB"
            className="h-20 w-auto"
          />
        </div>

        <p className="text-center text-sm text-slate-800">
          Version 1.0 - Marzo 2026
        </p>
      </div>
    </footer>
  );
}

function FooterLogo({
  src,
  alt,
  fallbackLabel,
  className,
}: {
  src: string;
  alt: string;
  fallbackLabel: string;
  className?: string;
}) {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className="flex h-16 min-w-28 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-2xl font-semibold text-slate-700">
        {fallbackLabel}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${className ?? "h-16 w-auto"} object-contain`}
      onError={() => setImageError(true)}
    />
  );
}

function StickerImage({
  src,
  alt,
  className,
  size = "default",
  floating = false,
}: {
  src: string;
  alt: string;
  className?: string;
  size?: "default" | "small";
  floating?: boolean;
}) {
  const baseSize = size === "small" ? "h-40 w-56" : "h-56 w-72";
  const modeClass = floating ? "absolute hidden md:block" : "block";

  return (
    <img
      src={src}
      alt={alt}
      className={`${modeClass} ${baseSize} object-contain drop-shadow-md ${className ?? ""}`}
    />
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
