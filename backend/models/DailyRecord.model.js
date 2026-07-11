import mongoose from "mongoose";

const dailyRecordSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    name: { type: String, default: "-" },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    firstCheckIn: {
      type: Date,
      default: null,
    },
    lastCheckOut: {
      type: Date,
      default: null,
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    lateMinutes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "DayOff"],
      default: "Absent",
    },
    // Applied shift for this day
    appliedShift: {
      from: String,
      to: String,
      nextDay: Boolean,
    },
    // All check-ins for the day
    checkIns: [
      {
        timestamp: { type: Date, required: true },
        type: { type: String, default: "unknown" },
      },
    ],
    // Metadata
    autoCheckOut: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
dailyRecordSchema.index({ user_id: 1, date: 1 }, { unique: true });
dailyRecordSchema.index({ date: 1, status: 1 });
dailyRecordSchema.index({ user_id: 1, date: -1 });

// Virtual for user reference
dailyRecordSchema.virtual("user", {
  ref: "User",
  localField: "user_id",
  foreignField: "user_id",
  justOne: true,
});

dailyRecordSchema.set("toJSON", { virtuals: true });
dailyRecordSchema.set("toObject", { virtuals: true });

export default mongoose.model("DailyRecord", dailyRecordSchema);
