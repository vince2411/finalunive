/**
 * BCV Rate Service — Universitarios FC v2.0
 * Fetches USD/VES exchange rate with fallback to manual rate
 */
import { getDocument, setDocument } from './firebase.service.js';

const BCV_API_URLS = [
  'https://pydolarve.org/api/v1/dollar?page=bcv',
  'https://ve.dolarapi.com/v1/dolares/oficial'
];

const CACHE_KEY = 'ufc_bcv_rate';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

let currentRate = null;
let rateSource = 'default';
let lastUpdate = null;
let listeners = [];

/**
 * Initialize BCV rate (load cached or fetch fresh)
 */
export async function initBCVRate() {
  // Try loading from cache first
  const cached = loadCachedRate();
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    currentRate = cached.rate;
    rateSource = cached.source;
    lastUpdate = cached.timestamp;
    notifyListeners();
    return currentRate;
  }
  
  // Fetch fresh rate
  return await refreshRate();
}

/**
 * Fetch fresh exchange rate from APIs
 */
export async function refreshRate() {
  for (const url of BCV_API_URLS) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(8000)
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const rate = parseRateFromResponse(data, url);
      
      if (rate && rate > 0) {
        currentRate = rate;
        rateSource = 'api';
        lastUpdate = Date.now();
        cacheRate(rate, 'api');
        saveRateToFirestore(rate, 'api');
        notifyListeners();
        console.log(`[BCV] Rate fetched: ${rate} Bs/USD from ${url}`);
        return rate;
      }
    } catch (error) {
      console.warn(`[BCV] API failed (${url}):`, error.message);
      continue;
    }
  }
  
  // Fallback: try Firestore
  try {
    const fbRate = await getDocument('configuracion', 'tasa_bcv');
    if (fbRate && fbRate.rate) {
      currentRate = fbRate.rate;
      rateSource = 'firestore';
      lastUpdate = fbRate.timestamp || Date.now();
      notifyListeners();
      return currentRate;
    }
  } catch (e) {
    console.warn('[BCV] Firestore fallback failed');
  }
  
  // Final fallback: use default or manual rate
  if (!currentRate) {
    const manual = getManualRate();
    currentRate = manual || 85.00; // Default fallback
    rateSource = manual ? 'manual' : 'default';
    lastUpdate = Date.now();
  }
  
  notifyListeners();
  return currentRate;
}

/**
 * Parse rate from different API response formats
 */
function parseRateFromResponse(data, url) {
  // pydolarve.org format
  if (data?.monitors?.usd?.price) {
    return parseFloat(data.monitors.usd.price);
  }
  
  // dolarapi.com format
  if (data?.promedio) {
    return parseFloat(data.promedio);
  }
  
  if (data?.price) {
    return parseFloat(data.price);
  }
  
  // Generic: look for common field names
  const possibleFields = ['rate', 'valor', 'precio', 'price', 'venta', 'sell'];
  for (const field of possibleFields) {
    if (data?.[field] && !isNaN(parseFloat(data[field]))) {
      return parseFloat(data[field]);
    }
  }
  
  return null;
}

/**
 * Get current rate
 */
export function getRate() {
  return currentRate || 85.00;
}

/**
 * Get rate info object
 */
export function getRateInfo() {
  return {
    rate: currentRate || 85.00,
    source: rateSource,
    lastUpdate: lastUpdate,
    formattedRate: formatRate(currentRate || 85.00),
    isStale: lastUpdate ? (Date.now() - lastUpdate > CACHE_DURATION * 2) : true
  };
}

/**
 * Set manual rate (fallback)
 */
export function setManualRate(rate) {
  if (!rate || isNaN(rate) || rate <= 0) return false;
  
  currentRate = parseFloat(rate);
  rateSource = 'manual';
  lastUpdate = Date.now();
  cacheRate(currentRate, 'manual');
  saveRateToFirestore(currentRate, 'manual');
  localStorage.setItem('ufc_bcv_manual_rate', currentRate.toString());
  notifyListeners();
  return true;
}

function getManualRate() {
  const manual = localStorage.getItem('ufc_bcv_manual_rate');
  return manual ? parseFloat(manual) : null;
}

/**
 * Convert USD to VES
 */
export function usdToVes(usd) {
  return (parseFloat(usd) || 0) * getRate();
}

/**
 * Convert VES to USD
 */
export function vesToUsd(ves) {
  const rate = getRate();
  return rate > 0 ? (parseFloat(ves) || 0) / rate : 0;
}

/**
 * Format currency values
 */
export function formatUSD(amount) {
  return `$${(parseFloat(amount) || 0).toFixed(2)}`;
}

export function formatVES(amount) {
  return `Bs ${(parseFloat(amount) || 0).toFixed(2)}`;
}

export function formatRate(rate) {
  return `1 USD = ${(parseFloat(rate) || 0).toFixed(2)} Bs`;
}

/**
 * Format bimoneda: returns both USD and VES display
 */
export function formatBimoneda(usdAmount) {
  const usd = parseFloat(usdAmount) || 0;
  const ves = usdToVes(usd);
  return {
    usd: formatUSD(usd),
    ves: formatVES(ves),
    display: `${formatUSD(usd)} / ${formatVES(ves)}`
  };
}

// ==================== CACHE ====================

function cacheRate(rate, source) {
  const data = { rate, source, timestamp: Date.now() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

function loadCachedRate() {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function saveRateToFirestore(rate, source) {
  try {
    await setDocument('configuracion', 'tasa_bcv', {
      rate,
      source,
      timestamp: Date.now()
    });
  } catch(e) {
    // Silent fail — Firestore may not be configured
  }
}

// ==================== LISTENERS ====================

/**
 * Subscribe to rate changes
 */
export function onRateChange(callback) {
  listeners.push(callback);
  // Immediately call with current rate
  if (currentRate) {
    callback(getRateInfo());
  }
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

function notifyListeners() {
  const info = getRateInfo();
  listeners.forEach(cb => cb(info));
}
