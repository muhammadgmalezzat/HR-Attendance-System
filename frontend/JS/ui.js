// ================================
// UI Module
// ================================

import { STATE } from "./config.js";

/**
 * إظهار إشعار
 */
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${
      type === "success"
        ? "#28a745"
        : type === "warning"
        ? "#ffc107"
        : type === "error"
        ? "#dc3545"
        : "#17a2b8"
    };
    color: white;
    border-radius: 5px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
    max-width: 400px;
    font-size: 14px;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

/**
 * تحديث معلومات الملف
 */
function updateFileInfo(elementId, message, className = "") {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.style.display = "block";
  element.textContent = message;

  // تحديد الـ class
  element.className = "file-info";
  if (className) {
    element.classList.add(className);
  }
}

/**
 * تحديث الإحصائيات السريعة
 */
function updateQuickStats() {
  const totalEmployeesEl = document.getElementById("totalEmployees");
  const avgAttendanceEl = document.getElementById("avgAttendance");

  if (totalEmployeesEl) {
    totalEmployeesEl.textContent = Object.keys(STATE.usersData).length;
  }

  // ✅ استخدام originalData لحساب النسبة الصحيحة
  const dataToUse =
    STATE.originalData.length > 0 ? STATE.originalData : STATE.filteredData;

  if (avgAttendanceEl && dataToUse.length > 0) {
    const presentCount = dataToUse.filter(
      (r) => r.status === "present" || r.status === "Present"
    ).length;
    const attendanceRate = Math.round((presentCount / dataToUse.length) * 100);
    avgAttendanceEl.textContent = `${attendanceRate}%`;
  } else if (avgAttendanceEl) {
    avgAttendanceEl.textContent = "0%";
  }
}

/**
 * تحديث حالة الاتصال
 */
function updateConnectionStatus() {
  const statusEl = document.getElementById("connectionStatus");
  const textEl = document.getElementById("statusText");
  const reconnectBtn = document.getElementById("reconnectBtn");

  if (!statusEl || !textEl) return;

  if (STATE.isBackendConnected) {
    statusEl.style.background = "#d4edda";
    statusEl.style.color = "#155724";
    textEl.textContent = "✅ متصل بالخادم";
    if (reconnectBtn) reconnectBtn.style.display = "none";
  } else {
    statusEl.style.background = "#fff3cd";
    statusEl.style.color = "#856404";
    textEl.textContent = "⚠️ غير متصل (وضع Offline)";
    if (reconnectBtn) reconnectBtn.style.display = "block";
  }
}

/**
 * تمكين/تعطيل أزرار التحميل
 */
function toggleDownloadButtons(enabled) {
  const buttons = [
    "downloadExcel",
    "downloadEmployeeExcel",
    "downloadIndividual",
  ];

  buttons.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !enabled;
  });
}

/**
 * إعادة تعيين واجهة المستخدم
 */
function resetUI() {
  // مسح الجداول
  const tableBody = document.getElementById("tableBody");
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #999;">
          قم برفع ملفات الموظفين والحضور أولاً
        </td>
      </tr>
    `;
  }

  // مسح Pagination
  const pagination = document.getElementById("pagination");
  if (pagination) {
    pagination.innerHTML = "";
  }

  // إخفاء معلومات الملفات
  const usersInfo = document.getElementById("usersInfo");
  const attendanceInfo = document.getElementById("attendanceInfo");
  if (usersInfo) usersInfo.style.display = "none";
  if (attendanceInfo) attendanceInfo.style.display = "none";

  // تعطيل أزرار التحميل
  toggleDownloadButtons(false);

  // تحديث الإحصائيات
  updateQuickStats();
}

/**
 * عرض Loading Spinner
 */
function showLoading(elementId, show = true) {
  const element = document.getElementById(elementId);
  if (!element) return;

  if (show) {
    element.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div class="spinner"></div>
        <p>جاري التحميل...</p>
      </div>
    `;
  }
}

export {
  showNotification,
  updateFileInfo,
  updateQuickStats,
  updateConnectionStatus,
  toggleDownloadButtons,
  resetUI,
  showLoading,
};
