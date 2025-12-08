import User from "../models/User.model.js";

// @desc    Get user shift configuration
// @route   GET /api/shifts/:userId
// @access  Private
export const getUserShift = async (req, res) => {
  try {
    const user = await User.findOne({ user_id: req.params.userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        user_id: user.user_id,
        name: user.name,
        defaultShift: {
          from: user.from,
          to: user.to,
        },
        shiftSchedule: user.shiftSchedule,
        gracePeriodMinutes: user.gracePeriodMinutes,
        absentThreshold: user.absentThreshold,
      },
    });
  } catch (error) {
    console.error("Get user shift error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user shift",
      error: error.message,
    });
  }
};

// @desc    Update user shift configuration
// @route   PUT /api/shifts/:userId
// @access  Private
export const updateUserShift = async (req, res) => {
  try {
    const { from, to, shiftSchedule, gracePeriodMinutes, absentThreshold } =
      req.body;

    const updateData = {};

    // Update default shift
    if (from) updateData.from = from;
    if (to) updateData.to = to;

    // Update weekly schedule
    if (shiftSchedule !== undefined) {
      updateData.shiftSchedule = shiftSchedule;
    }

    // Update configuration
    if (gracePeriodMinutes !== undefined) {
      updateData.gracePeriodMinutes = gracePeriodMinutes;
    }
    if (absentThreshold !== undefined) {
      updateData.absentThreshold = absentThreshold;
    }

    const user = await User.findOneAndUpdate(
      { user_id: req.params.userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Shift configuration updated successfully",
      data: {
        user_id: user.user_id,
        name: user.name,
        defaultShift: {
          from: user.from,
          to: user.to,
        },
        shiftSchedule: user.shiftSchedule,
        gracePeriodMinutes: user.gracePeriodMinutes,
        absentThreshold: user.absentThreshold,
      },
    });
  } catch (error) {
    console.error("Update user shift error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user shift",
      error: error.message,
    });
  }
};

// @desc    Get shift for specific date
// @route   GET /api/shifts/:userId/date/:date
// @access  Private
export const getShiftForDate = async (req, res) => {
  try {
    const { userId, date } = req.params;

    const user = await User.findOne({ user_id: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const dateObj = new Date(date);
    const shift = user.getShiftForDate(dateObj);

    if (!shift) {
      return res.json({
        success: true,
        data: {
          date,
          isDayOff: true,
          shift: null,
        },
      });
    }

    res.json({
      success: true,
      data: {
        date,
        isDayOff: false,
        shift,
        dayOfWeek: [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ][dateObj.getDay()],
      },
    });
  } catch (error) {
    console.error("Get shift for date error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching shift for date",
      error: error.message,
    });
  }
};
