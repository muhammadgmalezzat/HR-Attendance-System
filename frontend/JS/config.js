// ================================
// Configuration
// ================================

const CONFIG = {
  API_URL: "http://localhost:5000/api",
  ITEMS_PER_PAGE: 20,
  DEFAULT_SHIFT_START: "08:00",
  DEFAULT_WORK_HOURS: 8,
  ADMIN_CREDENTIALS: {
    email: "admin@company.com",
    password: "admin123456",
  },
};

// Global State
const STATE = {
  usersData: {},
  attendanceData: [],
  originalData: [],
  filteredData: [],
  currentPage: 1,
  availableMonths: [], 
  selectedMonth: "all", 
  authToken: localStorage.getItem("token"),
  isBackendConnected: false,
};

export { CONFIG, STATE };
