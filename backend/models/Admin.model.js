import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, default: "Admin" },
    role: {
      type: String,
      enum: ["super_admin", "admin", "viewer"],
      default: "admin",
    },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
// adminSchema.pre("save", async function () {
//   if (!this.isModified("password")) return;

//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
// });

// Method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
  //return await bcrypt.compare(candidatePassword, this.password);
  return candidatePassword === this.password;
};

// Don't return password in JSON
adminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model("Admin", adminSchema);
