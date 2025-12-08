import mongoose from "mongoose";

const uploadHistorySchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["users", "attendance"],
      required: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    recordsCount: {
      type: Number,
      default: 0,
    },
    usersCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    processedRecords: {
      type: Number,
      default: 0,
    },
    failedRecords: {
      type: Number,
      default: 0,
    },
    errors: [
      {
        message: String,
        record: mongoose.Schema.Types.Mixed,
        timestamp: Date,
      },
    ],
    uploadedBy: {
      type: String,
      default: "admin",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

uploadHistorySchema.index({ uploadDate: -1 });
uploadHistorySchema.index({ fileType: 1, status: 1 });

export default mongoose.model("UploadHistory", uploadHistorySchema);
