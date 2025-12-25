import mongoose from "mongoose";

const shiftScheduleSchema = new mongoose.Schema(
  {
    mon: {
      from: String,
      to: String,
      nextDay: { type: Boolean, default: false },
    },
    tue: {
      from: String,
      to: String,
      nextDay: { type: Boolean, default: false },
    },
    wed: {
      from: String,
      to: String,
      nextDay: { type: Boolean, default: false },
    },
    thu: {
      from: String,
      to: String,
      nextDay: { type: Boolean, default: false },
    },
    fri: {
      from: String,
      to: String,
      nextDay: { type: Boolean, default: false },
    },
    sat: {
      from: String,
      to: String,
      nextDay: { type: Boolean, default: false },
    },
    sun: {
      from: String,
      to: String,
      nextDay: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    job: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "male",
    },

    // Default shift
    from: {
      type: String,
      default: "08:00",
    },
    to: {
      type: String,
      default: "16:00",
    },

    // Weekly shift schedule
    shiftSchedule: {
      type: shiftScheduleSchema,
      default: null,
    },

    gracePeriodMinutes: {
      type: Number,
      default: null,
    },
    absentThreshold: {
      type: Number,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// KEEP ONLY THESE INDEXES (NO DUPLICATE)
userSchema.index({ name: "text" });
userSchema.index({ job: 1 });
userSchema.index({ isActive: 1 });

userSchema.methods.getShiftForDate = function (date) {
  if (this.shiftSchedule) {
    const dayOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
      date.getDay()
    ];
    const dayShift = this.shiftSchedule[dayOfWeek];

    if (dayShift && dayShift.from && dayShift.to) {
      // ✅ تأكد من إرجاع nextDay بشكل صحيح
      return {
        from: dayShift.from,
        to: dayShift.to,
        nextDay: dayShift.nextDay || dayShift.to < dayShift.from,
      };
    }

    // Day off
    if (!dayShift || !dayShift.from || !dayShift.to) {
      return null;
    }
  }

  return {
    from: this.from,
    to: this.to,
    nextDay: this.to < this.from,
  };
};

export default mongoose.model("User", userSchema);
