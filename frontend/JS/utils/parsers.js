// parse excel data for users file to get users object
export function parseExcelData(data) {
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

  const from = findColumnIndex(headers, ["from", "من"]);
  const to = findColumnIndex(headers, ["to", "إلى"]);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const userId = row[userIdCol]?.toString().trim();
    const namecol = row[nameCol]?.toString().trim();
    const fromTime = row[from]?.toString().trim();
    const toTime = row[to]?.toString().trim();

    if (userId && namecol) {
      users[userId] = {
        id: userId,
        name: namecol,
        job: row[jobCol]?.toString().trim() || "",
        gender: row[genderCol]?.toString().trim() || "",
        from: fromTime || "08:00",
        to: toTime || "16:00",
      };
    }
  }
  //console.log("🚀 ~ parseExcelData ~ users:", users);

  return users;
}

export function parseUsersFile(content) { ... }

export function parseAttendanceFile(content) {
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

export function findColumnIndex(headers, names) { ... }
