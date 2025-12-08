import express from "express";
const router = express.Router();
import { protect } from "../middleware/auth.middleware.js";
import {
  register,
  login,
  getMe,
  initAdmin,
} from "../controllers/auth.controller.js";

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.post("/init", initAdmin); // Development only

export default router;
