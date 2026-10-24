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
