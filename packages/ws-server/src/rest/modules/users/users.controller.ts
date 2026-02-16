import { Router } from "express";
import { findUserById } from "./users.service.ts";

const usersRouter = Router();

usersRouter.get("/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await findUserById(userId);
    return res.status(200).json(user);
  } catch (error: unknown) {
    console.error("Error fetching user:", error);
    return res.status(404).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export { usersRouter };
