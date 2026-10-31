import { NextRequest, NextResponse } from "next/server";
import { getQuizById } from "@/services/quizService";
import { generateIcsCalendar } from "@/features/calendar";
import { getCapabilities } from "@/features/capabilities/capabilities";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!getCapabilities().icalExport) {
    return NextResponse.json(
      { error: "Calendar iCal export integration is disabled in this deployment." },
      { status: 501 }
    );
  }

  const { id } = await params;
  const quiz = await getQuizById(id);

  if (!quiz || !quiz.team) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ics = generateIcsCalendar(
    {
      id: quiz.id,
      title: quiz.title,
      startsAt: quiz.startsAt,
      durationMinutes: quiz.durationMinutes,
      location: quiz.location,
    },
    {
      name: quiz.team.name,
      paidAt: quiz.team.paidAt,
    }
  );

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="quiz-${quiz.id}.ics"`,
    },
  });
}
