# Feedback Intake: In-App User Submissions Triage

- **Date:** 2026-11-15
- **Source:** Production database (`Feedback` table via in-app feedback dialog)
- **Reporter:** Marc (Admin)

---

## 1. Bug: Dynamic Browser Tab Title (Team Name Synchronization)

- **Feedback ID:** `cmw6kdgcw0001l2086ji24qle`
- **Submitted At:** 2026-11-07 15:34 UTC
- **Category:** `BUG`
- **Page URL:** `/quizzes`
- **Screenshot:** [https://tmjhx5rx2plwqs9j.public.blob.vercel-storage.com/uploads/feedback/a998f711-2693-4837-9a6c-50a1878e170e.jpg](https://tmjhx5rx2plwqs9j.public.blob.vercel-storage.com/uploads/feedback/a998f711-2693-4837-9a6c-50a1878e170e.jpg)
- **User Agent:** Linux Desktop Chrome
- **Reported Message:**
  > _"De teamnaam komt niet overeen met het tabblad van de browser, daar staat nog steeds \"KwisVrienden\""_

### Context & Root Cause

In release v2.1.2, customizable team branding was introduced (`TeamSetting.defaultTeamName` via `/admin/settings` and header branding). However, the root HTML `<title>` / Next.js metadata template in `src/app/layout.tsx` hardcodes `"KwisVrienden"` and is not dynamically driven by the configured team name.

---

## 2. Idea: Admin Ability to Add Non-Responding Members to Lineup

- **Feedback ID:** `cmwewq4mh0001l508oh0j4180`
- **Submitted At:** 2026-11-13 11:42 UTC
- **Category:** `IDEA`
- **Page URL:** `/quizzes/cmwewkbl00001jq07j3gen4vk`
- **Screenshot:** [https://tmjhx5rx2plwqs9j.public.blob.vercel-storage.com/uploads/feedback/83c3f158-8ac4-4674-bf50-806ad777dd7a.jpg](https://tmjhx5rx2plwqs9j.public.blob.vercel-storage.com/uploads/feedback/83c3f158-8ac4-4674-bf50-806ad777dd7a.jpg)
- **User Agent:** Samsung Galaxy / Android SamsungBrowser
- **Reported Message:**
  > _"Als admin wil ik deelnemers kunnen toevoegen die nog niet gereageerd hebben."_

### Context & Need

Currently, admins can override status for members who have already submitted an RSVP (`ATTENDING` or `DECLINED`) and can add external guest players (`v2.5.0`). However, if an existing registered team member has not yet interacted with the quiz (they have no RSVP record for that team), there is no administrative picker to add them directly to the attending lineup or reserve bench on their behalf (e.g., when they confirmed verbally or via WhatsApp).
