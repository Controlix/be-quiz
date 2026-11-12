export interface GoogleCalendarEventPayload {
  summary: string;
  location: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  description: string;
}

export function formatLineupSummary(
  attendees: Array<{
    member?: { name: string } | null;
    guestName?: string | null;
    invitedBy?: { name: string } | null;
  }>
): string[] {
  return attendees.map(
    (r) =>
      r.member?.name ??
      (r.guestName
        ? r.invitedBy
          ? `${r.guestName} (Gast van ${r.invitedBy.name})`
          : r.guestName
        : "Gast")
  );
}

export function formatGoogleCalendarPayload(params: {
  quiz: {
    id: string;
    title: string;
    startsAt: Date;
    durationMinutes: number;
    location: string;
    timeZone?: string;
  };
  lineup: string[];
  payment: {
    fee: string | null;
    isPaid: boolean;
    payerName?: string | null;
  };
  appUrl?: string;
}): GoogleCalendarEventPayload {
  const { quiz, lineup, payment, appUrl } = params;
  const timeZone = quiz.timeZone || "Europe/Brussels";
  const start = new Date(quiz.startsAt);
  const end = new Date(start.getTime() + quiz.durationMinutes * 60000);

  const lineupText = lineup.length > 0 ? lineup.join(", ") : "Geen spelers";

  let paymentText = "";
  if (payment.fee) {
    if (payment.isPaid) {
      paymentText = payment.payerName
        ? `${payment.fee} (Betaald door ${payment.payerName})`
        : `${payment.fee} (Betaald)`;
    } else {
      paymentText = `${payment.fee} (Nog niet betaald)`;
    }
  } else {
    if (payment.isPaid) {
      paymentText = payment.payerName ? `Betaald door ${payment.payerName}` : `Betaald`;
    } else {
      paymentText = "Nog niet betaald";
    }
  }

  const baseUrl = appUrl || process.env.APP_URL;
  const lines: string[] = [`Ploeg: ${lineupText}`, `Inschrijvingsgeld: ${paymentText}`];

  if (baseUrl) {
    lines.push("");
    lines.push("Bekijk of wijzig je RSVP in de app:");
    lines.push(`${baseUrl.replace(/\/$/, "")}/quizzes/${quiz.id}`);
  }

  return {
    summary: quiz.title,
    location: quiz.location,
    start: {
      dateTime: start.toISOString(),
      timeZone,
    },
    end: {
      dateTime: end.toISOString(),
      timeZone,
    },
    description: lines.join("\n"),
  };
}
