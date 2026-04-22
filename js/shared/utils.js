export function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`;
}

export function formatCurrency(value, currency = "USD") {
  const amount = Number(value) || 0;
  const locale = currency === "VES" ? "es-VE" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatNumber(value, decimals = 2) {
  const amount = Number(value) || 0;
  return amount.toLocaleString("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatDateTime(dateInput) {
  const date = new Date(dateInput);
  return date.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function parseNumber(input) {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  if (typeof input !== "string") return 0;
  const normalized = input.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function convertCurrency(amount, sourceCurrency, rate) {
  const safeAmount = Number(amount) || 0;
  const safeRate = Number(rate) || 1;

  if (sourceCurrency === "USD") {
    return {
      usd: safeAmount,
      ves: safeAmount * safeRate
    };
  }

  return {
    usd: safeAmount / safeRate,
    ves: safeAmount
  };
}

export function sanitizeText(value) {
  return String(value || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
}

export function isThreeDaysOverdue(daysLate) {
  return Number(daysLate) === 3;
}
