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

const now = Date.now();
const oneDay = 86400000;

export const INITIAL_MOCK_QUIZZES: MockQuiz[] = [
  {
    id: "quiz-1",
    title: "De Grote Herfstquiz",
    startsAt: new Date(now + 5 * oneDay),
    location: "Zaal Centrum, Gent",
    entryFee: "€20 / ploeg",
    status: "OPEN",
    team: {
      name: "De Quizvrienden",
      maxTeamSize: 4,
      registeredAt: new Date(now - 1 * oneDay),
      paidAt: new Date(now - 1 * oneDay),
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
    startsAt: new Date(now + 14 * oneDay),
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
    startsAt: new Date(now - 20 * oneDay),
    location: "Gemeentelijke Feestzaal, Lokeren",
    entryFee: "€20 / ploeg",
    status: "OPEN",
    team: {
      name: "De Quizvrienden",
      maxTeamSize: 4,
      registeredAt: new Date(now - 25 * oneDay),
      paidAt: new Date(now - 24 * oneDay),
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
