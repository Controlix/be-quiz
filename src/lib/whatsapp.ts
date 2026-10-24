import { formatEuropeanDateTime } from "@/lib/formatters";

export function generateWhatsAppShareUrl(
  quiz: { id?: string; title: string; startsAt: Date; location: string },
  team: { name: string },
  appUrl: string
): string {
  const dateTimeStr = formatEuropeanDateTime(quiz.startsAt);
  const quizUrl = quiz.id ? `${appUrl}/quizzes/${quiz.id}` : `${appUrl}/quizzes`;

  const message = `🏆 Kwis: *${quiz.title}* op *${dateTimeStr}* te ${quiz.location}!\nPloeg: ${team.name}\nBekijk & stem af via: ${quizUrl}`;

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
