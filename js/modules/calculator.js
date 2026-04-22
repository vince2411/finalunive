export function evaluateExpression(expression) {
  const sanitized = String(expression || "").replace(/\s+/g, "");
  if (!/^[0-9+\-*/().%]*$/.test(sanitized)) {
    throw new Error("Expresion invalida");
  }

  // Se limita la expresion a operadores matematicos para evitar codigo arbitrario.
  const result = Function(`"use strict"; return (${sanitized || 0});`)();

  if (!Number.isFinite(result)) {
    throw new Error("Resultado no valido");
  }

  return Number(result.toFixed(6));
}
