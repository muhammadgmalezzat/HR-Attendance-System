import moment from "moment-timezone";
import User from "../models/User.model.js";

import RawAttendance from "../models/RawAttendance.model.js";
import DailyRecord from "../models/DailyRecord.model.js";

const timezone = process.env.TIMEZONE || "Asia/Riyadh";

// Configuration
export const getConfig = (user = null) => ({
  gracePeriod:
    user?.gracePeriodMinutes || Number(process.env.GRACE_PERIOD_MINUTES) || 15,
  absentThreshold:
    user?.absentThreshold || Number(process.env.ABSENT_THRESHOLD) || 0.5,
  defaultAutoCheckout: Number(process.env.DEFAULT_AUTO_CHECKOUT_MINUTES) || 60,
  preWindow: Number(process.env.PRE_WINDOW_MINUTES) || 120,
  postWindow: Number(process.env.POST_WINDOW_MINUTES) || 240,
});

/**
 * Process raw attendance logs and create/update daily records
 */
export const processAttendanceLogs = async (uploadBatchId = null) => {
  try {
    console.log("🔄 Starting attendance processing...");

    // Get unprocessed logs
    const query = uploadBatchId
      ? { uploadBatchId, processed: false }
      : { processed: false };

    const rawLogs = await RawAttendance.find(query).sort({ timestamp: 1 });

    if (rawLogs.length === 0) {
      console.log("ℹ️  No unprocessed logs found");
      return { processed: 0, created: 0, updated: 0 };
    }

    console.log(`📊 Found ${rawLogs.length} unprocessed logs`);

    // ✅ تغيير: جمّع السجلات حسب user_id و date فقط (بدون فلترة بالـ shift window)
    const groupedLogs = {};

    for (const log of rawLogs) {
      const key = `${log.user_id}|${log.date}`;
      if (!groupedLogs[key]) {
        groupedLogs[key] = [];
      }
      groupedLogs[key].push(log);
    }

    let created = 0;
    let updated = 0;

    // Process each user-date group
    for (const [key, logs] of Object.entries(groupedLogs)) {
      const [user_id, date] = key.split("|");

      try {
        const result = await processDailyRecord(user_id, date, logs);
        if (result.isNew) created++;
        else updated++;
      } catch (err) {
        console.error(`❌ Error processing ${key}:`, err.message);
      }
    }

    // Mark logs as processed
    await RawAttendance.updateMany(query, { $set: { processed: true } });

    console.log(
      `✅ Processing complete: ${created} created, ${updated} updated`
    );

    return {
      processed: rawLogs.length,
      created,
      updated,
    };
  } catch (error) {
    console.error("❌ Error in processAttendanceLogs:", error);
    throw error;
  }
};

// export const processAttendanceLogs = async (uploadBatchId = null) => {
//   try {
//     console.log("🔄 Starting attendance processing...");

//     // Get unprocessed logs
//     const query = uploadBatchId
//       ? { uploadBatchId, processed: false }
//       : { processed: false };

//     const rawLogs = await RawAttendance.find(query).sort({ timestamp: 1 });

//     if (rawLogs.length === 0) {
//       console.log("ℹ️  No unprocessed logs found");
//       return { processed: 0, created: 0, updated: 0 };
//     }

//     console.log(`📊 Found ${rawLogs.length} unprocessed logs`);

//     // Group logs by user and date
//     const groupedLogs = groupLogsByUserAndDate(rawLogs);

//     let created = 0;
//     let updated = 0;

//     // Process each user-date group
//     for (const [key, logs] of Object.entries(groupedLogs)) {
//       const [user_id, date] = key.split("|");

//       try {
//         const result = await processDailyRecord(user_id, date, logs);
//         if (result.isNew) created++;
//         else updated++;
//       } catch (err) {
//         console.error(`❌ Error processing ${key}:`, err.message);
//       }
//     }

//     // Mark logs as processed
//     await RawAttendance.updateMany(query, { $set: { processed: true } });

//     console.log(
//       `✅ Processing complete: ${created} created, ${updated} updated`
//     );

//     return {
//       processed: rawLogs.length,
//       created,
//       updated,
//     };
//   } catch (error) {
//     console.error("❌ Error in processAttendanceLogs:", error);
//     throw error;
//   }
// };

/**
 * Group raw logs by user_id and date
 */
