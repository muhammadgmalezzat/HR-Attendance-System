import RawAttendance from "../models/RawAttendance.model.js";
import DailyRecord from "../models/DailyRecord.model.js";
import UploadHistory from "../models/UploadHistory.model.js";
import { parseAttendanceData } from "../utils/fileParser.js";
import {
  processAttendanceLogs,
  reprocessDateRange,
} from "../services/attendanceProcessor.js";
import User from "../models/User.model.js";

// @desc    Upload attendance logs
// @route   POST /api/attendance/upload
// @access  Private
export const uploadAttendance = async (req, res) => {
  try {
    const { attendance, fileName } = req.body;

    if (!attendance || !Array.isArray(attendance) || attendance.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No attendance data provided",
      });
    }

    // Create upload history record
    const uploadHistory = await UploadHistory.create({
      fileName: fileName || "attendance_upload",
      fileType: "attendance",
      recordsCount: attendance.length,
      status: "processing",
    });

    // Parse attendance data
    const { records, errors } = parseAttendanceData(attendance);

    if (records.length === 0) {
      uploadHistory.status = "failed";
      uploadHistory.errors = errors;
      await uploadHistory.save();

      return res.status(400).json({
        success: false,
        message: "No valid attendance records found",
        errors,
      });
    }

    // Add upload batch ID to records
    const recordsWithBatch = records.map((r) => {
      // تأكد إن checkIns موجودة كـ array
      if (!Array.isArray(r.checkIns)) {
        r.checkIns = [];
      }

      // تحويل كل عنصر في checkIns
      r.checkIns = r.checkIns.map((ci) => ({
        timestamp: new Date(ci.timestamp),
        type: ci.type || "unknown",
      }));

      return {
        ...r,
        uploadBatchId: uploadHistory._id,
        processed: false,
      };
    });

    // Insert raw attendance logs
    const insertedLogs = await RawAttendance.insertMany(recordsWithBatch);

    // Process logs immediately
    const processResult = await processAttendanceLogs(uploadHistory._id);
    //console.log("🚀 ~ uploadAttendance ~ processResult:", processResult);

    // Update upload history
    uploadHistory.status = "completed";
    uploadHistory.processedRecords = processResult.processed;
    uploadHistory.usersCount = new Set(records.map((r) => r.user_id)).size;
    uploadHistory.failedRecords = errors.length;
    uploadHistory.errors = errors;
    uploadHistory.metadata = {
      dailyRecordsCreated: processResult.created,
      dailyRecordsUpdated: processResult.updated,
    };
    await uploadHistory.save();

    res.status(200).json({
      success: true,
      message: "Attendance uploaded and processed successfully",
      data: {
        uploadId: uploadHistory._id,
        total: attendance.length,
        successful: records.length,
        failed: errors.length,
        inserted: insertedLogs.length,
        processing: processResult,
        errors,
      },
    });
  } catch (error) {
    console.error("Upload attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading attendance",
      error: error.message,
    });
  }
};

// @desc    Get daily records
// @route   GET /api/attendance/daily
// @access  Private
export const getDailyRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      startDate,
      endDate,
      userId,
      status,
      month,
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    // Filters
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    if (month) {
      // month format: "2025-11"
      const [year, monthNum] = month.split("-");

      if (!year || !monthNum) {
        return res.status(400).json({
          success: false,
          message: "Invalid month format. Expected: YYYY-MM",
        });
      }

      // حساب أول وآخر يوم في الشهر
      const startOfMonth = `${year}-${monthNum}-01`;

      // حساب آخر يوم في الشهر
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const endOfMonth = `${year}-${monthNum}-${String(lastDay).padStart(
        2,
        "0"
      )}`;

      query.date = {
        $gte: startOfMonth,
        $lte: endOfMonth,
      };

      console.log(`🔍 Month filter: ${startOfMonth} to ${endOfMonth}`);
    }
    // فلتر حسب التاريخ (إذا لم يتم تحديد شهر)
    else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    if (userId) {
      query.user_id = userId;
    }

    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [records, total] = await Promise.all([
      DailyRecord.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
      DailyRecord.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get daily records error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching daily records",
      error: error.message,
    });
  }
};

