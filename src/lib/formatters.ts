import { format, parse, isValid } from "date-fns";
import { nlBE } from "date-fns/locale";

export function formatEuropeanDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "";
  return format(d, "dd/MM/yyyy");
}

export function formatEuropeanTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "";
  return format(d, "HH:mm");
}

export function formatEuropeanDateTime(
  date: Date | string,
  includeWeekday = true
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "";
  if (includeWeekday) {
    return format(d, "EEE dd/MM/yyyy 'om' HH:mm", { locale: nlBE });
  }
  return format(d, "dd/MM/yyyy HH:mm");
}

export function formatEuropeanDateString(val: string): string {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const parsedIso = parse(val, "yyyy-MM-dd", new Date());
    if (isValid(parsedIso)) return format(parsedIso, "dd/MM/yyyy");
  }
  const digits = val.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function formatEuropeanTimeString(val: string): string {
  if (!val) return "";
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function parseEuropeanDateTime(dateStr: string, timeStr: string): Date | null {
  const cleanDate = dateStr.trim();
  const cleanTime = timeStr.trim();
  const combined = `${cleanDate} ${cleanTime}`;

  // Try parsing dd/MM/yyyy HH:mm
  const parsed = parse(combined, "dd/MM/yyyy HH:mm", new Date());
  if (isValid(parsed)) return parsed;

  // Fallback if ISO format was passed
  const parsedIso = parse(combined, "yyyy-MM-dd HH:mm", new Date());
  if (isValid(parsedIso)) return parsedIso;

  return null;
}
