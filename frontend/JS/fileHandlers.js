// ================================
// File Handlers Module
// ================================

import { STATE } from "./config.js";
import { loginToBackend } from "./auth.js";
import { uploadUsers, uploadAttendance } from "./api.js";
import { parseExcelData, parseAttendanceFile } from "./dataProcessing.js";
import { showNotification, updateFileInfo } from "./ui.js";
import { loadDailyRecordsFromBackend } from "./table.js";

/**
 * معالجة ملف Excel الموظفين
 */
async function handleUsersExcelFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  updateFileInfo("usersInfo", "⏳ جاري قراءة ملف الموظفين...", "loading");

  // تسجيل دخول إذا لم يكن مسجل
  if (!STATE.authToken) {
    await loginToBackend();
  }

  const reader = new FileReader();

  reader.onload = async function (event) {
    try {
      // قراءة Excel
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      // تحليل البيانات
      STATE.usersData = parseExcelData(jsonData);
      console.log("✅ Parsed users:", Object.keys(STATE.usersData).length);

      if (Object.keys(STATE.usersData).length === 0) {
        updateFileInfo("usersInfo", "⚠️ لم يتم العثور على موظفين", "error");
        return;
      }

      // تحويل لصيغة الـ Backend
      const usersArray = Object.values(STATE.usersData).map((userData) => ({
        user_id: userData.id,
        name: userData.name,
        job: userData.job || "",
        gender: userData.gender || "male",
        from: userData.from || "08:00",
        to: userData.to || "16:00",
      }));

      // رفع للخادم
      if (STATE.isBackendConnected && STATE.authToken) {
        try {
          const result = await uploadUsers(usersArray, file.name);

          if (result.success) {
            updateFileInfo(
              "usersInfo",
              `✅ تم رفع ${result.data.successful} موظف إلى الخادم`,
              "success"
            );
            showNotification(
              `تم رفع ${result.data.successful} موظف بنجاح`,
              "success"
            );
          } else {
            throw new Error(result.message);
          }
        } catch (error) {
          console.error("❌ Upload error:", error);
          updateFileInfo(
            "usersInfo",
            `⚠️ تم الحفظ محلياً فقط: ${usersArray.length} موظف`,
            "warning"
          );
        }
      } else {
        updateFileInfo(
          "usersInfo",
          `⚠️ تم الحفظ محلياً: ${usersArray.length} موظف (غير متصل)`,
          "warning"
        );
      }
    } catch (error) {
      console.error("❌ Parse error:", error);
      updateFileInfo("usersInfo", `❌ خطأ: ${error.message}`, "error");
    }
  };

  reader.readAsArrayBuffer(file);
}

/**
 * معالجة ملف الحضور
 */
async function handleAttendanceFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  updateFileInfo("attendanceInfo", "⏳ جاري قراءة ملف الحضور...", "loading");

  // تسجيل دخول إذا لم يكن مسجل
  if (!STATE.authToken) {
    await loginToBackend();
  }

  const reader = new FileReader();

  reader.onload = async function (event) {
    try {
      const content = event.target.result;

      // تحليل الملف
      STATE.attendanceData = parseAttendanceFile(content);
      console.log("✅ Parsed attendance:", STATE.attendanceData.length);

      if (STATE.attendanceData.length === 0) {
        updateFileInfo("attendanceInfo", "❌ لم يتم العثور على سجلات", "error");
        return;
      }

      updateFileInfo(
        "attendanceInfo",
        `⏳ جاري رفع ${STATE.attendanceData.length} سجل...`,
        "loading"
      );

      // رفع للخادم
      if (STATE.isBackendConnected && STATE.authToken) {
        try {
          // تحويل لصيغة الـ API
          const attendanceArray = STATE.attendanceData.map((log) => ({
            user_id: log.id,
            timestamp: log.datetime,
            date: log.date,
            time: log.time,
          }));

          const result = await uploadAttendance(attendanceArray, file.name);

          if (result.success) {
            updateFileInfo(
              "attendanceInfo",
              `✅ تم رفع ومعالجة ${result.data.successful} سجل`,
              "success"
            );

            showNotification(
              `تم معالجة ${result.data.processing.created} يوم جديد و${result.data.processing.updated} يوم محدث`,
              "success"
            );

            // جلب البيانات المعالجة
            console.log("🔄 جاري جلب البيانات المعالجة...");
            await loadDailyRecordsFromBackend();
          } else {
            throw new Error(result.message);
          }
        } catch (error) {
          console.error("❌ Upload error:", error);
          updateFileInfo(
            "attendanceInfo",
            `⚠️ تم الحفظ محلياً فقط: ${STATE.attendanceData.length} سجل`,
            "warning"
          );
          showNotification("فشل الرفع للخادم - سيتم العمل محلياً", "warning");
        }
      } else {
        updateFileInfo(
          "attendanceInfo",
          `⚠️ تم الحفظ محلياً: ${STATE.attendanceData.length} سجل (غير متصل)`,
          "warning"
        );
      }
    } catch (error) {
      console.error("❌ Parse error:", error);
      updateFileInfo("attendanceInfo", `❌ خطأ: ${error.message}`, "error");
    }
  };

  reader.readAsText(file, "UTF-8");
}

export { handleUsersExcelFile, handleAttendanceFile };
