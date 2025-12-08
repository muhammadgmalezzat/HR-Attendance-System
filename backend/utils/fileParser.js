import moment from "moment-timezone";

/**
 * Parse attendance data from frontend
 * Expected format: Array of objects with user_id, timestamp
 * OR array of strings (raw lines from .dat file)
 */
export const parseAttendanceData = (data) => {
  const timezone = process.env.TIMEZONE || "Asia/Riyadh";
  const records = [];
  const errors = [];

  try {
    // If data is already parsed objects
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
      data.forEach((record, index) => {
        try {
          const parsed = parseAttendanceRecord(record, timezone);
          if (parsed) {
            records.push(parsed);
          }
        } catch (err) {
          errors.push({
            line: index + 1,
            data: record,
            error: err.message,
          });
        }
      });
    }
    // If data is array of strings (raw lines)
    else if (
      Array.isArray(data) &&
      data.length > 0 &&
      typeof data[0] === "string"
    ) {
      data.forEach((line, index) => {
        try {
          const parsed = parseAttendanceLine(line, timezone);
          if (parsed) {
            records.push(parsed);
          }
        } catch (err) {
          errors.push({
            line: index + 1,
            data: line,
            error: err.message,
          });
        }
      });
    }
  } catch (error) {
    throw new Error(`Failed to parse attendance data: ${error.message}`);
  }

  return { records, errors };
};

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
  if (!user.user_id || !user.name) {
    throw new Error("Missing required fields: user_id or name");
  }

  const parsed = {
    user_id: String(user.user_id).trim(),
    name: user.name.trim(),
    job: user.job ? user.job.trim() : "",
    gender: user.gender ? user.gender.toLowerCase() : "male",
  };

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
