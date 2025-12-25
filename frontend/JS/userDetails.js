// ================================
// User Details Module
// ================================

import { showNotification } from "./ui.js";
import { loadUserDetails, updateUser } from "./users.js";

/**
 * View user details (navigate to details page)
 */
function viewUserDetails(userId) {
  // Save to sessionStorage for details page
  sessionStorage.setItem("selectedUserId", userId);

  // Navigate to details page
  window.location.href = `user-details.html?id=${userId}`;
}

/**
 * Display user details on details page
 */
async function displayUserDetailsPage() {
  // Get userId from URL or sessionStorage
  const urlParams = new URLSearchParams(window.location.search);
  const userId =
    urlParams.get("id") || sessionStorage.getItem("selectedUserId");

  if (!userId) {
    showNotification("❌ لم يتم تحديد موظف", "error");
    window.location.href = "users.html";
    return;
  }

  // Load user data
  const userData = await loadUserDetails(userId);

  if (!userData) {
    showNotification("❌ فشل تحميل بيانات الموظف", "error");
    return;
  }

  // Display data
  displayBasicInfo(userData.user);
  displayStats(userData.stats);
  displayRecentAttendance(userData.recentAttendance);
}

/**
 * Display basic user info
 */
function displayBasicInfo(user) {
  document.getElementById("userName").textContent = user.name;
  document.getElementById("userId").textContent = user.user_id;
  document.getElementById("userJob").textContent = user.job || "-";
  document.getElementById("userGender").textContent =
    user.gender === "female" ? "أنثى" : "ذكر";

  // Shift info
  let shiftInfo = "";
  if (user.splitShifts && user.splitShifts.length > 0) {
    shiftInfo = user.splitShifts
      .map((s) => `${s.label || "فترة"}: ${s.from} - ${s.to}`)
      .join("<br>");
  } else if (user.shiftSchedule) {
    shiftInfo = "جدول أسبوعي";
  } else {
    shiftInfo = `${user.from || "08:00"} - ${user.to || "16:00"}`;
  }
  document.getElementById("userShift").innerHTML = shiftInfo;

  // Status badge
  const statusBadge = document.getElementById("userStatus");
  if (user.isActive) {
    statusBadge.className = "badge present";
    statusBadge.textContent = "نشط";
  } else {
    statusBadge.className = "badge absent";
    statusBadge.textContent = "غير نشط";
  }
}

/**
 * Display statistics
 */
function displayStats(stats) {
  document.getElementById("statTotalDays").textContent = stats.totalDays || 0;
  document.getElementById("statPresent").textContent = stats.totalPresent || 0;
  document.getElementById("statLate").textContent = stats.totalLate || 0;
  document.getElementById("statAbsent").textContent = stats.totalAbsent || 0;

  const attendanceRate = stats.attendanceRate || 0;
  const rateEl = document.getElementById("statAttendanceRate");
  rateEl.textContent = `${attendanceRate}%`;
  rateEl.style.color =
    attendanceRate >= 90
      ? "#28a745"
      : attendanceRate >= 75
      ? "#ffc107"
      : "#dc3545";

  document.getElementById("statAvgLate").textContent = `${
    stats.avgLateMinutes || 0
  } دقيقة`;

  document.getElementById("statTotalLate").textContent = `${
    stats.totalLateMinutes || 0
  } دقيقة`;

  document.getElementById("statAvgHours").textContent = `${
    stats.avgWorkHours || 0
  } ساعة`;
}

/**
 * Display recent attendance
 */
function displayRecentAttendance(records) {
  const tbody = document.getElementById("recentAttendanceBody");

  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 20px;">
          لا توجد سجلات حضور حديثة
        </td>
      </tr>
    `;
    return;
  }

  let html = "";
  records.forEach((record) => {
    const statusClass = record.status.toLowerCase();
    const statusText =
      record.status === "Present"
        ? "حاضر"
        : record.status === "Late"
        ? "متأخر"
        : record.status === "Absent"
        ? "غائب"
        : "عطلة";

    const firstCheckIn = record.firstCheckIn
      ? new Date(record.firstCheckIn).toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "-";

    const lastCheckOut = record.lastCheckOut
      ? new Date(record.lastCheckOut).toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "-";

    html += `
      <tr>
        <td>${record.date}</td>
        <td>${firstCheckIn}</td>
        <td>${lastCheckOut}</td>
        <td>${record.totalHours?.toFixed(2) || 0} ساعة</td>
        <td><span class="${statusClass}">${statusText}</span></td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/**
 * Open edit modal
 */
function openEditModal(userId) {
  // Load user data first
  loadUserDetails(userId).then((userData) => {
    if (!userData) return;

    const user = userData.user;

    // Fill form
    document.getElementById("editUserId").value = user.user_id;
    document.getElementById("editName").value = user.name;
    document.getElementById("editJob").value = user.job || "";
    document.getElementById("editGender").value = user.gender || "male";
    document.getElementById("editFrom").value = user.from || "08:00";
    document.getElementById("editTo").value = user.to || "16:00";
    document.getElementById("editIsActive").checked = user.isActive !== false;

    // Show modal
    document.getElementById("editUserModal").style.display = "flex";
  });
}

/**
 * Close edit modal
 */
function closeEditModal() {
  document.getElementById("editUserModal").style.display = "none";
}

/**
 * Save user changes
 */
async function saveUserChanges() {
  const userId = document.getElementById("editUserId").value;

  const data = {
    name: document.getElementById("editName").value.trim(),
    job: document.getElementById("editJob").value.trim(),
    gender: document.getElementById("editGender").value,
    from: document.getElementById("editFrom").value,
    to: document.getElementById("editTo").value,
    isActive: document.getElementById("editIsActive").checked,
  };

  // Validation
  if (!data.name) {
    showNotification("❌ الاسم مطلوب", "error");
    return;
  }

  // Show loading
  const saveBtn = document.getElementById("saveUserBtn");
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = "⏳ جاري الحفظ...";

  // Update
  const success = await updateUser(userId, data);

  // Restore button
  saveBtn.disabled = false;
  saveBtn.textContent = originalText;

  if (success) {
    closeEditModal();

    // Refresh page data
    if (window.location.pathname.includes("user-details.html")) {
      displayUserDetailsPage();
    } else {
      window.location.reload();
    }
  }
}

// Make functions globally available
if (typeof window !== "undefined") {
  window.viewUserDetails = viewUserDetails;
  window.openEditModal = openEditModal;
  window.closeEditModal = closeEditModal;
  window.saveUserChanges = saveUserChanges;
}

export {
  viewUserDetails,
  displayUserDetailsPage,
  openEditModal,
  closeEditModal,
  saveUserChanges,
};
