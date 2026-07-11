// ================================
// Data Processing Module
// ================================

import { STATE, CONFIG } from "./config.js";

/**
 * تحليل ملف Excel للموظفين
 */
function parseExcelData(data) {
  const users = {};
  if (data.length === 0) return users;

  const headers = data[0];
  const userIdCol = findColumnIndex(headers, ["userData", "id", "رقم"]);
  const nameCol = findColumnIndex(headers, ["name", "الاسم", "اسم"]);
  const jobCol = findColumnIndex(headers, ["job", "الوظيفة", "وظيفة"]);
  const genderCol = findColumnIndex(headers, [
    "gender",
    "الجنس",
    "جنس",
    "gendre",
  ]);
  const fromCol = findColumnIndex(headers, ["from", "من"]);
  const toCol = findColumnIndex(headers, ["to", "إلى"]);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const userId = row[userIdCol]?.toString().trim();
    const name = row[nameCol]?.toString().trim();
    const fromTime = row[fromCol]?.toString().trim();
    const toTime = row[toCol]?.toString().trim();

    if (userId && name) {
      users[userId] = {
        id: userId,
        name: name,
        job: row[jobCol]?.toString().trim() || "",
        gender: row[genderCol]?.toString().trim() || "male",
        from: fromTime || CONFIG.DEFAULT_SHIFT_START,
        to: toTime || "16:00",
      };
    }
  }

  return users;
}

/**
 * إيجاد رقم العمود من Header
 */
function findColumnIndex(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]?.toString().toLowerCase().trim();
    if (possibleNames.some((name) => header.includes(name.toLowerCase()))) {
      return i;
    }
  }
  return 0;
}

/**
 * تحليل ملف الحضور CSV/DAT
 */
function parseAttendanceFile(content) {
  const attendance = [];
  const lines = content.split("\n");

  for (let line of lines) {
    if (!line.trim()) continue;

    const parts = line.split("\t").filter((part) => part.trim());
    if (parts.length >= 2) {
      const id = parts[0].replace(/\D/g, "");
      const datetime = parts[1].trim();

      if (id && datetime) {
        attendance.push({
          id: id,
          datetime: datetime,
          date: datetime.split(" ")[0],
          time: datetime.split(" ")[1],
        });
      }
    }
  }

  return attendance;
}

/**
 * معالجة بيانات الحضور محلياً (للـ Offline Mode)
 */
function processAttendanceDataLocally() {
  const report = [];
  const shiftStart =
    document.getElementById("shiftStart")?.value || CONFIG.DEFAULT_SHIFT_START;
  const expectedHours = parseFloat(
    document.getElementById("workHours")?.value || CONFIG.DEFAULT_WORK_HOURS
  );

  const dailyRecords = {};

  // تجميع السجلات حسب الموظف واليوم
  for (const record of STATE.attendanceData) {
    const key = `${record.id}|${record.date}`;
    if (!dailyRecords[key]) {
      dailyRecords[key] = {
        id: record.id,
        date: record.date,
        records: [],
      };
    }
    dailyRecords[key].records.push(record.time);
  }

  // معالجة كل يوم
  for (const key in dailyRecords) {
    const [id, date] = key.split("|");
    const records = dailyRecords[key].records.sort();

    const firstRecord = records[0];
    const lastRecord = records[records.length - 1];

    // حساب ساعات العمل
    const startTime = new Date(`2000-01-01 ${firstRecord}`);
    const endTime = new Date(`2000-01-01 ${lastRecord}`);
    const workHours = (endTime - startTime) / (1000 * 60 * 60);

    // حساب التأخير
    const shiftStartTime = new Date(`2000-01-01 ${shiftStart}`);
    const lateMinutes =
      startTime > shiftStartTime
        ? Math.round((startTime - shiftStartTime) / (1000 * 60))
        : 0;

    // تحديد الحالة
    let status = "present";
    if (workHours < expectedHours * 0.5) {
      status = "absent";
    } else if (lateMinutes > 30) {
      status = "late";
    }

    report.push({
      id: id,
      name: STATE.usersData[id]?.name || "غير معروف",
      date: date,
      firstRecord: firstRecord,
      lastRecord: lastRecord,
      workHours: workHours.toFixed(2),
      lateMinutes: lateMinutes,
      status: status,
    });
  }

  return report.sort((a, b) => {
    if (a.date === b.date) {
      return a.id.localeCompare(b.id);
    }
    return a.date.localeCompare(b.date);
  });
}

/**
 * تحويل DailyRecord من Backend لصيغة الجدول
 */
function transformDailyRecord(record) {
  let statusArabic = "غائب";
  let statusClass = "absent";

  switch (record.status) {
    case "Present":
      statusArabic = "حاضر";
      statusClass = "present";
      break;
    case "Late":
      statusArabic = "متأخر";
      statusClass = "late";
      break;
    case "DayOff":
      statusArabic = "عطلة";
      statusClass = "present";
      break;
    case "Absent":
    default:
      statusArabic = "غائب";
      statusClass = "absent";
      break;
  }

  return {
    id: record.user_id,
    name:
      record.user?.name || STATE.usersData[record.user_id]?.name || "غير معروف",
    date: record.date,
    firstRecord: record.firstCheckIn
      ? new Date(record.firstCheckIn).toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      : "-",
    lastRecord: record.lastCheckOut
      ? new Date(record.lastCheckOut).toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      : "-",
    workHours: record.totalHours ? record.totalHours.toFixed(2) : "0.00",
    lateMinutes: record.lateMinutes || 0,
    status: statusClass,
    statusText: statusArabic,
  };
}

/**
 * تطبيق الفلاتر على البيانات
 */
function applyFilters(data, filters = {}) {
  let result = [...data];

  // فلترة حسب الحالة
  if (filters.status && filters.status !== "all") {
    result = result.filter(
      (record) => record.status.toLowerCase() === filters.status.toLowerCase()
    );
  }

  // فلترة حسب البحث
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    result = result.filter(
      (record) =>
        (record.name && record.name.toLowerCase().includes(term)) ||
        (record.id && record.id.toString().includes(term))
    );
  }

  // فلترة حسب التاريخ
  if (filters.startDate) {
    result = result.filter((record) => record.date >= filters.startDate);
  }

  if (filters.endDate) {
    result = result.filter((record) => record.date <= filters.endDate);
  }

  return result;
}

export {
  parseExcelData,
  findColumnIndex,
  parseAttendanceFile,
  processAttendanceDataLocally,
  transformDailyRecord,
  applyFilters,
};
