import jwt from "jsonwebtoken";
import Admin from "../models/Admin.model.js";

// Generate JWT token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// @desc    Register admin (first time setup)
// @route   POST /api/auth/register
// @access  Public (should be restricted in production)
export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin with this email already exists",
      });
    }

    // Create admin
    const admin = await Admin.create({
      email,
      password,
      name: name || "Admin",
      role: "super_admin",
    });

    // Generate token
    const token = generateToken(admin._id);

    res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering admin",
      error: error.message,
    });
  }
};

// @desc    Login admin
// @route   POST /api/auth/login
// @access  Public

export const login = async (req, res) => {
  const { email, password } = req.body;
  console.log("🚀 ~ login ~ email:", email);

  try {
    const existing = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (!existing) {
      var admin = await Admin.create({
        email: process.env.ADMIN_EMAIL || "admin@company.com",
        password: process.env.ADMIN_PASSWORD || "admin123456",
        name: "Super Admin",
        role: "super_admin",
        isActive: true,
      });

      console.log("✅ Default admin created:", admin.email);
      admin.lastLogin = new Date();
      await admin.save();
      
    }else{
      var admin = existing;
      admin.lastLogin = new Date();
      await admin.save();

    }

    

    // if (!admin)
    //   return res
    //     .status(401)
    //     .json({ success: false, message: "Invalid credentials" });
    // if (!admin.isActive)
    //   return res
    //     .status(401)
    //     .json({ success: false, message: "Admin account is inactive" });

    // const isPasswordMatch = await admin.comparePassword(password);
    // console.log("🚀 password match:", isPasswordMatch);

    // if (!isPasswordMatch)
    //   return res
    //     .status(401)
    //     .json({ success: false, message: "Invalid credentials" });

    

    const token = generateToken(admin._id);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
};

// @desc    Get current admin
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);

    res.json({
      success: true,
      data: {
        admin,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting admin data",
      error: error.message,
    });
  }
};

// @desc    Initialize default admin (development only)
// @route   POST /api/auth/init
// @access  Public
export const initAdmin = async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is disabled in production",
      });
    }

    // Check if any admin exists
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Admin already exists",
      });
    }

    // Create default admin
    const admin = await Admin.create({
      email: process.env.ADMIN_EMAIL || "admin@company.com",
      password: process.env.ADMIN_PASSWORD || "admin123456",
      name: "Super Admin",
      role: "super_admin",
    });

    const token = generateToken(admin._id);

    res.status(201).json({
      success: true,
      message: "Default admin created successfully",
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Init admin error:", error);
    res.status(500).json({
      success: false,
      message: "Error initializing admin",
      error: error.message,
    });
  }
};
