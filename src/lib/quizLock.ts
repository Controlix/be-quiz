import type { QuizStatus, Role } from "@prisma/client";

export interface QuizLockContext {
  startsAt: Date | string;
  status?: QuizStatus;
}

export const QUIZ_LOCKED_RSVP_ERROR = "Deze quiz is al gestart. De opstelling is definitief.";
export const QUIZ_LOCKED_MUTATION_ERROR = "Quiz is al gestart en vergrendeld voor wijzigingen.";

/**
 * Checks if personal RSVP actions ("Ik doe mee" / "Kan niet") are locked.
 * Personal RSVPs freeze for ALL members (including admins) once startsAt arrives
 * or when the quiz is cancelled/archived.
 */
export function isPersonalRsvpLocked(
  quiz: QuizLockContext,
  referenceTime: Date = new Date()
): boolean {
  if (quiz.status === "CANCELLED" || quiz.status === "ARCHIVED") {
    return true;
  }
  return referenceTime.getTime() >= new Date(quiz.startsAt).getTime();
}

/**
 * Checks if general management/mutation operations are locked for the given user role.
 * Admins retain full override and management authority at all times.
 */
export function isQuizLockedForUser(
  quiz: QuizLockContext,
  role: Role = "USER",
  referenceTime: Date = new Date()
): boolean {
  if (role === "ADMIN") {
    return false;
  }

  return isPersonalRsvpLocked(quiz, referenceTime);
}