// @desc    Get summary stats
// @route   GET /api/attendance/stats
// @access  Private
export const getSummaryStats = async (req, res) => {
  try {
    const { startDate, endDate, month } = req.query;

    const dateQuery = {};

    // ✅ فلتر حسب الشهر
    if (month) {
      const [year, monthNum] = month.split("-");
      const startOfMonth = `${year}-${monthNum}-01`;
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const endOfMonth = `${year}-${monthNum}-${String(lastDay).padStart(
        2,
        "0"
      )}`;

      dateQuery.date = {
        $gte: startOfMonth,
        $lte: endOfMonth,
      };
    }
    // فلتر حسب التاريخ
    else if (startDate || endDate) {
      dateQuery.date = {};
      if (startDate) dateQuery.date.$gte = startDate;
      if (endDate) dateQuery.date.$lte = endDate;
    }

    const [
      totalRecords,
      statusBreakdown,
      avgLateMinutes,
      avgWorkHours,
      topLateEmployees,
    ] = await Promise.all([
      DailyRecord.countDocuments(dateQuery),

      DailyRecord.aggregate([
        { $match: dateQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      DailyRecord.aggregate([
        { $match: { ...dateQuery, lateMinutes: { $gt: 0 } } },
        { $group: { _id: null, avgLate: { $avg: "$lateMinutes" } } },
      ]),

      DailyRecord.aggregate([
        { $match: { ...dateQuery, status: { $in: ["Present", "Late"] } } },
        { $group: { _id: null, avgHours: { $avg: "$totalHours" } } },
      ]),

      DailyRecord.aggregate([
        { $match: { ...dateQuery, lateMinutes: { $gt: 0 } } },
        {
          $group: {
            _id: "$user_id",
            name: { $first: "$name" },
            totalLate: { $sum: "$lateMinutes" },
            lateCount: { $sum: 1 },
          },
        },
        { $sort: { totalLate: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Format status breakdown
    const statusStats = {
      Present: 0,
      Absent: 0,
      Late: 0,
      DayOff: 0,
    };

    statusBreakdown.forEach((item) => {
      statusStats[item._id] = item.count;
    });

    // Calculate attendance rate
    const totalWorkDays =
      statusStats.Present + statusStats.Absent + statusStats.Late;
    const attendanceRate =
      totalWorkDays > 0
        ? (
            ((statusStats.Present + statusStats.Late) / totalWorkDays) *
            100
          ).toFixed(2)
        : 0;

    res.json({
      success: true,
      data: {
        totalRecords,
        statusStats,
        attendanceRate: Number(attendanceRate),
        avgLateMinutes: avgLateMinutes[0]?.avgLate?.toFixed(2) || 0,
        avgWorkHours: avgWorkHours[0]?.avgHours?.toFixed(2) || 0,
        topLateEmployees,
      },
    });
  } catch (error) {
    console.error("Get summary stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching summary stats",
      error: error.message,
    });
  }
};

// @desc    Get available months
// @route   GET /api/attendance/months
// @access  Private
export const getAvailableMonths = async (req, res) => {
  try {
    console.log("🔍 Fetching available months...");

    // جلب جميع التواريخ الفريدة
    const dates = await DailyRecord.distinct("date");

    if (!dates || dates.length === 0) {
      return res.json({
        success: true,
        data: { months: [] },
      });
    }

    console.log(`📅 Found ${dates.length} unique dates`);

    // استخراج الأشهر الفريدة
    const monthsSet = new Set();
    dates.forEach((date) => {
      if (date && typeof date === "string" && date.length >= 7) {
        const month = date.substring(0, 7); // "2025-11"
        monthsSet.add(month);
      }
    });

    // تحويل لمصفوفة وترتيب
    const months = Array.from(monthsSet).sort().reverse(); // الأحدث أولاً

    console.log("✅ Available months:", months);

    res.json({
      success: true,
      data: { months },
    });
  } catch (error) {
    console.error("❌ Get available months error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available months",
      error: error.message,
    });
  }
};
// @desc    Get employee attendance report
// @route   GET /api/attendance/employee/:userId
// @access  Private
export const getEmployeeReport = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, month } = req.query;

    const query = { user_id: userId };

    // ✅ فلتر حسب الشهر
    if (month) {
      const [year, monthNum] = month.split("-");
      const startOfMonth = `${year}-${monthNum}-01`;
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const endOfMonth = `${year}-${monthNum}-${String(lastDay).padStart(
        2,
        "0"
      )}`;

      query.date = {
        $gte: startOfMonth,
        $lte: endOfMonth,
      };
    }
    // فلتر حسب التاريخ
    else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const records = await DailyRecord.find(query).sort({ date: 1 }).lean();

    // Calculate employee stats
    const stats = {
      totalDays: records.length,
      present: records.filter((r) => r.status === "Present").length,
      absent: records.filter((r) => r.status === "Absent").length,
      late: records.filter((r) => r.status === "Late").length,
      dayOff: records.filter((r) => r.status === "DayOff").length,
      totalLateMinutes: records.reduce((sum, r) => sum + r.lateMinutes, 0),
      totalWorkHours: records.reduce((sum, r) => sum + r.totalHours, 0),
      avgWorkHours: 0,
      attendanceRate: 0,
    };

    const workDays = stats.present + stats.late;
    stats.avgWorkHours =
      workDays > 0 ? (stats.totalWorkHours / workDays).toFixed(2) : 0;

    const totalWorkableDays = stats.totalDays - stats.dayOff;
    stats.attendanceRate =
      totalWorkableDays > 0
        ? ((workDays / totalWorkableDays) * 100).toFixed(2)
        : 0;

    // Format helpers
    function formatDateDMY(dateString) {
      if (!dateString) return "-";
      const [year, month, day] = dateString.split("-");
      return `${day}-${month}-${year}`;
    }

    function formatTime(isoString) {
      if (!isoString) return "-";
      const date = new Date(isoString);
      return `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes()
      ).padStart(2, "0")}`;
    }

    // Format table data
    const tableData = records.map((r) => ({
      id: r.user_id,
      name: r.name || "-",
      date: formatDateDMY(r.date),
      firstRecord: formatTime(r.firstCheckIn),
      lastRecord: formatTime(r.lastCheckOut),
      workHours: r.totalHours?.toFixed(2) || "-",
      lateMinutes: r.lateMinutes || "-",
      status: r.status?.toLowerCase() || "-",
    }));

    res.json({
      success: true,
      data: {
        records,
        stats,
        tableData,
      },
    });
  } catch (error) {
    console.error("Get employee report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching employee report",
      error: error.message,
    });
  }
};
// @desc    Reprocess attendance for date range
// @route   POST /api/attendance/reprocess
// @access  Private
export const reprocessAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const result = await reprocessDateRange(startDate, endDate);

    res.json({
      success: true,
      message: "Attendance reprocessed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Reprocess attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Error reprocessing attendance",
      error: error.message,
    });
  }
};

// @desc    Get upload history
// @route   GET /api/attendance/uploads
// @access  Private
export const getUploadHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, fileType } = req.query;

    const query = {};
    if (fileType) {
      query.fileType = fileType;
    }

    const skip = (page - 1) * limit;

    const [uploads, total] = await Promise.all([
      UploadHistory.find(query)
        .sort({ uploadDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      UploadHistory.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        uploads,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get upload history error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching upload history",
      error: error.message,
    });
  }
};
