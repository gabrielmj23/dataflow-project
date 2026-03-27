import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  logIn,
  persistAuthSession,
  requestPasswordReset,
  resetPasswordWithCode,
  signUp,
} from "@/lib/auth";
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
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const logInMutation = useMutation({
    mutationFn: logIn,
  });

  const signUpMutation = useMutation({
    mutationFn: signUp,
  });

  const requestResetMutation = useMutation({
    mutationFn: requestPasswordReset,
  });

  const resetWithCodeMutation = useMutation({
    mutationFn: resetPasswordWithCode,
  });

  const isSubmitting =
    logInMutation.isPending ||
    signUpMutation.isPending ||
    requestResetMutation.isPending ||
    resetWithCodeMutation.isPending;

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError(null);
    setSuccessMessage(null);
    logInMutation.reset();
    signUpMutation.reset();
    requestResetMutation.reset();
    resetWithCodeMutation.reset();
  };

  const clearStepFeedback = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleModeChange = (nextMode: AuthMode, preserveEmail = false) => {
    const previousEmail = email;
    onModeChange(nextMode);
    resetForm();

    if (preserveEmail) {
      setEmail(previousEmail);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      resetForm();
    }
  };

  const submitLabel = useMemo(() => {
    if (isSubmitting) {
      if (mode === "login") {
        return "Entrando...";
      }
      if (mode === "register") {
        return "Creando cuenta...";
      }
      if (mode === "forgotPasswordRequest") {
        return "Enviando código...";
      }

      return "Actualizando contraseña...";
    }

    if (mode === "login") {
      return "Entrar";
    }

    if (mode === "register") {
      return "Crear cuenta";
    }

    if (mode === "forgotPasswordRequest") {
      return "Enviar código";
    }

    return "Restablecer contraseña";
  }, [isSubmitting, mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearStepFeedback();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Ingresa tu correo electrónico.");
      return;
    }

    if (mode === "login") {
      if (!password) {
        setError("Completa correo y contraseña.");
        return;
      }
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

    if (mode === "forgotPasswordRequest") {
      try {
        const result = await requestResetMutation.mutateAsync({
          email: normalizedEmail,
        });
        handleModeChange("forgotPasswordReset", true);
        setSuccessMessage(result.message);
      } catch (submitError: unknown) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "No se pudo enviar el código de recuperación.",
        );
      }

      return;
    }

    if (mode === "forgotPasswordReset") {
      const normalizedCode = resetCode.trim();
      if (!normalizedCode) {
        setError("Ingresa el código de recuperación.");
        return;
      }

      if (newPassword.length < 6) {
        setError("La nueva contraseña debe tener al menos 6 caracteres.");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setError("Las nuevas contraseñas no coinciden.");
        return;
      }

      try {
        const result = await resetWithCodeMutation.mutateAsync({
          email: normalizedEmail,
          code: normalizedCode,
          newPassword,
        });

        setSuccessMessage(result.message);
        setResetCode("");
        setNewPassword("");
        setConfirmNewPassword("");
        setPassword("");
        setConfirmPassword("");
        onModeChange("login");
      } catch (submitError: unknown) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "No se pudo restablecer la contraseña.",
        );
      }

      return;
    }

    try {
      const authResult =
        mode === "login"
          ? await logInMutation.mutateAsync({
              email: normalizedEmail,
              password,
            })
          : await signUpMutation.mutateAsync({
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
    }
  };

  const title =
    mode === "login"
      ? "Inicia sesión"
      : mode === "register"
        ? "Crea tu cuenta"
        : mode === "forgotPasswordRequest"
          ? "Recupera tu contraseña"
          : "Ingresa el código";

  const description =
    mode === "login"
      ? "Accede para compartir tus proyectos."
      : mode === "register"
        ? "Regístrate para comenzar a guardar tus proyectos en NodeLand."
        : mode === "forgotPasswordRequest"
          ? "Te enviaremos un código de recuperación a tu correo."
          : "Usa el código que recibiste para crear una nueva contraseña.";

  return (
    <Dialog open={visible} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md p-7 rounded-2xl border-slate-200">
        <div className="space-y-1">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>

        {mode === "login" || mode === "register" ? (
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
        ) : (
          <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
            <span>
              {mode === "forgotPasswordRequest"
                ? "Paso 1 de 2: Solicitar código"
                : "Paso 2 de 2: Nueva contraseña"}
            </span>
          </div>
        )}

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

          {mode === "login" || mode === "register" ? (
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
          ) : null}

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

          {mode === "forgotPasswordReset" ? (
            <>
              <Input
                value={resetCode}
                onChange={(event) => setResetCode(event.target.value)}
                type="text"
                placeholder="Código de recuperación"
                autoComplete="one-time-code"
                disabled={isSubmitting}
              />
              <Input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                placeholder="Nueva contraseña"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <Input
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                type="password"
                placeholder="Confirmar nueva contraseña"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </>
          ) : null}

          {mode === "login" ? (
            <button
              type="button"
              onClick={() => handleModeChange("forgotPasswordRequest", true)}
              className="text-sm font-medium text-teal-700 hover:cursor-pointer hover:underline"
              disabled={isSubmitting}
            >
              ¿Olvidaste tu contraseña?
            </button>
          ) : null}

          {mode === "forgotPasswordRequest" ? (
            <button
              type="button"
              onClick={() => handleModeChange("forgotPasswordReset", true)}
              className="text-sm font-medium text-teal-700 hover:cursor-pointer hover:underline"
              disabled={isSubmitting}
            >
              Ya tengo un código
            </button>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {successMessage ? (
            <p className="text-sm text-emerald-700">{successMessage}</p>
          ) : null}

          <Button
            type="submit"
            className="w-full rounded-xl"
            disabled={isSubmitting}
          >
            {submitLabel}
          </Button>

          {mode === "forgotPasswordReset" ? (
            <button
              type="button"
              onClick={() => handleModeChange("forgotPasswordRequest", true)}
              className="w-full text-sm font-medium text-slate-600 hover:underline"
              disabled={isSubmitting}
            >
              Reenviar código
            </button>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
