import { Router } from "express";
import { logIn, signUp } from "./auth.service.js";

const authRouter = Router();

authRouter.post("/sign-up", async (req, res) => {
  try {
    const result = await signUp(req.body);
    return res.status(201).json(result);
  } catch (error: unknown) {
    console.error("Error signing up:", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

authRouter.post("/log-in", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await logIn(email, password);
    return res.status(200).json(result);
  } catch (error: unknown) {
    console.error("Error logging in:", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export { authRouter };
