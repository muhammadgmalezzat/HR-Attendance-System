import User from "../models/User.model.js";

import UploadHistory from"../models/UploadHistory.model.js";
import { parseUsersData } from"../utils/fileParser.js";

// @desc    Bulk upload users
// @route   POST /api/users/bulk-upload
// @access  Public (or Protected based on requirements)
export const bulkUploadUsers = async (req, res) => {
  try {
    const { users, fileName } = req.body;
    console.log("🚀 ~ bulkUploadUsers ~ users:", users)

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No users data provided",
      });
    }

    // Create upload history record
    const uploadHistory = await UploadHistory.create({
      fileName: fileName || "users_upload",
      fileType: "users",
      recordsCount: users.length,
      status: "processing",
    });
    console.log("🚀 ~ bulkUploadUsers ~ uploadHistory:", uploadHistory)

    // Parse users data
    const { users: parsedUsers, errors: parseErrors } = parseUsersData(users);
    console.log("🚀 ~ bulkUploadUsers ~ parsedUsers:", parsedUsers)

    if (parsedUsers.length === 0) {
      uploadHistory.status = "failed";
      uploadHistory.errors = parseErrors;
      await uploadHistory.save();

      return res.status(400).json({
        success: false,
        message: "No valid users found",
        errors: parseErrors,
      });
    }

    // Bulk upsert users
    const bulkOps = parsedUsers.map((user) => ({
      updateOne: {
        filter: { user_id: user.user_id },
        update: { $set: user },
        upsert: true,
      },
    }));

    //const result = await User.bulkWrite(bulkOps);

    // Update upload history
    uploadHistory.status = "completed";
    uploadHistory.usersCount = parsedUsers.length;
    uploadHistory.processedRecords =
      //result.upsertedCount + result.modifiedCount;
    uploadHistory.failedRecords = parseErrors.length;
    uploadHistory.errors = parseErrors;
    await uploadHistory.save();

    res.status(200).json({
      success: true,
      message: "Users uploaded successfully",
      data: {
        total: users.length,
        successful: parsedUsers.length,
        failed: parseErrors.length,
        //inserted: result.upsertedCount,
        //updated: result.modifiedCount,
        uploadId: uploadHistory._id,
        errors: parseErrors,
      },
    });
  } catch (error) {
    console.error("Bulk upload users error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading users",
      error: error.message,
    });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      search,
      job,
      gender,
      isActive = "true",
    } = req.query;

    const query = {};

    // Filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { user_id: { $regex: search, $options: "i" } },
      ];
    }

    if (job) {
      query.job = { $regex: job, $options: "i" };
    }

    if (gender) {
      query.gender = gender;
    }

    if (isActive !== "all") {
      query.isActive = isActive === "true";
    }

    // Pagination
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query).sort({ name: 1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:userId
// @access  Private
export const getUser = async (req, res) => {
  try {
    const user = await User.findOne({ user_id: req.params.userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:userId
// @access  Private
export const updateUser = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "job",
      "gender",
      "from",
      "to",
      "shiftSchedule",
      "gracePeriodMinutes",
      "absentThreshold",
      "isActive",
    ];

    const updateData = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const user = await User.findOneAndUpdate(
      { user_id: req.params.userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: { user },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:userId
// @access  Private
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ user_id: req.params.userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

// @desc    Get users stats
// @route   GET /api/users/stats
// @access  Private
export const getUsersStats = async (req, res) => {
  try {
    const [total, active, byJob, byGender] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.aggregate([
        { $group: { _id: "$job", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      User.aggregate([{ $group: { _id: "$gender", count: { $sum: 1 } } }]),
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        byJob,
        byGender,
      },
    });
  } catch (error) {
    console.error("Get users stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users stats",
      error: error.message,
    });
  }
};
