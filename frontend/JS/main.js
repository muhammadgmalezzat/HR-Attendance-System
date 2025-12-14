// ================================
// Main Application Entry Point
// ================================

import { STATE } from "./config.js";
import { initAuth, loginToBackend } from "./auth.js";
import { handleUsersExcelFile, handleAttendanceFile } from "./fileHandlers.js";
import {
  displayData,
  loadDailyRecordsFromBackend,
  generateLocalReport,
  loadAvailableMonths,
} from "./table.js";
import {
  downloadExcel,
  downloadEmployeeExcel,
  downloadIndividualExcels,
} from "./exports.js";
import { updateConnectionStatus, resetUI, updateQuickStats } from "./ui.js";
import { applyFilters } from "./dataProcessing.js";

/**
 * تهيئة التطبيق عند تحميل الصفحة
 */
async function initializeApp() {
  console.log("🚀 Initializing Attendance System...");

  // تهيئة المصادقة
  await initAuth();
  updateConnectionStatus();

  //  جلب الأشهر المتاحة
  if (STATE.isBackendConnected) {
    await loadAvailableMonths();
  }
  // ربط أحداث الملفات
  setupFileHandlers();

  // ربط أحداث الأزرار
  setupButtonHandlers();

  // ربط أحداث الفلاتر
  setupFilterHandlers();

  // تحديث الإحصائيات
  updateQuickStats();

  console.log("✅ App initialized successfully");
}

/**
 * ربط معالجات الملفات
 */
function setupFileHandlers() {
  const usersFileInput = document.getElementById("excelUsersFile");
  const attendanceFileInput = document.getElementById("attendanceFile");

  if (usersFileInput) {
    usersFileInput.addEventListener("change", handleUsersExcelFile);
  }

  if (attendanceFileInput) {
    attendanceFileInput.addEventListener("change", handleAttendanceFile);
  }
}

/**
 * ربط معالجات الأزرار
 */
function setupButtonHandlers() {
  // زر توليد التقرير
  const generateBtn = document.getElementById("generateReport");
  if (generateBtn) {
    generateBtn.addEventListener("click", generateLocalReport);
  }

  // زر جلب من الخادم
  const loadBtn = document.getElementById("loadFromBackend");
  if (loadBtn) {
    loadBtn.addEventListener("click", loadDailyRecordsFromBackend);
  }

  // أزرار التحميل
  const downloadExcelBtn = document.getElementById("downloadExcel");
  if (downloadExcelBtn) {
    downloadExcelBtn.addEventListener("click", downloadExcel);
  }

  const downloadEmployeeBtn = document.getElementById("downloadEmployeeExcel");
  if (downloadEmployeeBtn) {
    downloadEmployeeBtn.addEventListener("click", downloadEmployeeExcel);
  }

  const downloadIndividualBtn = document.getElementById("downloadIndividual");
  if (downloadIndividualBtn) {
    downloadIndividualBtn.addEventListener("click", downloadIndividualExcels);
  }

  // زر إعادة التعيين
  const resetBtn = document.getElementById("resetData");
  if (resetBtn) {
    resetBtn.addEventListener("click", handleReset);
  }

  // زر إعادة الاتصال
  const reconnectBtn = document.getElementById("reconnectBtn");
  if (reconnectBtn) {
    reconnectBtn.addEventListener("click", async () => {
      reconnectBtn.disabled = true;
      reconnectBtn.textContent = "⏳ جاري الاتصال...";

      await loginToBackend();
      updateConnectionStatus();

      reconnectBtn.disabled = false;
      reconnectBtn.innerHTML = "<span>🔄 إعادة الاتصال</span>";
    });
  }
}

/**
 * ربط معالجات الفلاتر
 */
function setupFilterHandlers() {
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const monthFilter = document.getElementById("monthFilter"); // ✅ إضافة
  const applyFiltersBtn = document.getElementById("applyFilters");

  const applyCurrentFilters = () => {
    if (!STATE.originalData || STATE.originalData.length === 0) {
      console.warn("⚠️ No original data to filter");
      return;
    }

    const filters = {
      searchTerm: searchInput?.value || "",
      status: statusFilter?.value || "all",
    };

    console.log("🔍 Applying filters:", filters);

    STATE.filteredData = applyFilters(STATE.originalData, filters);
    STATE.currentPage = 1;
    displayData();

    console.log(
      `✅ Filtered: ${STATE.filteredData.length} / ${STATE.originalData.length} records`
    );
  };

  // ✅ عند تغيير الشهر، نجلب البيانات من جديد
  if (monthFilter) {
    monthFilter.addEventListener("change", async () => {
      STATE.selectedMonth = monthFilter.value;
      await loadDailyRecordsFromBackend();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyCurrentFilters);
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", applyCurrentFilters);
  }

  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", applyCurrentFilters);
  }
}

/**
 * معالج زر إعادة التعيين
 */
function handleReset() {
  if (!confirm("هل أنت متأكد من إعادة تعيين جميع البيانات؟")) {
    return;
  }

  // مسح البيانات
  STATE.usersData = {};
  STATE.attendanceData = [];
  STATE.originalData = []; // ✅ مسح البيانات الأصلية
  STATE.filteredData = [];
  STATE.currentPage = 1;

  // مسح الملفات
  const usersFileInput = document.getElementById("excelUsersFile");
  const attendanceFileInput = document.getElementById("attendanceFile");

  if (usersFileInput) usersFileInput.value = "";
  if (attendanceFileInput) attendanceFileInput.value = "";

  // مسح الفلاتر
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");

  if (searchInput) searchInput.value = "";
  if (statusFilter) statusFilter.value = "all";

  // إعادة تعيين الواجهة
  resetUI();

  console.log("✅ Data reset complete");
}

// تهيئة التطبيق عند تحميل الصفحة
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

// Export للاستخدام في HTML onclick attributes
window.changePage = (page) => {
  STATE.currentPage = page;
  displayData();
};
