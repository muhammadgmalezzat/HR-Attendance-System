let usersData = {};
let attendanceData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 20;

// معالجة ملف الموظفين (Excel)
document
  .getElementById("excelUsersFile")
  .addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const usersInfo = document.getElementById("usersInfo");
    usersInfo.style.display = "block";
    usersInfo.className = "file-info";
    usersInfo.textContent = "⏳ جاري قراءة ملف الموظفين...";

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
        });

        usersData = parseExcelData(jsonData);

        usersInfo.className = "file-info success";
        usersInfo.textContent = `✅ تم تحميل ${
          Object.keys(usersData).length
        } موظف`;
        updateQuickStats();
      } catch (error) {
        usersInfo.className = "file-info error";
        usersInfo.textContent = `❌ خطأ: ${error.message}`;
      }
    };
    reader.readAsArrayBuffer(file);
  });

function parseExcelData(data) {
  const users = {};
  if (data.length === 0) return users;

  const headers = data[0];
  const userIdCol = findColumnIndex(headers, ["user_id", "id", "رقم"]);
  const nameCol = findColumnIndex(headers, ["name", "الاسم", "اسم"]);
  const jobCol = findColumnIndex(headers, ["job", "الوظيفة", "وظيفة"]);
  const genderCol = findColumnIndex(headers, ["gender", "الجنس", "جنس"]);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const userId = row[userIdCol]?.toString().trim();
    const name = row[nameCol]?.toString().trim();

    if (userId && name) {
      users[userId] = {
        id: userId,
        name: name,
        job: row[jobCol]?.toString().trim() || "",
        gender: row[genderCol]?.toString().trim() || "",
      };
    }
  }
  return users;
}

function findColumnIndex(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]?.toString().toLowerCase().trim();
    if (possibleNames.some((name) => header.includes(name.toLowerCase()))) {
      return i;
    }
  }
  return 0;
}

// معالجة ملف الحضور (CSV)
document
  .getElementById("attendanceFile")
  .addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const attInfo = document.getElementById("attendanceInfo");
    attInfo.style.display = "block";
    attInfo.className = "file-info";
    attInfo.textContent = "⏳ جاري قراءة ملف الحضور...";

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const content = event.target.result;
        attendanceData = parseAttendanceFile(content);

        attInfo.className = "file-info success";
        attInfo.textContent = `✅ تم تحميل ${attendanceData.length} سجل حضور`;
        updateQuickStats();
      } catch (error) {
        attInfo.className = "file-info error";
        attInfo.textContent = `❌ خطأ: ${error.message}`;
      }
    };
    reader.readAsText(file, "UTF-8");
  });

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

function generateReport() {
  if (Object.keys(usersData).length === 0 || attendanceData.length === 0) {
    alert("⚠️ يرجى تحميل ملف الموظفين وملف الحضور أولاً");
    return;
  }

  filteredData = processAttendanceData();
  currentPage = 1;
  displayData();

  document.getElementById("downloadExcel").disabled = false;
  document.getElementById("downloadEmployeeExcel").disabled = false;
  document.getElementById("downloadIndividual").disabled = false;

  updateQuickStats();
}

