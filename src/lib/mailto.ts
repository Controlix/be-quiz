import { formatEuropeanDateTime } from "@/lib/formatters";

export function generateRegistrationMailto(
  quiz: { title: string; startsAt: Date; organizerEmail: string | null },
  team: { name: string },
  contactName: string
): string {
  const formattedDate = formatEuropeanDateTime(quiz.startsAt);

  // Decision D2: Team name only, NO player names and NO player counts
  const subject = encodeURIComponent(`Inschrijving quiz: ${quiz.title} - ${team.name}`);
  const body = encodeURIComponent(
    `Beste organisatie,%0D%0A%0D%0AGraag schrijven wij onze ploeg in voor ${quiz.title} op ${formattedDate}:%0D%0A%0D%0APloegnaam: ${team.name}%0D%0AContactpersoon: ${contactName}%0D%0A%0D%0AMet vriendelijke groeten,%0D%0A${contactName}`
  );

  return `mailto:${quiz.organizerEmail || ""}?subject=${subject}&body=${body}`;
}
