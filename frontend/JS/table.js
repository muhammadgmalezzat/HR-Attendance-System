// ================================
// Table Display Module
// ================================

import { STATE, CONFIG } from "./config.js";
import { getDailyRecords, getAvailableMonths } from "./api.js";
import {
  transformDailyRecord,
  processAttendanceDataLocally,
} from "./dataProcessing.js";
import {
  showNotification,
  updateQuickStats,
  toggleDownloadButtons,
} from "./ui.js";
/**
 * عرض البيانات في الجدول
 */

function getArabicDayName(dateString) {
  // dateString format: "YYYY-MM-DD"
  const date = new Date(dateString);
  const dayIndex = date.getDay();

  const arabicDays = {
    0: "الأحد",
    1: "الإثنين",
    2: "الثلاثاء",
    3: "الأربعاء",
    4: "الخميس",
    5: "الجمعة",
    6: "السبت",
  };

  return arabicDays[dayIndex] || "";
}


function displayData() {
  const tbody = document.getElementById("tableBody");

  if (!tbody) {
    console.error("❌ Table body element not found");
    return;
  }

  if (!Array.isArray(STATE.filteredData) || STATE.filteredData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:40px">
          لا توجد بيانات لعرضها
        </td>
      </tr>
    `;
    return;
  }

  // Pagination
  const totalPages = Math.ceil(
    STATE.filteredData.length / CONFIG.ITEMS_PER_PAGE
  );
  const startIndex = (STATE.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
  const endIndex = Math.min(
    startIndex + CONFIG.ITEMS_PER_PAGE,
    STATE.filteredData.length
  );
  const pageData = STATE.filteredData.slice(startIndex, endIndex);

  // بناء HTML
  let html = "";
  for (const record of pageData) {
    const statusClass = record.status || "absent";
    const statusText =
      record.statusText ||
      (statusClass === "present"
        ? "حاضر"
        : statusClass === "late"
        ? "متأخر"
        : "غائب");

 const dayName = getArabicDayName(record.date);
 const dateWithDay = `${record.date} (${dayName})`;
    html += `
       <tr>
        <td>${record.id}</td>
        <td><strong>${record.name}</strong></td>
        <td>${dateWithDay}</td>
        <td>${record.firstRecord || "-"}</td>
        <td>${record.lastRecord || "-"}</td>
        <td>${record.workHours}</td>
        <td>${record.lateMinutes > 0 ? record.lateMinutes : "-"}</td>
        <td><span class="${statusClass}">${statusText}</span></td>
      </tr>
    `;
  }

  tbody.innerHTML = html;
  createPagination(totalPages);
}

/**
 * إنشاء أزرار Pagination
 */
function createPagination(totalPages) {
  const pagination = document.getElementById("pagination");
  if (!pagination) return;

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = "";

  // زر السابق
  if (STATE.currentPage > 1) {
    html += `<button class="page-btn" onclick="window.changePage(${
      STATE.currentPage - 1
    })">السابق</button>`;
  }

  // أزرار الأرقام
  const startPage = Math.max(1, STATE.currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${
      i === STATE.currentPage ? "active" : ""
    }" 
              onclick="window.changePage(${i})">${i}</button>`;
  }

  // زر التالي
  if (STATE.currentPage < totalPages) {
    html += `<button class="page-btn" onclick="window.changePage(${
      STATE.currentPage + 1
    })">التالي</button>`;
  }

  pagination.innerHTML = html;
}

/**
 * تغيير الصفحة
 */
function changePage(page) {
  STATE.currentPage = page;
  displayData();
}

/**
 * توليد التقرير محلياً (Offline Mode)
 */
function generateLocalReport() {
  if (
    Object.keys(STATE.usersData).length === 0 ||
    STATE.attendanceData.length === 0
  ) {
    showNotification("⚠️ يرجى تحميل ملف الموظفين وملف الحضور أولاً", "warning");
    return;
  }

  const processedData = processAttendanceDataLocally();

  // ✅ حفظ في originalData
  STATE.originalData = processedData;
  STATE.filteredData = [...processedData]; // نسخة للعرض

  STATE.currentPage = 1;
  displayData();

  toggleDownloadButtons(true);
  updateQuickStats();

  showNotification("✅ تم توليد التقرير محلياً", "success");
}

