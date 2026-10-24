export function formatEuropeanDate(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function formatEuropeanTime(date: Date | string): string {
  const d = new Date(date);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatEuropeanDateTime(
  date: Date | string,
  includeWeekday = true
): string {
  const d = new Date(date);
  const datePart = formatEuropeanDate(d);
  const timePart = formatEuropeanTime(d);

  if (includeWeekday) {
    const weekday = new Intl.DateTimeFormat("nl-BE", {
      weekday: "short",
      timeZone: "UTC",
    }).format(d);
    return `${weekday} ${datePart} om ${timePart}`;
  }

  return `${datePart} ${timePart}`;
}

export function formatEuropeanDateString(val: string): string {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split("-");
    return `${d}/${m}/${y}`;
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
  const [d, m, y] = dateStr.split("/").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if (!d || !m || !y || isNaN(hh) || isNaN(mm)) {
    return null;
  }
  const date = new Date(y, m - 1, d, hh, mm);
  return isNaN(date.getTime()) ? null : date;
}
