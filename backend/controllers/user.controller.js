import User from "../models/User.model.js";
import DailyRecord from "../models/DailyRecord.model.js";

import UploadHistory from "../models/UploadHistory.model.js";
import { parseUsersData } from "../utils/fileParser.js";

// @desc    Bulk upload users
// @route   POST /api/users/bulk-upload
// @access  Public (or Protected based on requirements)

//note this function called when user uploads excel/csv file containing users data
export const bulkUploadUsers = async (req, res) => {
  try {
    const { users, fileName } = req.body;
    console.log("🚀 ~ bulkUploadUsers ~ users:", users);

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
    // console.log("🚀 ~ bulkUploadUsers ~ uploadHistory:", uploadHistory);

    // Parse users data
    const { users: parsedUsers, errors: parseErrors } = parseUsersData(users);
    // console.log("🚀 ~ bulkUploadUsers ~ parsedUsers:", parsedUsers);

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

    const result = await User.bulkWrite(bulkOps);

    // Update upload history
    uploadHistory.status = "completed";
    uploadHistory.usersCount = parsedUsers.length;
    uploadHistory.processedRecords =
      result.upsertedCount + result.modifiedCount;
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
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
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
      includeStats = "false",
    } = req.query;

    const query = {};

    // Filters
    if (search) {
      query.$or = [
        { userData: { $regex: search, $options: "i" } },
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
      User.find(query)
        .select("-__v")
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    // ✅ إضافة الإحصائيات إذا طُلبت
    if (includeStats === "true" && users.length > 0) {
      const userIds = users.map((u) => u.user_id);

      // جلب إحصائيات الحضور لكل الموظفين
      const stats = await DailyRecord.aggregate([
        { $match: { user_id: { $in: userIds } } },
        {
          $group: {
            _id: "$user_id",
            totalPresent: {
              $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
            },
            totalLate: {
              $sum: { $cond: [{ $eq: ["$status", "Late"] }, 1, 0] },
            },
            totalAbsent: {
              $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] },
            },
            totalDays: { $sum: 1 },
            avgLateMinutes: { $avg: "$lateMinutes" },
            totalLateMinutes: { $sum: "$lateMinutes" },
          },
        },
      ]);

      // دمج الإحصائيات مع بيانات الموظفين
      const statsMap = {};
      stats.forEach((s) => {
        statsMap[s._id] = {
          totalPresent: s.totalPresent,
          totalLate: s.totalLate,
          totalAbsent: s.totalAbsent,
          totalDays: s.totalDays,
          avgLateMinutes: Math.round(s.avgLateMinutes || 0),
          totalLateMinutes: s.totalLateMinutes,
          attendanceRate:
            s.totalDays > 0
              ? (((s.totalPresent + s.totalLate) / s.totalDays) * 100).toFixed(
                  1
                )
              : 0,
        };
      });

      users.forEach((user) => {
        user.stats = statsMap[user.user_id] || {
          totalPresent: 0,
          totalLate: 0,
          totalAbsent: 0,
          totalDays: 0,
          avgLateMinutes: 0,
          totalLateMinutes: 0,
          attendanceRate: 0,
        };
      });
    }

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
    const user = await User.findOne({ user_id: req.params.userId })
      .select("-__v")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ جلب الإحصائيات التفصيلية
    const stats = await DailyRecord.aggregate([
      { $match: { user_id: user.user_id } },
      {
        $group: {
          _id: null,
          totalPresent: {
            $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
          },
          totalLate: {
            $sum: { $cond: [{ $eq: ["$status", "Late"] }, 1, 0] },
          },
          totalAbsent: {
            $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] },
          },
          totalDayOff: {
            $sum: { $cond: [{ $eq: ["$status", "DayOff"] }, 1, 0] },
          },
          totalDays: { $sum: 1 },
          avgLateMinutes: { $avg: "$lateMinutes" },
          totalLateMinutes: { $sum: "$lateMinutes" },
          totalWorkHours: { $sum: "$totalHours" },
          avgWorkHours: { $avg: "$totalHours" },
        },
      },
    ]);

    // ✅ آخر 10 أيام حضور
    const recentAttendance = await DailyRecord.find({
      user_id: user.user_id,
    })
      .sort({ date: -1 })
      .limit(10)
      .select("date status totalHours lateMinutes firstCheckIn lastCheckOut")
      .lean();

    const userStats = stats[0] || {
      totalPresent: 0,
      totalLate: 0,
      totalAbsent: 0,
      totalDayOff: 0,
      totalDays: 0,
      avgLateMinutes: 0,
      totalLateMinutes: 0,
      totalWorkHours: 0,
      avgWorkHours: 0,
    };

    // حساب معدل الحضور
    const workableDays = userStats.totalDays - userStats.totalDayOff;
    userStats.attendanceRate =
      workableDays > 0
        ? (
            ((userStats.totalPresent + userStats.totalLate) / workableDays) *
            100
          ).toFixed(1)
        : 0;

    userStats.avgLateMinutes = Math.round(userStats.avgLateMinutes || 0);
    userStats.avgWorkHours = Number((userStats.avgWorkHours || 0).toFixed(2));

    res.json({
      success: true,
      data: { user, stats: userStats, recentAttendance },
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
      "splitShifts",
      "breakTime",
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

    // ✅ Validation
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const user = await User.findOneAndUpdate(
      { user_id: req.params.userId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Update name in DailyRecords if name changed
    if (updateData.name) {
      await DailyRecord.updateMany(
        { user_id: user.user_id },
        { $set: { name: updateData.name } }
      );
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

    // ⚠️ Note: لا نحذف DailyRecords للحفاظ على السجلات التاريخية
    // يمكنك إضافة soft delete بدلاً من ذلك

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
