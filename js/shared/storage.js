export function loadFromStorage(key, fallbackValue) {
  try {
    const rawValue = localStorage.getItem(key);
    if (rawValue === null) return fallbackValue;
    return JSON.parse(rawValue);
  } catch (error) {
    console.warn(`No se pudo leer la clave ${key}:`, error);
    return fallbackValue;
  }
}

export function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`No se pudo guardar la clave ${key}:`, error);
  }
}

export function updateStorage(key, fallbackValue, updater) {
  const current = loadFromStorage(key, fallbackValue);
  const next = updater(current);
  saveToStorage(key, next);
  return next;
}

export function removeFromStorage(key) {
  localStorage.removeItem(key);
}
