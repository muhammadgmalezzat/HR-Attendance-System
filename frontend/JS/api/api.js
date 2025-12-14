// api.js
const API_URL = "http://localhost:5000/api";
let authToken = localStorage.getItem("token");

export async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (data.success) {
    authToken = data.data.token;
    localStorage.setItem("token", authToken);
  }
  return data;
}

export async function fetchAttendance(userId) {
  const res = await fetch(`${API_URL}/attendance/employee/${userId}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });
  return res.ok ? await res.json() : null;
}

export async function uploadUsers(usersArray, fileName) {
  const res = await fetch(`${API_URL}/users/bulk-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ fileName, users: usersArray }),
  });
  return await res.json();
}

export async function uploadAttendance(attendanceArray, fileName) {
  const res = await fetch(`${API_URL}/attendance/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ fileName, attendance: attendanceArray }),
  });
  return await res.json();
}
