// ================================
// Users Management Module
// ================================

import { STATE, CONFIG } from "./config.js";
import { showNotification, showLoading } from "./ui.js";

/**
 * Load users list with pagination
 */
async function loadUsersList(page = 1, filters = {}) {
  if (!STATE.isBackendConnected || !STATE.authToken) {
    showNotification("⚠️ غير متصل بالخادم", "warning");
    return;
  }

  try {
    showLoading("usersTableBody", true);

    const params = new URLSearchParams({
      page,
      limit: 20,
      includeStats: "true",
      ...filters,
    });

    const response = await fetch(`${CONFIG.API_URL}/users?${params}`, {
      headers: {
        Authorization: `Bearer ${STATE.authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      displayUsersTable(result.data.users);
      createUsersPagination(result.data.pagination);

      console.log(`✅ Loaded ${result.data.users.length} users`);
    }
  } catch (error) {
    console.error("❌ Error loading users:", error);
    showNotification(`فشل جلب البيانات: ${error.message}`, "error");

    document.getElementById("usersTableBody").innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #999;">
          حدث خطأ في تحميل البيانات
        </td>
      </tr>
    `;
  }
}

/**
 * Display users in table
 */
function displayUsersTable(users) {
  const tbody = document.getElementById("usersTableBody");

  if (!tbody) {
    console.error("❌ usersTableBody not found");
    return;
  }

  if (!users || users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #999;">
          لا يوجد موظفين
        </td>
      </tr>
    `;
    return;
  }

  let html = "";
  users.forEach((user) => {
    const stats = user.stats || {};
    const attendanceRate = stats.attendanceRate || 0;
    const rateColor =
      attendanceRate >= 90
        ? "#28a745"
        : attendanceRate >= 75
        ? "#ffc107"
        : "#dc3545";

    html += `
      <tr class="user-row" data-user-id="${user.user_id}">
        <td><strong>${user.user_id}</strong></td>
        <td>
          <strong>${user.name}</strong>
          ${
            user.isActive === false
              ? '<span class="badge inactive">غير نشط</span>'
              : ""
          }
        </td>
        <td>${user.job || "-"}</td>
        <td>${user.gender === "female" ? "أنثى" : "ذكر"}</td>
        <td style="color: ${rateColor}; font-weight: bold;">${attendanceRate}%</td>
        <td>
          <span class="badge present">${stats.totalPresent || 0}</span>
          <span class="badge late">${stats.totalLate || 0}</span>
          <span class="badge absent">${stats.totalAbsent || 0}</span>
        </td>
        <td>
          <button class="btn-action btn-view" onclick="window.viewUserDetails('${
            user.user_id
          }')">
            👁️ عرض
          </button>
          <button class="btn-action btn-edit" onclick="window.openEditModal('${
            user.user_id
          }')">
            ✏️ تعديل
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/**
 * Create pagination
 */
function createUsersPagination(pagination) {
  const paginationEl = document.getElementById("usersPagination");

  if (!paginationEl || pagination.pages <= 1) {
    if (paginationEl) paginationEl.innerHTML = "";
    return;
  }

  let html = "";
  const { page, pages } = pagination;

  // Previous button
  if (page > 1) {
    html += `<button class="page-btn" onclick="window.loadUsersPage(${
      page - 1
    })">السابق</button>`;
  }

  // Page numbers
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(pages, startPage + 4);

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === page ? "active" : ""}" 
              onclick="window.loadUsersPage(${i})">${i}</button>`;
  }

  // Next button
  if (page < pages) {
    html += `<button class="page-btn" onclick="window.loadUsersPage(${
      page + 1
    })">التالي</button>`;
  }

  paginationEl.innerHTML = html;
}

/**
 * Load user details
 */
async function loadUserDetails(userId) {
  if (!STATE.isBackendConnected || !STATE.authToken) {
    showNotification("⚠️ غير متصل بالخادم", "warning");
    return null;
  }

  try {
    const response = await fetch(`${CONFIG.API_URL}/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${STATE.authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      return result.data;
    }

    throw new Error(result.message || "Failed to load user");
  } catch (error) {
    console.error("❌ Error loading user details:", error);
    showNotification(`فشل جلب بيانات الموظف: ${error.message}`, "error");
    return null;
  }
}

/**
 * Update user
 */
async function updateUser(userId, data) {
  if (!STATE.isBackendConnected || !STATE.authToken) {
    showNotification("⚠️ غير متصل بالخادم", "warning");
    return false;
  }

  try {
    const response = await fetch(`${CONFIG.API_URL}/users/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${STATE.authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (result.success) {
      showNotification("✅ تم تحديث البيانات بنجاح", "success");
      return true;
    }

    throw new Error(result.message || "Failed to update user");
  } catch (error) {
    console.error("❌ Error updating user:", error);
    showNotification(`فشل التحديث: ${error.message}`, "error");
    return false;
  }
}

/**
 * Search users
 */
function searchUsers() {
  const searchInput = document.getElementById("usersSearchInput");
  const jobFilter = document.getElementById("usersJobFilter");
  const genderFilter = document.getElementById("usersGenderFilter");

  const filters = {};

  if (searchInput && searchInput.value.trim()) {
    filters.search = searchInput.value.trim();
  }

  if (jobFilter && jobFilter.value !== "all") {
    filters.job = jobFilter.value;
  }

  if (genderFilter && genderFilter.value !== "all") {
    filters.gender = genderFilter.value;
  }

  loadUsersList(1, filters);
}

// Make functions globally available
if (typeof window !== "undefined") {
  window.loadUsersPage = (page) => loadUsersList(page);
  window.searchUsers = searchUsers;
}

export {
  loadUsersList,
  displayUsersTable,
  loadUserDetails,
  updateUser,
  searchUsers,
};
