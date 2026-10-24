export type TabCategory = "IN_BERAAD" | "GEPLAND" | "ARCHIEF";

export interface MockQuiz {
  id: string;
  title: string;
  startsAt: Date;
  location: string;
  entryFee?: string;
  status: "OPEN" | "CANCELLED" | "ARCHIVED";
  team: {
    name: string;
    maxTeamSize: number;
    registeredAt: Date | null;
    paidAt: Date | null;
    paidByName?: string;
    rsvps: Array<{ id: string; memberName: string; status: "ATTENDING" | "DECLINED" }>;
  };
}

export const INITIAL_MOCK_QUIZZES: MockQuiz[] = [
  {
    id: "quiz-1",
    title: "De Grote Herfstquiz",
    startsAt: new Date("2026-11-14T20:00:00Z"),
    location: "Zaal Centrum, Gent",
    entryFee: "€20 / ploeg",
    status: "OPEN",
    team: {
      name: "De Quizvrienden",
      maxTeamSize: 4,
      registeredAt: new Date("2026-11-01T12:00:00Z"),
      paidAt: new Date("2026-11-01T12:00:00Z"),
      paidByName: "Marc",
      rsvps: [
        { id: "r1", memberName: "Marc", status: "ATTENDING" },
        { id: "r2", memberName: "Sarah", status: "ATTENDING" },
        { id: "r3", memberName: "Tom", status: "ATTENDING" },
        { id: "r4", memberName: "Elena", status: "ATTENDING" },
        { id: "r5", memberName: "Thomas", status: "ATTENDING" },
      ],
    },
  },
  {
    id: "quiz-2",
    title: "Scouts & Gidsen Kwis",
    startsAt: new Date("2026-11-28T19:30:00Z"),
    location: "Parochiehuis, Aalst",
    entryFee: "€25 / ploeg",
    status: "OPEN",
    team: {
      name: "De Quizvrienden",
      maxTeamSize: 4,
      registeredAt: null,
      paidAt: null,
      rsvps: [
        { id: "r6", memberName: "Marc", status: "ATTENDING" },
        { id: "r7", memberName: "Sarah", status: "ATTENDING" },
        { id: "r8", memberName: "Tom", status: "ATTENDING" },
      ],
    },
  },
  {
    id: "quiz-3",
    title: "Chiro Zomerquiz",
    startsAt: new Date("2026-08-15T20:00:00Z"),
    location: "Gemeentelijke Feestzaal, Lokeren",
    entryFee: "€20 / ploeg",
    status: "OPEN",
    team: {
      name: "De Quizvrienden",
      maxTeamSize: 4,
      registeredAt: new Date("2026-08-01T10:00:00Z"),
      paidAt: new Date("2026-08-02T14:00:00Z"),
      paidByName: "Sarah",
      rsvps: [
        { id: "r9", memberName: "Marc", status: "ATTENDING" },
        { id: "r10", memberName: "Sarah", status: "ATTENDING" },
        { id: "r11", memberName: "Tom", status: "ATTENDING" },
        { id: "r12", memberName: "Elena", status: "ATTENDING" },
      ],
    },
  },
];
