export type AuthMode =
  | "login"
  | "register"
  | "forgotPasswordRequest"
  | "forgotPasswordReset";

export type AuthSessionUser = {
  id: string;
  name: string;
  email: string;
};