// Make changePage globally accessible for onclick
if (typeof window !== "undefined") {
  window.changePage = changePage;
}

/**
 * جلب الأشهر المتاحة
 */
async function loadAvailableMonths() {
  if (!STATE.isBackendConnected || !STATE.authToken) return;

  try {
    const result = await getAvailableMonths();

    if (result.success && result.data.months) {
      STATE.availableMonths = result.data.months;
      populateMonthFilter();
    }
  } catch (error) {
    console.error("Error loading months:", error);
  }
}

/**
 * ملء قائمة الأشهر
 */
function populateMonthFilter() {
  const monthFilter = document.getElementById("monthFilter");
  if (!monthFilter) return;

  // مسح الخيارات القديمة
  monthFilter.innerHTML = '<option value="all">جميع الأشهر</option>';

  // إضافة الأشهر
  STATE.availableMonths.forEach((month) => {
    const [year, monthNum] = month.split("-");
    const monthName = getMonthName(monthNum);
    const option = document.createElement("option");
    option.value = month;
    option.textContent = `${monthName} ${year}`;
    monthFilter.appendChild(option);
  });
}

/**
 * تحويل رقم الشهر لاسم
 */
function getMonthName(monthNum) {
  const months = {
    "01": "يناير",
    "02": "فبراير",
    "03": "مارس",
    "04": "أبريل",
    "05": "مايو",
    "06": "يونيو",
    "07": "يوليو",
    "08": "أغسطس",
    "09": "سبتمبر",
    10: "أكتوبر",
    11: "نوفمبر",
    12: "ديسمبر",
  };
  return months[monthNum] || monthNum;
}

/**
 * جلب البيانات من Backend مع الفلاتر
 */
async function loadDailyRecordsFromBackend(filters = {}) {
  if (!STATE.isBackendConnected || !STATE.authToken) {
    console.warn("⚠️ Not connected to backend");
    showNotification("⚠️ غير متصل بالخادم", "warning");
    return;
  }

  try {
    showNotification("جاري جلب البيانات من الخادم...", "info");

    // بناء الـ params
    const params = {
      limit: 5000,
      sortBy: "date",
      sortOrder: "desc",
      ...filters,
    };

    // إضافة فلتر الشهر إذا كان محدد
    if (STATE.selectedMonth && STATE.selectedMonth !== "all") {
      params.month = STATE.selectedMonth;
    }

    const result = await getDailyRecords(params);

    if (result.success && result.data.records) {
      // ✅ البيانات جاية من Backend مع الاسم
      const transformedRecords = result.data.records.map((record) => {
        // ✅ لو totalHours = 0 والموظف حاضر، فيه مشكلة
        let workHours = record.totalHours
          ? record.totalHours.toFixed(2)
          : "0.00";

        // Debug: لو فيه بصمة واحدة وساعات العمل 0
        if (record.checkIns?.length === 1 && record.totalHours === 0) {
          console.warn(
            `⚠️ User ${record.user_id} on ${record.date}: Single check-in but 0 hours`
          );
        }

        return {
          id: record.user_id,
          name: record.name || "غير معروف",
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
          workHours,
          lateMinutes: record.lateMinutes || 0,
          status: record.status.toLowerCase(),
          statusText:
            record.status === "Present"
              ? "حاضر"
              : record.status === "Late"
              ? "متأخر"
              : record.status === "DayOff"
              ? "عطلة"
              : "غائب",
        };
      });
      STATE.originalData = transformedRecords;
      STATE.filteredData = [...transformedRecords];

      console.log(`✅ Loaded ${STATE.originalData.length} daily records`);

      STATE.currentPage = 1;
      displayData();
      updateQuickStats();
      toggleDownloadButtons(true);

      showNotification(
        `✅ تم جلب ${STATE.originalData.length} سجل من الخادم`,
        "success"
      );
    } else {
      throw new Error(result.message || "Failed to fetch records");
    }
  } catch (error) {
    console.error("❌ Error loading daily records:", error);
    showNotification(`❌ فشل جلب البيانات: ${error.message}`, "error");
  }
}
export {
  displayData,
  createPagination,
  changePage,
  loadDailyRecordsFromBackend,
  generateLocalReport,
  loadAvailableMonths,
  populateMonthFilter,
};
