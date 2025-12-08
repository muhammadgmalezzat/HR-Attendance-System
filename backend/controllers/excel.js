import XLSX from "xlsx";
import User from "../models/User.js";

export const uploadUsersExcel = async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    for (let row of data) {
      await User.findOneAndUpdate({ id: row.id }, row, {
        upsert: true,
        new: true,
      });
    }
    res.json({ message: "Users uploaded successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