export const groupLogsByUserAndDate = (logs) => {
  const grouped = {};

  logs.forEach((log) => {
    const key = `${log.user_id}|${log.date}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(log);
  });

  return grouped;
};

/**
 * Process a single daily record
 */
const processDailyRecord = async (user_id, date, logs) => {
  const user = await User.findOne({ user_id });

  if (!user) {
    console.warn(`⚠️  User ${user_id} not found, skipping`);
    return { isNew: false };
  }

  const config = getConfig(user);
  const dateObj = moment.tz(date, "YYYY-MM-DD", timezone).toDate();
  const shift = user.getShiftForDate(dateObj);

  if (!shift) {
    const record = await DailyRecord.findOneAndUpdate(
      { user_id, date },
      {
        user_id,
        name: user.name,
        date,
        status: "DayOff",
        appliedShift: null,
        totalHours: 0,
        lateMinutes: 0,
        notes: "Scheduled day off",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { isNew: !record, record };
  }

  if (logs.length === 0) {
    const record = await DailyRecord.findOneAndUpdate(
      { user_id, date },
      {
        user_id,
        name: user.name,
        date,
        status: "Absent",
        appliedShift: {
          from: shift.from,
          to: shift.to,
          nextDay: shift.nextDay || false,
        },
        totalHours: 0,
        lateMinutes: 0,
        checkIns: [],
        notes: "No attendance records found",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { isNew: !record, record };
  }

  logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const firstCheckIn = logs[0].timestamp;
  let lastCheckOut = logs[logs.length - 1].timestamp;

  // ✅ الحل: لو بصمة واحدة، خلي lastCheckOut = firstCheckIn (ساعات = 0)
  let autoCheckOut = false;
  const firstCheckInMoment = moment(firstCheckIn);
  const lastCheckOutMoment = moment(lastCheckOut);
  const timeDiff = lastCheckOutMoment.diff(firstCheckInMoment, "minutes");

  // ✅ لو بصمة واحدة أو الفرق أقل من 30 دقيقة، ساعات العمل = 0
  if (logs.length === 1 || timeDiff < 30) {
    lastCheckOut = firstCheckIn; // ✅ نفس الوقت = 0 ساعة
    autoCheckOut = false; // ✅ مفيش auto checkout
  }

  // احسب ساعات العمل الفعلية
  const totalHours = moment(lastCheckOut).diff(
    moment(firstCheckIn),
    "hours",
    true
  );

  // احسب التأخير بناءً على الشيفت
  const shiftTimes = calculateShiftWindow(date, shift, config);
  const lateMinutes = calculateLateMinutes(
    firstCheckIn,
    shiftTimes.shiftStart,
    config.gracePeriod
  );

  // حدد الحالة بناءً على ساعات العمل الفعلية
  const shiftDuration = calculateShiftDuration(shift);
  let status = "Present";

  if (totalHours < shiftDuration * config.absentThreshold) {
    status = "Absent";
  } else if (lateMinutes > 0) {
    status = "Late";
  }

  const checkIns = logs.map((log) => ({
    timestamp: log.timestamp,
    type: log.type,
  }));

  const record = await DailyRecord.findOneAndUpdate(
    { user_id, date },
    {
      user_id,
      name: user.name,
      date,
      firstCheckIn,
      lastCheckOut,
      totalHours: Number(totalHours.toFixed(2)),
      lateMinutes,
      status,
      appliedShift: {
        from: shift.from,
        to: shift.to,
        nextDay: shift.nextDay || false,
      },
      checkIns,
      autoCheckOut,
      notes: logs.length === 1 ? "Single check-in only" : "",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { isNew: !record, record };
};
// const processDailyRecord = async (user_id, date, logs) => {
//   // Get user configuration
//   const user = await User.findOne({ user_id });

//   if (!user) {
//     console.warn(`⚠️  User ${user_id} not found, skipping`);
//     return { isNew: false };
//   }

//   const config = getConfig(user);

//   // Get shift for this date
//   const dateObj = moment.tz(date, "YYYY-MM-DD", timezone).toDate();
//   const shift = user.getShiftForDate(dateObj);

//   // If shift is null (day off), mark as DayOff
//   if (!shift) {
//     const record = await DailyRecord.findOneAndUpdate(
//       { user_id, date },
//       {
//         user_id,
//         name: user.name, // ✅ حفظ الاسم
//         date,
//         status: "DayOff",
//         appliedShift: null,
//         totalHours: 0,
//         lateMinutes: 0,
//         notes: "Scheduled day off",
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );
//     return { isNew: !record, record };
//   }

//   // Calculate shift times
//   const shiftTimes = calculateShiftWindow(date, shift, config);

//   // Filter logs within the shift window
//   const validLogs = logs.filter((log) => {
//     const logTime = moment(log.timestamp);
//     return logTime.isBetween(
//       shiftTimes.windowStart,
//       shiftTimes.windowEnd,
//       null,
//       "[]"
//     );
//   });

//   if (validLogs.length === 0) {
//     // No valid logs - mark as absent
//     const record = await DailyRecord.findOneAndUpdate(
//       { user_id, date },
//       {
//         user_id,
//         name: user.name, // ✅ حفظ الاسم
//         date,
//         status: "Absent",
//         appliedShift: {
//           from: shift.from,
//           to: shift.to,
//           nextDay: shift.nextDay || false,
//         },
//         totalHours: 0,
//         lateMinutes: 0,
//         checkIns: [],
//         notes: "No attendance records found",
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );
//     return { isNew: !record, record };
//   }

//   // Sort logs by timestamp
//   validLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

//   // Get first check-in and last check-out
//   const firstCheckIn = validLogs[0].timestamp;
//   let lastCheckOut = validLogs[validLogs.length - 1].timestamp;

//   // Auto check-out if needed
//   let autoCheckOut = false;
//   const timeDiff = (lastCheckOut - firstCheckIn) / (1000 * 60); // minutes

//   if (validLogs.length === 1 || timeDiff < 30) {
//     lastCheckOut = new Date(
//       firstCheckIn.getTime() + config.defaultAutoCheckout * 60000
//     );
//     autoCheckOut = true;
//   }

//   // Calculate total hours
//   const totalHours = (lastCheckOut - firstCheckIn) / (1000 * 60 * 60);

//   // Calculate late minutes
//   const lateMinutes = calculateLateMinutes(
//     firstCheckIn,
//     shiftTimes.shiftStart,
//     config.gracePeriod
//   );

//   // Determine status
//   const shiftDuration = calculateShiftDuration(shift);
//   let status = "Present";

//   if (totalHours < shiftDuration * config.absentThreshold) {
//     status = "Absent";
//   } else if (lateMinutes > 0) {
//     status = "Late";
//   }

//   // Prepare check-ins array
//   const checkIns = validLogs.map((log) => ({
//     timestamp: log.timestamp,
//     type: log.type,
//   }));

//   // Upsert daily record
//   const record = await DailyRecord.findOneAndUpdate(
//     { user_id, date },
//     {
//       user_id,
//       name: user.name, // ✅ حفظ الاسم
//       date,
//       firstCheckIn,
//       lastCheckOut,
//       totalHours: Number(totalHours.toFixed(2)),
//       lateMinutes,
//       status,
//       appliedShift: {
//         from: shift.from,
//         to: shift.to,
//         nextDay: shift.nextDay || false,
//       },
//       checkIns,
//       autoCheckOut,
//       notes: autoCheckOut ? "Auto check-out applied" : "",
//     },
//     { upsert: true, new: true, setDefaultsOnInsert: true }
//   );

//   return { isNew: !record, record };
// };
/**
 * Calculate shift window (when to look for attendance)
 */
export const calculateShiftWindow = (date, shift, config) => {
  const shiftStart = moment.tz(
    `${date} ${shift.from}`,
    "YYYY-MM-DD HH:mm",
    timezone
  );
  let shiftEnd = moment.tz(`${date} ${shift.to}`, "YYYY-MM-DD HH:mm", timezone);

  // Handle night shifts (cross midnight)
  if (shift.nextDay || shift.to < shift.from) {
    shiftEnd.add(1, "day");
  }

  const windowStart = shiftStart.clone().subtract(config.preWindow, "minutes");
  const windowEnd = shiftEnd.clone().add(config.postWindow, "minutes");

  return {
    shiftStart: shiftStart.toDate(),
    shiftEnd: shiftEnd.toDate(),
    windowStart: windowStart.toDate(),
    windowEnd: windowEnd.toDate(),
  };
};

/**
 * Calculate late minutes
 */
export const calculateLateMinutes = (checkIn, shiftStart, gracePeriod) => {
  const checkInTime = moment(checkIn);
  const shiftStartTime = moment(shiftStart);
  const graceTime = shiftStartTime.clone().add(gracePeriod, "minutes");

  if (checkInTime.isAfter(graceTime)) {
    return Math.round(checkInTime.diff(shiftStartTime, "minutes"));
  }

  return 0;
};

/**
 * Calculate shift duration in hours
 */
export const calculateShiftDuration = (shift) => {
  const [fromHour, fromMin] = shift.from.split(":").map(Number);
  const [toHour, toMin] = shift.to.split(":").map(Number);

  let fromMinutes = fromHour * 60 + fromMin;
  let toMinutes = toHour * 60 + toMin;

  // Handle night shift
  if (shift.nextDay || toMinutes < fromMinutes) {
    toMinutes += 24 * 60;
  }

  return (toMinutes - fromMinutes) / 60;
};

/**
 * Reprocess all records for a specific date range
 */
export const reprocessDateRange = async (startDate, endDate) => {
  try {
    // Mark logs in range as unprocessed
    await RawAttendance.updateMany(
      {
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
      { $set: { processed: false } }
    );

    // Delete existing daily records in range
    await DailyRecord.deleteMany({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    // Reprocess
    return await processAttendanceLogs();
  } catch (error) {
    console.error("Error in reprocessDateRange:", error);
    throw error;
  }
};
