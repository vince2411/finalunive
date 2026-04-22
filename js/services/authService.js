import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig.js";
import { loadFromStorage, saveToStorage, removeFromStorage } from "../shared/storage.js";

export function loginAdmin(password) {
  if (password === APP_CONFIG.adminPassword) {
    saveToStorage(STORAGE_KEYS.authSession, {
      authenticated: true,
      loginAt: Date.now()
    });
    return { success: true };
  }

  return {
    success: false,
    message: "Credenciales invalidas"
  };
}

export function logoutAdmin() {
  removeFromStorage(STORAGE_KEYS.authSession);
}

export function isAdminAuthenticated() {
  const session = loadFromStorage(STORAGE_KEYS.authSession, null);
  return Boolean(session && session.authenticated);
}
