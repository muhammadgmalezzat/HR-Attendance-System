export let usersData = {};
export let attendanceData = [];
export let filteredData = [];
export let currentPage = 1;
export const itemsPerPage = 20;
export const API_URL = "http://localhost:5000/api";

export let authToken = localStorage.getItem("token");

export function setAuthToken(token) {
  authToken = token;
  localStorage.setItem("token", token);
}
