import express from "express";
const router = express.Router();
import { protect } from "../middleware/auth.middleware.js";
import {
  getUserShift,
  updateUserShift,
  getShiftForDate,
} from"../controllers/shift.controller.js";

// All routes are protected
router.get("/:userId", protect, getUserShift);
router.put("/:userId", protect, updateUserShift);
router.get("/:userId/date/:date", protect, getShiftForDate);

export default router;
