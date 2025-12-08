const dailyReportSchema = new mongoose.Schema({
  userId: String,
  name: String,
  date: String,
  firstRecord: String,
  lastRecord: String,
  workHours: Number,
  lateMinutes: Number,
  status: String, // present | absent | late
});

export default mongoose.model("DailyReport", dailyReportSchema);
