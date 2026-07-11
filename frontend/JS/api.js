// ================================
// API Service Module
// ================================

import { CONFIG, STATE } from "./config.js";

/**
 * Base fetch wrapper مع error handling
 */
async function apiRequest(endpoint, options = {}) {
  const defaultHeaders = {
    "Content-Type": "application/json",
    ...(STATE.authToken && { Authorization: `Bearer ${STATE.authToken}` }),
  };

  try {
    const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ API Error [${endpoint}]:`, error);
    throw error;
  }
}

// =============================
// Users API
// =============================

/**
 * رفع الموظفين
 */
async function uploadUsers(users, fileName) {
  return await apiRequest("/users/bulk-upload", {
    method: "POST",
    body: JSON.stringify({ users, fileName }),
  });
}

/**
 * جلب جميع الموظفين
 */
async function getAllUsers(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  return await apiRequest(`/users?${queryString}`);
}

/**
 * جلب موظف واحد
 */
async function getUser(userId) {
  return await apiRequest(`/users/${userId}`);
}

// =============================
// Attendance API
// =============================

/**
 * رفع الحضور
 */
async function uploadAttendance(attendance, fileName) {
  return await apiRequest("/attendance/upload", {
    method: "POST",
    body: JSON.stringify({ attendance, fileName }),
  });
}

/**
 * جلب السجلات اليومية
 */
async function getDailyRecords(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  return await apiRequest(`/attendance/daily?${queryString}`);
}

/**
 * جلب تقرير موظف معين
 */
async function getEmployeeReport(userId, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  return await apiRequest(`/attendance/employee/${userId}?${queryString}`);
}

/**
 * جلب الإحصائيات
 */
async function getAttendanceStats(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  return await apiRequest(`/attendance/stats?${queryString}`);
}

/**
 * جلب الأشهر المتاحة
 */
async function getAvailableMonths() {
  return await apiRequest('/attendance/months');
}

/**
 * إعادة معالجة البيانات
 */
async function reprocessAttendance(startDate, endDate) {
  return await apiRequest("/attendance/reprocess", {
    method: "POST",
    body: JSON.stringify({ startDate, endDate }),
  });
}

export {
  uploadUsers,
  getAllUsers,
  getUser,
  uploadAttendance,
  getDailyRecords,
  getEmployeeReport,
  getAttendanceStats,
  reprocessAttendance,
  getAvailableMonths,
};
