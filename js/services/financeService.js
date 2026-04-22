import { STORAGE_KEYS } from "../config/appConfig.js";
import { getDemoFinanceRecords } from "../data/demoData.js";
import { loadFromStorage, saveToStorage } from "../shared/storage.js";
import { convertCurrency, generateId } from "../shared/utils.js";

function ensureSeedData() {
  const hasInscriptions = loadFromStorage(STORAGE_KEYS.inscriptions, null);
  const hasUniforms = loadFromStorage(STORAGE_KEYS.uniforms, null);
  const hasDebts = loadFromStorage(STORAGE_KEYS.debtRecords, null);
  const hasDebtHistory = loadFromStorage(STORAGE_KEYS.debtHistory, null);

  if (hasInscriptions && hasUniforms && hasDebts && hasDebtHistory) {
    return;
  }

  const demo = getDemoFinanceRecords();
  saveToStorage(STORAGE_KEYS.inscriptions, demo.inscriptions);
  saveToStorage(STORAGE_KEYS.uniforms, demo.uniforms);
  saveToStorage(STORAGE_KEYS.debtRecords, demo.debts);
  saveToStorage(STORAGE_KEYS.debtHistory, demo.debtHistory);
}

function readArray(key) {
  ensureSeedData();
  return loadFromStorage(key, []);
}

function writeArray(key, data) {
  saveToStorage(key, data);
  return data;
}

export function getFinanceState() {
  return {
    inscriptions: readArray(STORAGE_KEYS.inscriptions),
    uniforms: readArray(STORAGE_KEYS.uniforms),
    debtRecords: readArray(STORAGE_KEYS.debtRecords),
    debtHistory: readArray(STORAGE_KEYS.debtHistory)
  };
}

export function addInscription(payload, rate) {
  const { usd, ves } = convertCurrency(payload.amount, payload.currency, rate);
  const next = [
    {
      id: generateId("ins"),
      studentName: payload.studentName,
      concept: payload.concept,
      amountUSD: usd,
      amountVES: ves,
      createdAt: Date.now()
    },
    ...readArray(STORAGE_KEYS.inscriptions)
  ];

  writeArray(STORAGE_KEYS.inscriptions, next);
  return next;
}

export function addUniformSale(payload, rate) {
  const { usd, ves } = convertCurrency(payload.amount, payload.currency, rate);
  const next = [
    {
      id: generateId("uni"),
      product: payload.product,
      quantity: Number(payload.quantity) || 1,
      amountUSD: usd,
      amountVES: ves,
      createdAt: Date.now()
    },
    ...readArray(STORAGE_KEYS.uniforms)
  ];

  writeArray(STORAGE_KEYS.uniforms, next);
  return next;
}

export function addDebtRecord(payload, rate) {
  const { usd, ves } = convertCurrency(payload.amount, payload.currency, rate);
  const next = [
    {
      id: generateId("debt"),
      representativeName: payload.representativeName,
      amountUSD: usd,
      amountVES: ves,
      concept: payload.concept,
      daysLate: Number(payload.daysLate) || 0,
      phonePrefix: payload.phonePrefix,
      phoneNumber: payload.phoneNumber,
      status: "activo",
      createdAt: Date.now()
    },
    ...readArray(STORAGE_KEYS.debtRecords)
  ];

  writeArray(STORAGE_KEYS.debtRecords, next);
  return next;
}

export function markDebtAsPaid(debtId) {
  const debts = readArray(STORAGE_KEYS.debtRecords);
  const debt = debts.find((item) => item.id === debtId);
  if (!debt) return null;

  const activeDebts = debts.filter((item) => item.id !== debtId);
  writeArray(STORAGE_KEYS.debtRecords, activeDebts);

  const paidRecord = {
    ...debt,
    status: "pagado",
    paidAt: Date.now()
  };

  const history = [paidRecord, ...readArray(STORAGE_KEYS.debtHistory)];
  writeArray(STORAGE_KEYS.debtHistory, history);

  return paidRecord;
}

export function getFinanceMetrics() {
  const { inscriptions, uniforms, debtRecords, debtHistory } = getFinanceState();

  const totalInscriptionsUSD = inscriptions.reduce((sum, item) => sum + item.amountUSD, 0);
  const totalUniformsUSD = uniforms.reduce((sum, item) => sum + item.amountUSD, 0);
  const totalDebtUSD = debtRecords.reduce((sum, item) => sum + item.amountUSD, 0);
  const recoveredUSD = debtHistory.reduce((sum, item) => sum + item.amountUSD, 0);

  const totalInscriptionsVES = inscriptions.reduce((sum, item) => sum + item.amountVES, 0);
  const totalUniformsVES = uniforms.reduce((sum, item) => sum + item.amountVES, 0);
  const totalDebtVES = debtRecords.reduce((sum, item) => sum + item.amountVES, 0);
  const recoveredVES = debtHistory.reduce((sum, item) => sum + item.amountVES, 0);

  return {
    incomeUSD: totalInscriptionsUSD + totalUniformsUSD + recoveredUSD,
    incomeVES: totalInscriptionsVES + totalUniformsVES + recoveredVES,
    debtUSD: totalDebtUSD,
    debtVES: totalDebtVES,
    recoveredUSD,
    recoveredVES,
    inscriptionsCount: inscriptions.length,
    uniformsCount: uniforms.length,
    activeDebtors: debtRecords.length
  };
}
