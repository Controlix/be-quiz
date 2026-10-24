function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  parts.push(line.slice(0, 75));
  let rest = line.slice(75);
  while (rest.length > 0) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

export function generateIcsCalendar(
  quiz: { id: string; title: string; startsAt: Date; durationMinutes: number; location: string },
  team: { name: string; paidAt: Date | null }
): string {
  const startDate = new Date(quiz.startsAt);
  const endDate = new Date(startDate.getTime() + quiz.durationMinutes * 60000);
  const stamp = formatIcsDate(new Date());
  const startStr = formatIcsDate(startDate);
  const endStr = formatIcsDate(endDate);

  const appHost = process.env.APP_URL ? new URL(process.env.APP_URL).hostname : "be-quiz.local";
  const uid = `quiz-${quiz.id}@${appHost}`;
  const paidStatus = team.paidAt ? "Betaald" : "Nog niet betaald";
  const description = `Ploeg: ${team.name}\\nInschrijvingsgeld: ${paidStatus}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BE-Quiz//Pub Quiz App//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    foldLine(`SUMMARY:${quiz.title}`),
    foldLine(`LOCATION:${quiz.location}`),
    foldLine(`DESCRIPTION:${description}`),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];

  return lines.join("\r\n");
}

export function generateGoogleCalendarUrl(
  quiz: { title: string; startsAt: Date; durationMinutes: number; location: string },
  team: { name: string; paidAt: Date | null }
): string {
  const startDate = new Date(quiz.startsAt);
  const endDate = new Date(startDate.getTime() + quiz.durationMinutes * 60000);
  const startStr = formatIcsDate(startDate);
  const endStr = formatIcsDate(endDate);
  const paidStatus = team.paidAt ? "Betaald" : "Nog niet betaald";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: quiz.title,
    dates: `${startStr}/${endStr}`,
    location: quiz.location,
    details: `Ploeg: ${team.name}\nInschrijvingsgeld: ${paidStatus}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
