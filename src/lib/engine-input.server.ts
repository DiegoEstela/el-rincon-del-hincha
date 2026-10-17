import "server-only";
// Server-side schemas for what reaches the stats engine (issue #43, ADR 0018). Used by the club
// data route today and by the first handler that receives a start date (#16). Every issue message
// is a code: the start date can be a birth date and must never be echoed.
import { z } from "zod";
import { validateStartDate } from "@/domain/start-date";
import { CLUB_IDS } from "./club-data.server";

/** A club id of the dataset. */
export const clubIdSchema = z.enum(CLUB_IDS as [string, ...string[]]);

/** A fan start date: a real date from 1880-01-01 to today in Buenos Aires. Returns it trimmed. */
export function startDateSchema(now: Date) {
  return z.string().transform((value, ctx) => {
    const checked = validateStartDate(value, now);
    if (!checked.ok) {
      ctx.addIssue({ code: "custom", message: checked.error });
      return z.NEVER;
    }
    return checked.date;
  });
}

/** Two different known clubs (a head to head). */
export const clubPairSchema = z
  .object({ clubId: clubIdSchema, rivalId: clubIdSchema })
  .refine((pair) => pair.clubId !== pair.rivalId, { message: "same_club", path: ["rivalId"] });
