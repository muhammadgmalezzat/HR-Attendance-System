import express   from "express";
const router = express.Router();
import { protect } from"../middleware/auth.middleware.js";
import {
  uploadAttendance,
  getDailyRecords,
  getSummaryStats,
  getEmployeeReport,
  reprocessAttendance,
  getUploadHistory,
} from "../controllers/attendance.controller.js";

// All routes are protected
router.post("/upload", protect, uploadAttendance);
router.get("/daily", protect, getDailyRecords);
router.get("/stats", protect, getSummaryStats);
router.get("/employee/:userId", protect, getEmployeeReport);
router.post("/reprocess", protect, reprocessAttendance);
router.get("/uploads", protect, getUploadHistory);

export default router;
