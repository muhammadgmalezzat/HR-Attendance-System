import express from "express";
const router = express.Router();
import { protect } from "../middleware/auth.middleware.js";

import {
  bulkUploadUsers,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  getUsersStats,
} from "../controllers/user.controller.js";

const userRoutes = express.Router();

// Public route (or protect based on requirements)
userRoutes.post("/bulk-upload", bulkUploadUsers);

// Protected routes
userRoutes.get("/", protect, getAllUsers);
userRoutes.get("/stats", protect, getUsersStats);
userRoutes.get("/:userId", protect, getUser);
userRoutes.put("/:userId", protect, updateUser);
userRoutes.delete("/:userId", protect, deleteUser);

export default userRoutes;