function processAttendanceData() {
  const report = [];
  const shiftStart = document.getElementById("shiftStart").value;
  const expectedHours = parseFloat(document.getElementById("workHours").value);

  const dailyRecords = {};

  for (const record of attendanceData) {
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

  for (const key in dailyRecords) {
    const [id, date] = key.split("|");
    const records = dailyRecords[key].records.sort();

    const firstRecord = records[0];
    const lastRecord = records[records.length - 1];

    const startTime = new Date(`2000-01-01 ${firstRecord}`);
    const endTime = new Date(`2000-01-01 ${lastRecord}`);
    const workHours = (endTime - startTime) / (1000 * 60 * 60);

    const shiftStartTime = new Date(`2000-01-01 ${shiftStart}`);
    const lateMinutes =
      startTime > shiftStartTime
        ? Math.round((startTime - shiftStartTime) / (1000 * 60))
        : 0;

    let status = "present";
    if (workHours < expectedHours * 0.5) {
      status = "absent";
    } else if (lateMinutes > 30) {
      status = "late";
    }

    report.push({
      id: id,
      name: usersData[id]?.name || "غير معروف",
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

function displayData() {
  const tbody = document.getElementById("tableBody");

  if (filteredData.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align: center; padding: 40px;">لا توجد بيانات لعرضها</td></tr>';
    return;
  }

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
  const pageData = filteredData.slice(startIndex, endIndex);

  let html = "";
  for (const record of pageData) {
    const statusClass = record.status;
    const statusText =
      record.status === "present"
        ? "حاضر"
        : record.status === "absent"
        ? "غائب"
        : "متأخر";

    html += `
                    <tr>
                        <td>${record.id}</td>
                        <td><strong>${record.name}</strong></td>
                        <td>${record.date}</td>
                        <td>${record.firstRecord || "-"}</td>
                        <td>${record.lastRecord || "-"}</td>
                        <td>${record.workHours}</td>
                        <td>${
                          record.lateMinutes > 0 ? record.lateMinutes : "-"
                        }</td>
                        <td><span class="${statusClass}">${statusText}</span></td>
                    </tr>
                `;
  }
  tbody.innerHTML = html;
  createPagination(totalPages);
}

function createPagination(totalPages) {
  const pagination = document.getElementById("pagination");
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = "";
  if (currentPage > 1) {
    html += `<button class="page-btn" onclick="changePage(${
      currentPage - 1
    })">السابق</button>`;
  }

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${
      i === currentPage ? "active" : ""
    }" onclick="changePage(${i})">${i}</button>`;
  }

  if (currentPage < totalPages) {
    html += `<button class="page-btn" onclick="changePage(${
      currentPage + 1
    })">التالي</button>`;
  }

  pagination.innerHTML = html;
}

function changePage(page) {
  currentPage = page;
  displayData();
}

function applyFilters() {
  if (!filteredData || filteredData.length === 0) return;

  const originalData = processAttendanceData();
  let result = [...originalData];

  const selectedStatus = document.getElementById("statusFilter").value;
  if (selectedStatus !== "all") {
    result = result.filter((record) => record.status === selectedStatus);
  }

  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  if (searchTerm) {
    result = result.filter(
      (record) =>
        record.name.toLowerCase().includes(searchTerm) ||
        record.id.includes(searchTerm)
    );
  }

  filteredData = result;
  currentPage = 1;
  displayData();
}

document.getElementById("searchInput").addEventListener("input", applyFilters);

function updateQuickStats() {
  document.getElementById("totalEmployees").textContent =
    Object.keys(usersData).length;

  if (filteredData.length > 0) {
    const presentCount = filteredData.filter(
      (r) => r.status === "present"
    ).length;
    const attendanceRate = Math.round(
      (presentCount / filteredData.length) * 100
    );
    document.getElementById("avgAttendance").textContent = `${attendanceRate}%`;
  } else {
    document.getElementById("avgAttendance").textContent = "0%";
  }
}

function downloadExcel() {
  if (filteredData.length === 0) {
    alert("لا توجد بيانات لتحميلها");
    return;
  }

  const exportData = filteredData.map((record) => ({
    "رقم الموظف": record.id,
    "اسم الموظف": record.name,
    التاريخ: record.date,
    "أول حضور": record.firstRecord || "-",
    "آخر انصراف": record.lastRecord || "-",
    "ساعات العمل": record.workHours,
    "دقائق التأخير": record.lateMinutes > 0 ? record.lateMinutes : "-",
    الحالة:
      record.status === "present"
        ? "حاضر"
        : record.status === "absent"
        ? "غائب"
        : "متأخر",
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "تقرير الحضور");
  XLSX.writeFile(wb, "تقرير_الحضور_الشامل.xlsx");
}

function downloadEmployeeExcel() {
  if (filteredData.length === 0) {
    alert("لا توجد بيانات لتحميلها");
    return;
  }

  const employees = {};
  for (const record of filteredData) {
    if (!employees[record.id]) {
      employees[record.id] = {
        name: record.name,
        records: [],
      };
    }
    employees[record.id].records.push(record);
  }

  const wb = XLSX.utils.book_new();

  for (const id in employees) {
    const employee = employees[id];
    const exportData = employee.records.map((record) => ({
      التاريخ: record.date,
      "أول حضور": record.firstRecord || "-",
      "آخر انصراف": record.lastRecord || "-",
      "ساعات العمل": record.workHours,
      "دقائق التأخير": record.lateMinutes > 0 ? record.lateMinutes : "-",
      الحالة:
        record.status === "present"
          ? "حاضر"
          : record.status === "absent"
          ? "غائب"
          : "متأخر",
    }));

    let sheetName = `${employee.name}_${id}`
      .replace(/[\\/*[\]:?]/g, "")
      .substring(0, 31);
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, "تقارير_الموظفين.xlsx");
}

function downloadIndividualExcels() {
  if (filteredData.length === 0) {
    alert("لا توجد بيانات لتحميلها");
    return;
  }

  const employees = {};
  for (const record of filteredData) {
    if (!employees[record.id]) {
      employees[record.id] = {
        name: record.name,
        records: [],
      };
    }
    employees[record.id].records.push(record);
  }

  let count = 0;
  for (const id in employees) {
    const employee = employees[id];
    const exportData = employee.records.map((record) => ({
      التاريخ: record.date,
      "أول حضور": record.firstRecord || "-",
      "آخر انصراف": record.lastRecord || "-",
      "ساعات العمل": record.workHours,
      "دقائق التأخير": record.lateMinutes > 0 ? record.lateMinutes : "-",
      الحالة:
        record.status === "present"
          ? "حاضر"
          : record.status === "absent"
          ? "غائب"
          : "متأخر",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الحضور");

    const fileName = `${employee.name}_${id}.xlsx`.replace(/[\\/*[\]:?]/g, "_");
    XLSX.writeFile(wb, fileName);
    count++;
  }

  alert(`✅ تم تحميل ${count} ملف Excel منفصل لكل موظف`);
}

function resetData() {
  if (!confirm("هل أنت متأكد من إعادة تعيين جميع البيانات؟")) {
    return;
  }

  usersData = {};
  attendanceData = [];
  filteredData = [];
  currentPage = 1;

  document.getElementById("excelUsersFile").value = "";
  document.getElementById("attendanceFile").value = "";
  document.getElementById("usersInfo").style.display = "none";
  document.getElementById("attendanceInfo").style.display = "none";
  document.getElementById("tableBody").innerHTML =
    '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">قم برفع ملفات الموظفين والحضور أولاً</td></tr>';
  document.getElementById("pagination").innerHTML = "";

  document.getElementById("downloadExcel").disabled = true;
  document.getElementById("downloadEmployeeExcel").disabled = true;
  document.getElementById("downloadIndividual").disabled = true;

  updateQuickStats();
}
