import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CapabilitiesProvider } from "@/features/capabilities";
import { QuizDetailClient } from "@/components/QuizDetailClient";

describe("QuizDetailClient Flyer Display", () => {
  const baseQuiz = {
    id: "quiz-1",
    title: "Pubquiz De Vagant",
    startsAt: new Date("2026-11-20T20:00:00Z"),
    location: "Gent",
    durationMinutes: 180,
    entryFee: "€20 / ploeg",
    team: {
      id: "team-1",
      name: "De Kwissers",
      maxTeamSize: 4,
      registeredAt: null,
      paidAt: null,
      rsvps: [],
    },
  };

  const defaultCaps = {
    vision: false,
    icalExport: false,
    whatsappShare: false,
    emailRegistration: false,
  };

  it("renders the flyer image poster when quiz.flyerImageUrl is populated", () => {
    const quizWithFlyer = {
      ...baseQuiz,
      flyerImageUrl: "/uploads/quiz-flyer-poster.jpg",
    };

    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={defaultCaps}>
        <QuizDetailClient
          quiz={quizWithFlyer}
          currentMemberId="member-1"
          currentMemberName="Marc"
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain('src="/uploads/quiz-flyer-poster.jpg"');
    expect(html).toContain('alt="Flyer voor Pubquiz De Vagant"');
  });

  it("renders default gradient banner when quiz.flyerImageUrl is not present", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={defaultCaps}>
        <QuizDetailClient
          quiz={baseQuiz}
          currentMemberId="member-1"
          currentMemberName="Marc"
        />
      </CapabilitiesProvider>
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("🏆");
  });
});
