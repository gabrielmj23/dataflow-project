import type { UserSelect } from "../modules/users/users.types";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserSelect;
      projectGuestOwnerId?: string;
    }
  }
}

export {};
