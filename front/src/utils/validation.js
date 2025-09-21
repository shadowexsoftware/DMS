// src/utils/validation.js

export function isValidEmail(email = "") {
  const s = String(email).trim();
  // Простой, но практичный RFC-наближенный шаблон
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function passwordAnalysis(pw = "") {
  const issues = [];
  const rules = {
    length: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
    nospace: !/\s/.test(pw),
  };
  if (!rules.length) issues.push("Минимум 8 символов");
  if (!rules.lower) issues.push("Хотя бы одна строчная буква (a–z)");
  if (!rules.upper) issues.push("Хотя бы одна заглавная буква (A–Z)");
  if (!rules.digit) issues.push("Хотя бы одна цифра (0–9)");
  if (!rules.special) issues.push("Хотя бы один спецсимвол (!@#…)");
  if (!rules.nospace) issues.push("Без пробелов");

  // Оценка “прочности” 0..5
  const score =
    (rules.length ? 1 : 0) +
    (rules.lower ? 1 : 0) +
    (rules.upper ? 1 : 0) +
    (rules.digit ? 1 : 0) +
    (rules.special ? 1 : 0);

  return {
    ok: issues.length === 0,
    issues,
    score, // 0..5
  };
}

export function passwordStrengthLabel(score) {
  if (score <= 1) return "Очень слабый";
  if (score === 2) return "Слабый";
  if (score === 3) return "Средний";
  if (score === 4) return "Хороший";
  return "Отличный";
}
