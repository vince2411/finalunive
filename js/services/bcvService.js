import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig.js";
import { ENDPOINTS } from "../config/endpoints.js";
import { loadFromStorage, saveToStorage } from "../shared/storage.js";

function parseNumericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseRateEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const rateCandidates = [entry.promedio, entry.venta, entry.compra, entry.rate, entry.usd];
  const rate = rateCandidates.map(parseNumericValue).find((value) => value !== null);
  if (rate === undefined || rate === null) return null;

  return {
    rate,
    providerUpdatedAt: entry.fechaActualizacion || entry.updatedAt || null,
    providerSource: entry.fuente || entry.source || "oficial"
  };
}

function parseRateFromPayload(payload) {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    const officialEntry = payload.find(
      (entry) =>
        String(entry?.fuente || "") === "oficial" ||
        String(entry?.source || "") === "oficial" ||
        String(entry?.nombre || "").toLowerCase().includes("dolar")
    );

    return parseRateEntry(officialEntry || payload[0]);
  }

  if (payload.data) {
    const fromData = parseRateFromPayload(payload.data);
    if (fromData) return fromData;
  }

  return parseRateEntry(payload);
}

async function fetchRateWithTimeout(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const parsed = parseRateFromPayload(payload);
    if (!parsed) {
      throw new Error("Formato de tasa no reconocido");
    }

    return parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getStoredRate() {
  const savedRate = loadFromStorage(STORAGE_KEYS.bcvRate, APP_CONFIG.defaultBCVRate);
  return Number(savedRate) || APP_CONFIG.defaultBCVRate;
}

export function getRateMeta() {
  return loadFromStorage(STORAGE_KEYS.bcvRateMeta, {
    source: "demo",
    status: "ok",
    updatedAt: Date.now(),
    message: "Tasa simulada"
  });
}

export async function refreshBCVRate() {
  try {
    const data = await fetchRateWithTimeout(ENDPOINTS.bcv.primary);
    saveToStorage(STORAGE_KEYS.bcvRate, data.rate);
    saveToStorage(STORAGE_KEYS.bcvRateMeta, {
      source: `dolarapi-${data.providerSource}`,
      status: "ok",
      updatedAt: Date.now(),
      providerUpdatedAt: data.providerUpdatedAt,
      message: "Tasa oficial actualizada desde ve.dolarapi.com"
    });
    return {
      rate: data.rate,
      source: `dolarapi-${data.providerSource}`,
      status: "ok",
      providerUpdatedAt: data.providerUpdatedAt,
      message: "Tasa oficial actualizada desde ve.dolarapi.com"
    };
  } catch (primaryError) {
    try {
      const data = await fetchRateWithTimeout(ENDPOINTS.bcv.backup);
      saveToStorage(STORAGE_KEYS.bcvRate, data.rate);
      saveToStorage(STORAGE_KEYS.bcvRateMeta, {
        source: `dolarapi-${data.providerSource}`,
        status: "ok",
        updatedAt: Date.now(),
        providerUpdatedAt: data.providerUpdatedAt,
        message: "Tasa oficial actualizada desde endpoint de respaldo"
      });
      return {
        rate: data.rate,
        source: `dolarapi-${data.providerSource}`,
        status: "ok",
        providerUpdatedAt: data.providerUpdatedAt,
        message: "Tasa oficial actualizada desde endpoint de respaldo"
      };
    } catch (backupError) {
      const fallbackRate = getStoredRate();
      saveToStorage(STORAGE_KEYS.bcvRateMeta, {
        source: "demo",
        status: "fallback",
        updatedAt: Date.now(),
        providerUpdatedAt: null,
        message: "No se pudo conectar con BCV. Se mantiene tasa demo/local."
      });

      return {
        rate: fallbackRate,
        source: "demo",
        status: "fallback",
        message: "No se pudo conectar con BCV. Se mantiene tasa demo/local.",
        error: backupError?.message || primaryError?.message
      };
    }
  }
}
