/**
 * CSV for spreadsheet tools: semicolon separated, UTF-8 with BOM (Excel-friendly in DE/CH),
 * and protection against formula injection (cells starting with = + - @ are prefixed).
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [
    cols.map(csvCell).join(";"),
    ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(";")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
