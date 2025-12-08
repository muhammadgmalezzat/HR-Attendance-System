// routes/userRoutes.js
import express from "express";
import { createUser, getUsers } from "../controllers/userController.js";

const router = express.Router();

router.post("/", createUser); // Create new user
router.get("/", getUsers); // Get all users

export default router;
