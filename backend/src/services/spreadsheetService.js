function sanitizeSpreadsheetCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

module.exports = { sanitizeSpreadsheetCell };
