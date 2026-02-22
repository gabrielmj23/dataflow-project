import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { logIn, persistAuthSession, signUp } from "@/lib/auth";
import type { AuthMode, AuthSessionUser } from "../../types";

type AuthDialogProps = {
  visible: boolean;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onAuthSuccess: (user: AuthSessionUser) => void;
};

export function AuthDialog({
  visible,
  mode,
  onModeChange,
  onClose,
  onAuthSuccess,
}: AuthDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setIsSubmitting(false);
  };

  const handleModeChange = (nextMode: AuthMode) => {
    onModeChange(nextMode);
    resetForm();
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      resetForm();
    }
  };

  const submitLabel = useMemo(() => {
    if (isSubmitting) {
      return mode === "login" ? "Entrando..." : "Creando cuenta...";
    }

    return mode === "login" ? "Entrar" : "Crear cuenta";
  }, [isSubmitting, mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Completa correo y contraseña.");
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError("Ingresa tu nombre.");
        return;
      }

      if (password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const authResult =
        mode === "login"
          ? await logIn({
              email: normalizedEmail,
              password,
            })
          : await signUp({
              name: name.trim(),
              email: normalizedEmail,
              password,
            });

      persistAuthSession(authResult);
      onAuthSuccess(authResult.user);
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo completar la autenticación.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={visible} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md p-7 rounded-2xl border-slate-200">
        <div className="space-y-1">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            {mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Accede para compartir tus proyectos."
              : "Regístrate para comenzar a guardar tus proyectos en Nodi."}
          </DialogDescription>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "login"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600"
            }`}
            onClick={() => handleModeChange("login")}
            disabled={isSubmitting}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "register"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600"
            }`}
            onClick={() => handleModeChange("register")}
            disabled={isSubmitting}
          >
            Registro
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre"
              autoComplete="name"
              disabled={isSubmitting}
            />
          ) : null}

          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="Correo electrónico"
            autoComplete="email"
            disabled={isSubmitting}
          />

          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Contraseña"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            disabled={isSubmitting}
          />

          {mode === "register" ? (
            <Input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              placeholder="Confirmar contraseña"
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button
            type="submit"
            className="w-full rounded-xl"
            disabled={isSubmitting}
          >
            {submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
