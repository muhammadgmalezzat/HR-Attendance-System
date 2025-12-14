// ================================
// Authentication Module
// ================================

import { CONFIG, STATE } from "./config.js";
import { showNotification } from "./ui.js";

/**
 * تسجيل الدخول للـ Backend
 */
async function loginToBackend() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CONFIG.ADMIN_CREDENTIALS),
    });

    const data = await response.json();

    if (data.success) {
      STATE.authToken = data.data.token;
      localStorage.setItem("token", STATE.authToken);
      STATE.isBackendConnected = true;

      showNotification("✅ تم الاتصال بالخادم بنجاح", "success");
      console.log("✅ Login successful");
      return true;
    } else if (response.status === 401) {
      // محاولة إنشاء Admin
      return await initializeAdmin();
    }

    throw new Error(data.message || "فشل تسجيل الدخول");
  } catch (error) {
    console.error("❌ Login error:", error);
    STATE.isBackendConnected = false;
    showNotification("⚠️ سيتم العمل بدون خادم (Offline Mode)", "warning");
    return false;
  }
}

/**
 * إنشاء Admin جديد
 */
async function initializeAdmin() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/auth/init`, {
      method: "POST",
    });

    const data = await response.json();

    if (data.success) {
      STATE.authToken = data.data.token;
      localStorage.setItem("token", STATE.authToken);
      STATE.isBackendConnected = true;

      showNotification("✅ تم إنشاء الحساب والاتصال بالخادم", "success");
      console.log("✅ Admin initialized");
      return true;
    }
  } catch (error) {
    console.error("❌ Init admin error:", error);
  }

  return false;
}

/**
 * التحقق من صلاحية الـ Token
 */
async function verifyToken() {
  if (!STATE.authToken) return false;

  try {
    const response = await fetch(`${CONFIG.API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${STATE.authToken}` },
    });

    if (response.ok) {
      STATE.isBackendConnected = true;
      console.log("✅ Token is valid");
      return true;
    }

    // Token منتهي
    localStorage.removeItem("token");
    STATE.authToken = null;
    return await loginToBackend();
  } catch (error) {
    console.error("❌ Token verification failed:", error);
    return false;
  }
}

/**
 * تهيئة المصادقة عند تحميل الصفحة
 */
async function initAuth() {
  if (STATE.authToken) {
    await verifyToken();
  } else {
    await loginToBackend();
  }
}

export { loginToBackend, initializeAdmin, verifyToken, initAuth };
