// ================================
// Excel Export Module
// ================================

import { STATE } from "./config.js";
import { showNotification } from "./ui.js";

/**
 * تحميل تقرير Excel شامل
 */
function downloadExcel() {
  if (STATE.filteredData.length === 0) {
    showNotification("⚠️ لا توجد بيانات لتحميلها", "warning");
    return;
  }

  try {
    const exportData = STATE.filteredData.map((record) => ({
      "رقم الموظف": record.id,
      "اسم الموظف": record.name,
      التاريخ: record.date,
      "أول حضور": record.firstRecord || "-",
      "آخر انصراف": record.lastRecord || "-",
      "ساعات العمل": record.workHours,
      "دقائق التأخير": record.lateMinutes > 0 ? record.lateMinutes : "-",
      الحالة:
        record.statusText ||
        (record.status === "present"
          ? "حاضر"
          : record.status === "absent"
          ? "غائب"
          : "متأخر"),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير الحضور");

    const fileName = `تقرير_الحضور_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    XLSX.writeFile(wb, fileName);

    showNotification("✅ تم تحميل الملف بنجاح", "success");
  } catch (error) {
    console.error("❌ Excel export error:", error);
    showNotification("❌ خطأ في تحميل الملف", "error");
  }
}

/**
 * تحميل ملف Excel لكل موظف (كل الموظفين في ملف واحد، كل موظف في Sheet)
 */
function downloadEmployeeExcel() {
  if (STATE.filteredData.length === 0) {
    showNotification("⚠️ لا توجد بيانات لتحميلها", "warning");
    return;
  }

  try {
    // تجميع البيانات حسب الموظف
    const employees = {};
    for (const record of STATE.filteredData) {
      if (!employees[record.id]) {
        employees[record.id] = {
          name: record.name,
          records: [],
        };
      }
      employees[record.id].records.push(record);
    }

    const wb = XLSX.utils.book_new();

    // إنشاء Sheet لكل موظف
    for (const id in employees) {
      const employee = employees[id];
      const exportData = employee.records.map((record) => ({
        التاريخ: record.date,
        "أول حضور": record.firstRecord || "-",
        "آخر انصراف": record.lastRecord || "-",
        "ساعات العمل": record.workHours,
        "دقائق التأخير": record.lateMinutes > 0 ? record.lateMinutes : "-",
        الحالة:
          record.statusText ||
          (record.status === "present"
            ? "حاضر"
            : record.status === "absent"
            ? "غائب"
            : "متأخر"),
      }));

      // اسم الـ Sheet (حد أقصى 31 حرف)
      let sheetName = `${employee.name}_${id}`
        .replace(/[\\/*[\]:?]/g, "")
        .substring(0, 31);

      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const fileName = `تقارير_الموظفين_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    XLSX.writeFile(wb, fileName);

    showNotification(
      `✅ تم تحميل تقارير ${Object.keys(employees).length} موظف`,
      "success"
    );
  } catch (error) {
    console.error("❌ Excel export error:", error);
    showNotification("❌ خطأ في تحميل الملف", "error");
  }
}

/**
 * تحميل ملفات Excel منفصلة لكل موظف
 */
function downloadIndividualExcels() {
  if (STATE.filteredData.length === 0) {
    showNotification("⚠️ لا توجد بيانات لتحميلها", "warning");
    return;
  }

  try {
    // تجميع البيانات حسب الموظف
    const employees = {};
    for (const record of STATE.filteredData) {
      if (!employees[record.id]) {
        employees[record.id] = {
          name: record.name,
          records: [],
        };
      }
      employees[record.id].records.push(record);
    }

    let count = 0;

    // إنشاء ملف منفصل لكل موظف
    for (const id in employees) {
      const employee = employees[id];
      const exportData = employee.records.map((record) => ({
        التاريخ: record.date,
        "أول حضور": record.firstRecord || "-",
        "آخر انصراف": record.lastRecord || "-",
        "ساعات العمل": record.workHours,
        "دقائق التأخير": record.lateMinutes > 0 ? record.lateMinutes : "-",
        الحالة:
          record.statusText ||
          (record.status === "present"
            ? "حاضر"
            : record.status === "absent"
            ? "غائب"
            : "متأخر"),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "الحضور");

      const fileName = `${employee.name}_${id}.xlsx`.replace(
        /[\\/*[\]:?]/g,
        "_"
      );
      XLSX.writeFile(wb, fileName);
      count++;
    }

    showNotification(`✅ تم تحميل ${count} ملف Excel منفصل`, "success");
  } catch (error) {
    console.error("❌ Excel export error:", error);
    showNotification("❌ خطأ في تحميل الملفات", "error");
  }
}

export { downloadExcel, downloadEmployeeExcel, downloadIndividualExcels };
