import mongoose from "mongoose";

const rawAttendanceSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD format
      required: true,
      index: true,
    },
    time: {
      type: String, // HH:mm:ss format
      required: true,
    },
    type: {
      type: String,
      enum: ["in", "out", "unknown"],
      default: "unknown",
    },
    uploadBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UploadHistory",
      index: true,
    },
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
rawAttendanceSchema.index({ user_id: 1, date: 1, timestamp: 1 });
rawAttendanceSchema.index({ uploadBatchId: 1, processed: 1 });

export default mongoose.model("RawAttendance", rawAttendanceSchema);
