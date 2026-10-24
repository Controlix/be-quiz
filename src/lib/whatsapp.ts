export function generateWhatsAppShareUrl(
  quiz: { id?: string; title: string; startsAt: Date; location: string },
  team: { name: string },
  appUrl: string
): string {
  const dateStr = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(quiz.startsAt));

  const timeStr = new Intl.DateTimeFormat("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(quiz.startsAt));

  const quizUrl = quiz.id ? `${appUrl}/quizzes/${quiz.id}` : `${appUrl}/quizzes`;

  const message = `🏆 Kwis: *${quiz.title}* op *${dateStr}* om ${timeStr} te ${quiz.location}!\nPloeg: ${team.name}\nBekijk & stem af via: ${quizUrl}`;

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
