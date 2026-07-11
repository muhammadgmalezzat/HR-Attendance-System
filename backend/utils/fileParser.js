import moment from "moment-timezone";

/**
 * Parse attendance data from frontend
 * Expected format: Array of objects with user_id, timestamp
 * OR array of strings (raw lines from .dat file)
//  */


/**
 * Parse single attendance record object
 */
export const parseAttendanceRecord = (record, timezone) => {
  if (!record.user_id || !record.timestamp) {
    throw new Error("Missing required fields: user_id or timestamp");
  }

  const user_id = String(record.user_id).trim();
  const timestamp = moment.tz(record.timestamp, timezone);

  if (!timestamp.isValid()) {
    throw new Error("Invalid timestamp format");
  }

  return {
    user_id,
    timestamp: timestamp.toDate(),
    date: timestamp.format("YYYY-MM-DD"),
    time: timestamp.format("HH:mm:ss"),
    type: record.type || "unknown",
  };
};

/**
 * Parse single attendance line (from .dat file)
 * Format: "USER_ID  YYYY-MM-DD HH:mm:ss  FLAGS..."
 * Example: "118	2025-11-16 00:00:02	1	1	1	0"
 */
export const parseAttendanceLine = (line, timezone) => {
  if (!line || !line.trim()) {
    return null;
  }

  // Split by whitespace (tabs or multiple spaces)
  const parts = line.trim().split(/\s+/);

  if (parts.length < 3) {
    throw new Error("Invalid line format");
  }

  const user_id = parts[0].trim();
  const date = parts[1].trim();
  const time = parts[2].trim();

  // Validate user_id is numeric
  if (!/^\d+$/.test(user_id)) {
    throw new Error("Invalid user_id format");
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date format");
  }

  // Create timestamp
  const datetimeStr = `${date} ${time}`;
  const timestamp = moment.tz(datetimeStr, "YYYY-MM-DD HH:mm:ss", timezone);

  if (!timestamp.isValid()) {
    throw new Error("Invalid timestamp");
  }

  return {
    user_id,
    timestamp: timestamp.toDate(),
    date,
    time,
    type: "unknown",
  };
};

/**
 * Parse attendance data from frontend
 */
export const parseAttendanceData = (data) => {
  const timezone = process.env.TIMEZONE || "Asia/Riyadh";
  const records = [];
  const errors = [];

  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Data must be a non-empty array");
    }

    data.forEach((record, index) => {
      try {
        // التحقق من الحقول المطلوبة
        if (!record.user_id || !record.timestamp) {
          throw new Error("Missing required fields: user_id or timestamp");
        }

        const user_id = String(record.user_id).trim();

        // إنشاء timestamp من التاريخ والوقت
        let timestamp;
        if (record.timestamp.includes(" ")) {
          // Format: "2025-11-01 00:01:28"
          timestamp = moment.tz(
            record.timestamp,
            "YYYY-MM-DD HH:mm:ss",
            timezone
          );
        } else {
          timestamp = moment.tz(record.timestamp, timezone);
        }

        if (!timestamp.isValid()) {
          throw new Error(`Invalid timestamp: ${record.timestamp}`);
        }

        records.push({
          user_id,
          timestamp: timestamp.toDate(),
          date: timestamp.format("YYYY-MM-DD"),
          time: timestamp.format("HH:mm:ss"),
          type: record.type || "unknown",
        });
      } catch (err) {
        errors.push({
          line: index + 1,
          data: record,
          error: err.message,
        });
      }
    });
  } catch (error) {
    throw new Error(`Failed to parse attendance data: ${error.message}`);
  }

  console.log(`✅ Parsed ${records.length} records, ${errors.length} errors`);
  return { records, errors };
};
/**
 * Parse users data from frontend
 * Expected: Array of user objects
 */
export const parseUsersData = (data) => {
  const users = [];
  const errors = [];

  if (!Array.isArray(data)) {
    throw new Error("Users data must be an array");
  }

  data.forEach((user, index) => {
    try {
      const parsed = parseUserRecord(user);
      users.push(parsed);
    } catch (err) {
      errors.push({
        line: index + 1,
        data: user,
        error: err.message,
      });
    }
  });

  return { users, errors };
};

/**
 * Parse single user record
 */
export const parseUserRecord = (user) => {
  // ✅ التحقق من الحقول المطلوبة
  if (!user.user_id || !user.name) {
    throw new Error("Missing required fields: user_id or name");
  }

  const parsed = {
    user_id: String(user.user_id).trim(),
    name: String(user.name).trim(), // ✅ استخدم name مباشرة
    job: user.job ? String(user.job).trim() : "",
    gender: user.gender ? String(user.gender).toLowerCase() : "male",
  };

  console.log("🚀 ~ parseUserRecord ~ parsed:", parsed);

  // Handle shift configuration
  if (user.shiftSchedule && typeof user.shiftSchedule === "object") {
    // Weekly schedule provided
    parsed.shiftSchedule = user.shiftSchedule;
  } else {
    // Default shift
    parsed.from = user.from || "08:00";
    parsed.to = user.to || "16:00";
  }

  // Optional per-user settings
  if (user.gracePeriodMinutes !== undefined) {
    parsed.gracePeriodMinutes = Number(user.gracePeriodMinutes);
  }
  if (user.absentThreshold !== undefined) {
    parsed.absentThreshold = Number(user.absentThreshold);
  }

  return parsed;
};
