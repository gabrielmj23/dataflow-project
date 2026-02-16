import { ChevronDown, ChevronUp, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChallengeDefinition } from "@/challenges/definitions";
import type { ValidationResult } from "@/hooks/useChallengeManager";

interface ChallengePanelProps {
  challengeDefinition: ChallengeDefinition;
  isChallengeOpen: boolean;
  onToggle: () => void;
  validationResult: ValidationResult;
  isValidating: boolean;
  onValidate: () => void;
  nextChallenge: ChallengeDefinition | null;
  onNextChallengeClick: () => void;
}

export function ChallengePanel({
  challengeDefinition,
  isChallengeOpen,
  onToggle,
  validationResult,
  isValidating,
  onValidate,
  nextChallenge,
  onNextChallengeClick,
}: ChallengePanelProps) {
  return (
    <div className="pointer-events-none absolute right-4 top-16 z-20 flex w-72 px-2">
      <div className="pointer-events-auto grid w-full grid-cols-1 gap-0 rounded-2xl bg-white/95 text-slate-900 shadow-lg max-w-xs overflow-hidden">
        <div className="flex items-center justify-between border-(--nodi-blue-border) bg-(--nodi-blue) px-3 py-2 text-sm font-medium text-white">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="hover:bg-white/10"
              onClick={onToggle}
              title={isChallengeOpen ? "Minimizar" : "Expandir"}
              aria-label={isChallengeOpen ? "Minimizar" : "Expandir"}
            >
              {isChallengeOpen ? (
                <ChevronDown className="text-white" />
              ) : (
                <ChevronUp className="text-white" />
              )}
            </Button>
            <span className="uppercase tracking-[0.18em] text-[11px]">
              Desafío
            </span>
          </div>

          <div>
            <span
              className={
                validationResult.status === "success"
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700"
                  : validationResult.status === "failure"
                    ? "rounded-full bg-amber-100 px-2 py-0.5 text-amber-700"
                    : "rounded-full bg-slate-200 px-2 py-0.5 text-slate-700"
              }
            >
              {validationResult.status === "success"
                ? "Completado"
                : validationResult.status === "failure"
                  ? "En progreso"
                  : "Pendiente"}
            </span>
          </div>
        </div>

        {isChallengeOpen && challengeDefinition.description ? (
          <div className="rounded-b-2xl border-2 border-(--nodi-blue) bg-white px-3 pb-3 pt-2 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">Instrucciones</p>
            <p className="mt-1 leading-snug">
              {challengeDefinition.description}
            </p>

            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                size="sm"
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isValidating}
                onClick={onValidate}
              >
                {isValidating ? "Probando..." : "Probar"}
              </Button>
            </div>

            {validationResult.status === "failure" && (
              <div className="mt-2 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                <p>
                  La salida no es correcta. Revisa tus conexiones y vuelve a
                  intentar.
                </p>
                <p className="mt-1 text-xs text-rose-700">
                  Salida:{" "}
                  {validationResult.actualLines.length
                    ? validationResult.actualLines[
                        validationResult.actualLines.length - 1
                      ]
                    : "Sin salida"}
                </p>
              </div>
            )}

            {validationResult.status === "success" && (
              <div className="mt-2 rounded-md border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
                <p>
                  {nextChallenge
                    ? "¡Felicidades! Has completado el desafío con éxito, puedes continuar."
                    : "¡Felicidades por terminar los desafíos de tu nivel!"}
                </p>
                <Button
                  className="rounded-lg mt-2 mb-1 bg-green-600/90 hover:bg-green-600"
                  onClick={onNextChallengeClick}
                >
                  {nextChallenge ? "Siguiente" : "Volver al inicio"}{" "}
                  <Play fill="white" className="inline" />
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
