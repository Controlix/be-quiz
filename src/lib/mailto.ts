import { formatEuropeanDateTime } from "@/lib/formatters";

export function getRegistrationEmailPlainText(
  quiz: { title: string; startsAt: Date },
  team: { name: string },
  contactName: string
): string {
  const formattedDate = formatEuropeanDateTime(quiz.startsAt);
  return `Beste organisatie,\r\n\r\nGraag schrijven wij onze ploeg in voor ${quiz.title} op ${formattedDate}:\r\n\r\nPloegnaam: ${team.name}\r\nContactpersoon: ${contactName}\r\n\r\nMet vriendelijke groeten,\r\n${contactName}`;
}

export function generateRegistrationMailto(
  quiz: { title: string; startsAt: Date; organizerEmail: string | null },
  team: { name: string },
  contactName: string
): string {
  // Decision D2: Team name only, NO player names and NO player counts
  const subject = encodeURIComponent(`Inschrijving quiz: ${quiz.title} - ${team.name}`);
  const bodyText = getRegistrationEmailPlainText(quiz, team, contactName);
  const body = encodeURIComponent(bodyText);

  return `mailto:${quiz.organizerEmail || ""}?subject=${subject}&body=${body}`;
}
